# Dotia

Plataforma de habilitación de dotación para faenas mineras y de construcción en Chile. Permite a un administrador **asignar ágilmente trabajadores a cargos**, **gestionar toda la documentación necesaria para habilitarlos** (con validación automática por IA contra el Registro Civil) y **entender de un vistazo el estado de dotación de cada proyecto**: cuánto está asignado y habilitado vs. la curva requerida, qué trabajador falta en qué semana, y anticipar brechas antes de que frenen la faena.

> **Estado:** en producción sobre Railway, fase de QA. Un administrador típico gestiona **un** proyecto con miles de personas.

---

## Tabla de contenidos

- [Objetivo de negocio](#objetivo-de-negocio)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura general](#arquitectura-general)
- [Modelo de datos](#modelo-de-datos)
- [El pipeline de habilitación](#el-pipeline-de-habilitación)
- [Verificación automática de documentos](#verificación-automática-de-documentos)
- [Autenticación y autorización](#autenticación-y-autorización)
- [Seguridad](#seguridad)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Desarrollo local](#desarrollo-local)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue](#despliegue)

---

## Objetivo de negocio

Las métricas que la plataforma optimiza:

- **% asignados y habilitados vs. dotación requerida** del proyecto, por semana.
- **Quién falta en qué semana** para no parar la faena.
- **Anticipación de brechas** (gaps próximos, salidas sin relevo, documentos por vencer, cambios de curva) vía alertas.
- **Velocidad de habilitación**: mover a un trabajador de "recién asignado" a "habilitado" con la menor fricción documental posible, incluyendo un portal donde el propio trabajador sube sus documentos desde el teléfono.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 16** (App Router, React Server Components, Server Actions, Turbopack) |
| Lenguaje | TypeScript, React 19 |
| Base de datos | **SQLite** vía **Prisma 5** ORM |
| Autenticación | **NextAuth v5** (Auth.js), estrategia JWT, provider de credenciales + bcrypt |
| UI | Tailwind CSS 4, shadcn/ui + Base UI, **framer-motion** (animaciones), lucide-react (íconos) |
| Datos/visualización | **recharts** (curvas de dotación), canvas-confetti, SheetJS `xlsx` (export a Excel) |
| Validación | **zod** (schemas de entrada en server actions y auth) |
| Microservicio IA | **Fastify 5** + `@anthropic-ai/sdk` (OCR con Claude Haiku) + **puppeteer** (scraping del Registro Civil) + 2captcha |
| Hosting | **Railway** (2 servicios + volumen persistente) |

---

## Arquitectura general

Dos servicios desplegados en el mismo proyecto Railway, más un volumen para datos persistentes:

```
                    Internet (HTTPS)
                         │
          ┌──────────────▼───────────────┐
          │  Servicio "app" (Next.js)      │
          │  · Dashboard + portal público  │
          │  · Server Actions (lib/actions)│
          │  · Prisma → SQLite             │
          │  · Entrega autenticada de      │
          │    documentos /uploads/[...]   │
          └───────┬───────────────┬────────┘
                  │ private net    │ volumen /data
                  │ (no público)   │  ├── dotia.db (SQLite)
                  ▼                └─▶└── uploads/ (documentos + capturas)
     ┌────────────────────────────┐
     │ Servicio "verificador"      │
     │ (Fastify, :3001)            │
     │ · OCR de documentos (Claude)│
     │ · Verificación en Registro  │
     │   Civil (puppeteer+captcha) │
     └────────────────────────────┘
```

- El **app** es el único con dominio público. Renderiza el dashboard (protegido por sesión) y el portal `/upload/[token]` (anónimo con token válido).
- El **verificador** no tiene dominio público: solo se accede desde el app por la red privada de Railway (`http://verificador.railway.internal:3001`). Aísla las dependencias pesadas (Chromium) y las llamadas a la API de Anthropic.
- Los archivos subidos **no viven en `public/`**: se guardan en el volumen (`storage/uploads`, enlazado a `/data/uploads`) y se sirven exclusivamente por una ruta autenticada.

---

## Modelo de datos

16 modelos Prisma. Los centrales:

| Modelo | Rol |
|---|---|
| `User` | Cuentas de la plataforma (SUPERADMIN / ADMIN / AUDITOR) |
| `Project` | Proyecto/faena; contiene la planificación semanal |
| `Role` | Cargo (Operador de Bulldozer, etc.); tiene sus propios requisitos documentales |
| `Worker` | Trabajador, asignado a un `Role` y a un proyecto; `currentStageOrder` marca su avance en el pipeline |
| `Stage` | Etapa del pipeline de habilitación (ver abajo) |
| `StageDocRequirement` | Qué documentos exige cada etapa **por cargo** (`roleId`) |
| `DocumentType` | Tipo de documento (Cédula, Antecedentes, Licencia, Hoja de Vida del Conductor, …) |
| `WorkerDocument` | Documento subido: `fileUrl`, `status`, `documentNumber`, `expiresAt`, `issuedAt`, `verifyNote`, `extractedData` (JSON con lo leído por la IA) |
| `WorkerDocException` | Excepción justificada cuando falta un documento obligatorio |
| `WorkerUploadToken` | Token del magic link (crypto random, expira) para el portal público |
| `WorkerAssignment` / `WeekPlan` | Asignación de trabajadores a semanas vs. curva planificada |
| `AlertSetting` / `CurveChangeLog` | Configuración de alertas y bitácora de cambios de curva |
| `FeatureRequest` | Backlog de features y bugs de QA (con capturas adjuntas) |

---

## El pipeline de habilitación

Un trabajador avanza por **4 etapas de PROCESO**. Se considera **habilitado** cuando supera la última (`currentStageOrder > totalEtapas`). Además hay flags derivados: **Acreditado** (etapa ≥ 3), **Contratado** (≥ 4), **Habilitado** (> 4).

- Los requisitos son **100% por cargo** (`StageDocRequirement.roleId`): cada cargo define qué documentos pide en cada etapa.
- `recalcAllWorkerStages()` reubica a cada trabajador en su primera etapa incompleta cuando cambian los requisitos.
- El admin ve el estado en tres pestañas por proyecto: **Dotación** (semana actual por defecto, curva vs. asignación), **Seguimiento** (matriz cargo × etapa) y **Torre de Control** (KPIs, curva, déficit por semana, banco de habilitados).

---

## Verificación automática de documentos

El microservicio verificador expone endpoints que el app consume desde `lib/actions/verificar-documento.ts`:

| Documento | Flujo |
|---|---|
| **Cédula de identidad** | OCR (extrae RUT + n° de serie) → verificación en Registro Civil |
| **Certificado de antecedentes** | OCR (folio + código) → verificación en RC; captura condenas si existen |
| **Hoja de Vida del Conductor** | OCR (folio + código) → misma verificación RC; captura licencias y anotaciones |
| **Licencia de conducir** | OCR de anverso + reverso opcional; valida vigencia con extensión legal +1 año |

En todos los casos se **compara el RUT del trabajador contra el de cada documento** (error consistente `RUT_NO_COINCIDE`), se captura `expiresAt`/`issuedAt` y los datos relevantes quedan en `extractedData`. La validación la ejecuta el **admin** (no el trabajador), con un botón de **validación masiva** que corre la verificación de todos los documentos pendientes con una animación de progreso en vivo.

---

## Autenticación y autorización

- **NextAuth v5** con JWT; el rol viaja en el token y la sesión.
- **`proxy.ts`** (middleware) protege todo salvo `/login` y `/upload/*`.
- Guards en `lib/authz.ts`, aplicados en cada server action:
  - `assertCanWrite()` — bloquea a **AUDITOR** (solo lectura de todo).
  - `assertSuperadmin()` — Cargos y Acceso.
  - `assertCanUploadFor(workerId)` — permite admins con sesión **o** trabajadores anónimos con token de magic link válido.
- Roles: **SUPERADMIN** (todo, incl. Cargos y Acceso), **ADMIN**, **AUDITOR** (lectura total, cero escritura).

---

## Seguridad

- **Documentos tras autenticación**: no se sirven como estáticos públicos; se entregan por `app/uploads/[...path]/route.ts`, que exige sesión y bloquea path traversal.
- **Subidas validadas**: whitelist de extensiones (pdf/jpg/jpeg/png/webp) y máximo 15 MB (`lib/uploads.ts`).
- **Magic link**: token de 32 bytes criptográficos con expiración.
- **Rate limit de login**: 5 intentos fallidos por email bloquean 15 min.
- **Security headers** globales (`next.config.ts`): X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS.
- **Verificador sin exposición pública**; claves de API solo en su servicio.

---

## Estructura de carpetas

```
app/
  dashboard/        Panel protegido: proyectos, empleados, cargos, alertas, reportes, features, bugs, acceso
  upload/[token]/   Portal público del trabajador (magic link)
  uploads/[...path] Entrega autenticada de archivos
  login/
components/         UI (worker-pipeline, torre-control, bulk-verify-overlay, features-view, sidebar, …)
lib/
  actions/          Server Actions (una por dominio: workers, projects, roles, verificar-documento, …)
  authz.ts          Guards de autorización
  auth.ts           Configuración NextAuth + rate limit
  uploads.ts        Almacenamiento seguro de archivos
  export-excel.ts   Exportación a Excel
prisma/
  schema.prisma     16 modelos
  migrations/
  seed.ts           Usuarios, etapas, tipos de documento y datos demo
scripts/
  railway-start.sh  Arranque en Railway (enlaza volumen + migrate deploy + next start)
verificador/        Microservicio Fastify (Dockerfile con Chromium)
```

---

## Desarrollo local

```bash
npm install
npx prisma migrate dev        # crea prisma/dev.db y aplica migraciones
npm run db:seed               # usuarios + datos demo
npm run dev                   # Next en :3000

# En otra terminal, el verificador:
cd verificador && npm install && npm run dev   # Fastify en :3001
```

Cuentas demo tras el seed: `superadmin@faenas.cl` / `admin@faenas.cl` / `auditor@faenas.cl` (contraseñas en `prisma/seed.ts`). En producción las credenciales fueron rotadas.

---

## Variables de entorno

**app**

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Ruta SQLite. Local: `file:./dev.db`. Prod: `file:/data/dotia.db` |
| `NEXTAUTH_SECRET` | Secreto JWT (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL completa con `https://` |
| `AUTH_TRUST_HOST` | `true` en Railway |
| `VERIFICADOR_URL` | `http://verificador.railway.internal:3001` en prod |
| `UPLOADS_DIR` | (opcional) raíz de archivos; por defecto `storage/uploads` |

**verificador**

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | API key de Claude (OCR) |
| `TWOCAPTCHA_KEY` | API key de 2captcha (captcha del Registro Civil) |
| `PORT` | `3001` |

---

## Despliegue

Producción corre en **Railway** desplegando el branch `dev`. La guía paso a paso (servicios, volumen, variables, primera puesta en marcha) está en **[DEPLOY.md](DEPLOY.md)**.

> Nota: hoy producción sigue `dev`, así que cada push se despliega. Cuando el uso se estabilice, conviene promover a `main` y usar `dev` para desarrollo.
