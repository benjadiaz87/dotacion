# Dotación de Faenas

Plataforma para gestionar la dotación de personal en faenas mineras y constructivas. Permite a un administrador crear proyectos, planificar qué cargos se necesitan contratar semana a semana, y visualizar toda la dotación en una carta Gantt interactiva — inspirada en la experiencia visual de un CRM empresarial (estilo Salesforce).

> **Estado actual:** MVP funcional (Fase 1 del roadmap). Auth, gestión de proyectos, planificación semanal por cargo y vista Gantt están implementados. Gestión de empleados individuales, documentación y generación de contratos son fases futuras (ver [Roadmap](#roadmap)).

---

## Tabla de contenidos

- [Arquitectura general](#arquitectura-general)
- [Stack tecnológico](#stack-tecnológico)
- [Modelo de datos](#modelo-de-datos)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Flujos principales](#flujos-principales)
- [Detalle de servicios y módulos](#detalle-de-servicios-y-módulos)
- [Autenticación y autorización](#autenticación-y-autorización)
- [Desarrollo local](#desarrollo-local)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Decisiones técnicas y por qué](#decisiones-técnicas-y-por-qué)
- [Roadmap](#roadmap)
- [Despliegue a producción](#despliegue-a-producción)

---

## Arquitectura general

La aplicación es un **monolito Next.js** (App Router) que combina frontend y backend en el mismo proceso, usando **Server Components** para lectura de datos y **Server Actions** para mutaciones. No hay una API REST separada: las "rutas de API" son funciones de servidor invocadas directamente desde los componentes de cliente.

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER (Cliente)                        │
│  React 19 · Server/Client Components · Tailwind CSS · shadcn/ui  │
└───────────────────────────┬────────────────────────────────────--┘
                            │ HTTP (Next.js routing)
┌───────────────────────────▼───────────────────────────────────────┐
│                    NEXT.JS 16 (App Router, Turbopack)             │
│                                                                     │
│  proxy.ts ──► Intercepta TODAS las requests antes de enrutar      │
│     │          (protección de rutas vía NextAuth)                │
│     ▼                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐ │
│  │  Server Components  │    │      Server Actions             │  │
│  │  (lectura de datos) │    │  (mutaciones: crear/editar/borrar)│ │
│  │  app/dashboard/*.tsx │    │  lib/actions/projects.ts        │  │
│  └──────────┬───────────┘    └────────────┬─────────────────────┘ │
│             │                              │                       │
│             └──────────────┬───────────────┘                       │
│                             ▼                                      │
│                    lib/db.ts (Prisma Client)                       │
└─────────────────────────────┬───────────────────────────────────--┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   SQLite (dev.db)     │
                  │   prisma/dev.db        │
                  └───────────────────────┘
```

**Por qué este modelo y no un backend separado:** con un solo administrador por minera y volumetría moderada en el MVP, separar un backend en otro servicio agrega complejidad operativa (otro deploy, otro contrato de API, CORS) sin beneficio inmediato. Next.js Server Actions dan tipado end-to-end (TypeScript desde el formulario hasta la query SQL) sin escribir una capa de API explícita. Cuando el volumen de empleados por proyecto crezca a miles (como se espera para clientes mineros grandes), la capa `lib/actions/*` se puede extraer a servicios independientes sin tocar la UI, porque ya está aislada de los componentes.

---

## Stack tecnológico

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| Framework | **Next.js** | 16.2.9 (Turbopack) | App Router, Server Components, Server Actions, bundling |
| Lenguaje | **TypeScript** | 5.x | Tipado estático end-to-end |
| UI | **React** | 19.2.4 | Librería de componentes |
| Estilos | **Tailwind CSS** | v4 | Utility-first CSS, tema vía variables CSS (`globals.css`) |
| Componentes | **shadcn/ui** sobre **@base-ui/react** | 4.12.0 / 1.6.0 | Componentes accesibles (Button, Dialog, DropdownMenu, etc.) — *nota: no es Radix UI, es Base UI, por lo que no soporta `asChild`* |
| Iconos | **lucide-react** | 1.21.0 | Set de iconos SVG |
| ORM | **Prisma** | 5.22.0 | Cliente de base de datos tipado + migraciones |
| Base de datos (dev) | **SQLite** | — | Archivo local `prisma/dev.db`, cero configuración |
| Auth | **NextAuth (Auth.js) v5** | 5.0.0-beta.31 | Sesiones JWT, credentials provider |
| Hashing | **bcryptjs** | 3.0.3 | Hash de contraseñas |
| Validación | **Zod** | 4.4.3 | Validación de inputs en Server Actions |
| Notificaciones UI | **Sonner** | 2.0.7 | Toasts |
| Runtime de scripts | **tsx** | 4.22.4 | Ejecutar TypeScript directo (seed de BD) |

### Por qué cada elección

- **Next.js 16 + Turbopack**: SSR out-of-the-box, Server Actions eliminan la necesidad de escribir y mantener endpoints REST/GraphQL para cada mutación. Turbopack acelera el rebuild en desarrollo.
- **Prisma**: tipado generado automáticamente desde el schema — los `db.project.findMany(...)` en `lib/actions/projects.ts` están completamente tipados, incluyendo las relaciones anidadas (`weekPlans.requirements.role`).
- **SQLite en desarrollo**: Prisma Cloud (Prisma Postgres) fue evaluado pero descartado para este entorno porque sus conexiones gestionadas (`db.prisma.io`) no aceptan TCP directo y requieren el gateway de Accelerate con API keys que no resultaron válidas en las pruebas. SQLite da una base de datos funcional sin ningún servicio externo, ideal para evaluar el producto rápido. **En producción se debe migrar a PostgreSQL** (ver [Despliegue a producción](#despliegue-a-producción)).
- **shadcn/ui sobre Base UI** (no Radix): fue la versión que el CLI de `shadcn` instaló por defecto en este entorno. La diferencia práctica más importante es que **no soporta la prop `asChild`** — por eso los triggers de `DropdownMenu` en este proyecto reciben las clases de `buttonVariants` directamente en vez de envolver un componente `<Button>` (evita el bug de `<button>` anidado en `<button>`).
- **NextAuth v5 (Auth.js)**: maneja sesiones JWT sin necesidad de una tabla de sesiones en base de datos, central para un admin único por cuenta. La validación de rutas ocurre en `proxy.ts` (el archivo que en Next.js 16 reemplazó a `middleware.ts`).

---

## Modelo de datos

```
┌─────────────────┐
│      User        │
│ ───────────────── │
│ id (PK)           │
│ email (unique)    │
│ name              │
│ password (hash)   │
│ role              │  "ADMIN" | "SUPER_ADMIN" | "PM" | "RRHH" (string libre, no enum)
└─────────┬─────────┘
          │ 1
          │
          │ N
┌─────────▼─────────┐
│     Project        │
│ ───────────────────  │
│ id (PK)             │
│ name                │
│ description?        │
│ location?           │
│ client?             │
│ startDate           │
│ weeks (Int)         │  duración total en semanas
│ status              │  "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"
│ userId (FK → User)  │
└─────────┬───────────┘
          │ 1
          │
          │ N
┌─────────▼─────────┐        ┌──────────────────┐
│    WeekPlan         │        │       Role         │
│ ─────────────────── │        │ ────────────────── │
│ id (PK)             │        │ id (PK)            │
│ weekNumber (Int)     │        │ name (unique)      │
│ startDate            │        │ category           │  "OPERATIVO" | "TECNICO" |
│ endDate              │        │ color (hex)        │  "ADMINISTRATIVO" | "SUPERVISION"
│ notes?               │        └─────────┬──────────┘
│ projectId (FK)       │                  │ N
│ @@unique([projectId, │                  │
│   weekNumber])       │                  │
└─────────┬────────────┘                  │
          │ 1                              │
          │                                │
          │ N                              │
┌─────────▼────────────────────────────────▼──┐
│              RoleRequirement                  │
│ ──────────────────────────────────────────── │
│ id (PK)                                      │
│ quantity (Int)            cuántas personas    │
│ weekPlanId (FK → WeekPlan)                    │
│ roleId (FK → Role)                            │
│ @@unique([weekPlanId, roleId])                │
└────────────────────────────────────────────────┘
```

**La tabla pivote clave es `RoleRequirement`**: conecta una semana específica de un proyecto (`WeekPlan`) con un cargo del catálogo (`Role`) y una cantidad. Es exactamente lo que alimenta la carta Gantt: cada celda del Gantt es un `RoleRequirement` (o su ausencia).

> **Nota de implementación:** los campos que conceptualmente son enums (`User.role`, `Project.status`, `Role.category`) están modelados como `String` simple, no como `enum` de Prisma. Esto es porque **SQLite no soporta enums nativos** en Prisma — al migrar a PostgreSQL en producción, se recomienda volver a tipar estos campos como `enum` reales para obtener validación a nivel de base de datos.

Definido en [`prisma/schema.prisma`](prisma/schema.prisma).

---

## Estructura de carpetas

```
dotacion-faenas/
├── app/                              # App Router de Next.js
│   ├── api/auth/[...nextauth]/       # Handler de NextAuth (GET/POST)
│   ├── dashboard/
│   │   ├── layout.tsx                # Layout protegido: valida sesión, monta el Sidebar
│   │   ├── page.tsx                  # Dashboard principal (KPIs + proyectos vigentes)
│   │   └── proyectos/
│   │       ├── page.tsx              # Listado completo de proyectos
│   │       ├── nuevo/page.tsx        # Wizard de creación de proyecto
│   │       └── [id]/page.tsx         # Detalle de proyecto + Gantt
│   ├── login/page.tsx                # Página de login (split layout estilo CRM)
│   ├── layout.tsx                    # Root layout (fuente, Toaster global)
│   ├── page.tsx                      # Redirect "/" → "/dashboard"
│   └── globals.css                   # Variables de tema (colores, radios) para Tailwind v4
│
├── components/
│   ├── ui/                           # Componentes base de shadcn/ui (Button, Card, Dialog...)
│   ├── sidebar.tsx                   # Navegación lateral + menú de usuario
│   ├── new-project-form.tsx          # Formulario wizard (2 pasos) de creación de proyecto
│   ├── gantt-chart.tsx               # Carta Gantt interactiva (cargo × semana)
│   ├── dotacion-sparkline.tsx        # Mini gráfico SVG de curva de dotación
│   └── project-actions.tsx           # Menú de acciones del proyecto (activar/pausar/eliminar)
│
├── lib/
│   ├── auth.ts                       # Configuración de NextAuth (provider, callbacks JWT)
│   ├── db.ts                         # Instancia singleton de Prisma Client
│   ├── project-utils.ts              # Funciones puras: progreso, headcount, formateo de fechas
│   └── actions/
│       └── projects.ts               # Server Actions: createProject, getProjects, etc.
│
├── prisma/
│   ├── schema.prisma                 # Definición del modelo de datos
│   ├── seed.ts                       # Script de datos demo (usuario admin + proyecto + roles)
│   ├── dev.db                        # Base de datos SQLite local (gitignored)
│   └── migrations/                   # Historial de migraciones SQL
│
├── proxy.ts                          # Reemplazo de middleware.ts en Next.js 16: protege rutas
├── prisma.config.ts                  # Configuración de Prisma (carga de .env)
└── components.json                   # Configuración de shadcn/ui (alias, estilo)
```

---

## Flujos principales

### 1. Login

```
Usuario ingresa email/password en /login
        │
        ▼
signIn("credentials", {...})  [next-auth/react, client-side]
        │
        ▼
lib/auth.ts → Credentials.authorize()
        │
        ├─► db.user.findUnique({ email })
        ├─► bcrypt.compare(password, user.password)
        │
        ▼
   JWT firmado con NEXTAUTH_SECRET, incluye { id, role }
        │
        ▼
proxy.ts detecta sesión válida → redirige a /dashboard
```

### 2. Creación de proyecto (wizard de 2 pasos)

```
Paso 1 — Datos del proyecto
  nombre, cliente, ubicación, fecha de inicio, duración (semanas)
        │
        ▼
Paso 2 — Planificación semanal
  Para cada semana (1..N):
    agregar cargo(s) del catálogo + cantidad de personas
        │
        ▼
createProject(data, weekPlans)  [Server Action, lib/actions/projects.ts]
        │
        ├─► calcula startDate/endDate de cada semana a partir de la fecha de inicio del proyecto
        ├─► db.project.create({ ..., weekPlans: { create: [...] } })  -- inserción anidada en una sola transacción Prisma
        │
        ▼
revalidatePath("/dashboard", "/dashboard/proyectos")
redirect(`/dashboard/proyectos/${project.id}`)
```

### 3. Visualización en carta Gantt

```
app/dashboard/proyectos/[id]/page.tsx (Server Component)
        │
        ├─► getProject(id) → incluye weekPlans.requirements.role (relaciones anidadas)
        │
        ▼
<GanttChart weekPlans={...} />  (Client Component)
        │
        ├─► construye la unión de todos los Role distintos usados en el proyecto
        ├─► renderiza una grilla: filas = cargos, columnas = semanas
        ├─► click en columna de semana   → setSelection({ type: "week", weekNumber })
        ├─► click en nombre de un cargo  → setSelection({ type: "role", roleId })
        │
        ▼
Panel de detalle condicional:
  - selección de semana → desglose de cargos requeridos esa semana
  - selección de cargo  → curva (sparkline) de ese cargo across todas las semanas + tabla semana a semana
```

---

## Detalle de servicios y módulos

### `lib/auth.ts` — Servicio de autenticación

Configura NextAuth con:
- **Provider:** `Credentials` — valida email + password contra la tabla `User` usando `bcrypt.compare`.
- **Estrategia de sesión:** `jwt` (sin tabla de sesiones en BD — más simple para un solo admin por cuenta).
- **Callbacks:**
  - `jwt`: inyecta `id` y `role` del usuario en el token al momento del login.
  - `session`: expone `id` y `role` en `session.user` para que estén disponibles en Server Components vía `auth()`.
- **Página de login personalizada:** `/login` (en vez de la página default de NextAuth).

Exporta `{ handlers, auth, signIn, signOut }`, consumidos por:
- `app/api/auth/[...nextauth]/route.ts` — expone `GET`/`POST` para el flujo OAuth/credentials interno de NextAuth.
- `proxy.ts` — usa `auth()` envolviendo la función de proxy para inspeccionar la sesión en cada request.
- Componentes cliente (`signIn`, `signOut`) en `login/page.tsx` y `sidebar.tsx`.

### `proxy.ts` — Protección de rutas

En Next.js 16, el archivo `middleware.ts` fue renombrado a `proxy.ts` (export nombrado `proxy`, no default). Su lógica:

```ts
- Si NO hay sesión y la ruta NO es /login  → redirige a /login
- Si HAY sesión y la ruta ES /login        → redirige a /dashboard
```

El `matcher` excluye `/api`, `/_next/static`, `/_next/image` y `/favicon.ico` para no interceptar assets ni las propias rutas de auth.

### `lib/db.ts` — Cliente de Prisma

Singleton de `PrismaClient` cacheado en `globalThis` para evitar agotar conexiones en el modo de desarrollo de Next.js (donde los módulos se recargan en cada cambio de archivo, lo que crearía un cliente nuevo por reload sin este patrón).

### `lib/actions/projects.ts` — Server Actions de proyectos

Todas las funciones llevan la directiva `"use server"` al tope del archivo, lo que las convierte en endpoints invocables remotamente (Next.js genera automáticamente el wiring cliente↔servidor). Funciones expuestas:

| Función | Qué hace | Validación |
|---|---|---|
| `createProject(data, weekPlans)` | Crea un proyecto con sus `WeekPlan` y `RoleRequirement` anidados en una sola operación | Zod schema `projectSchema` (nombre, fecha, semanas 1–104) |
| `updateProjectStatus(id, status)` | Cambia el estado (activo/pausado/completado) | Requiere sesión válida |
| `deleteProject(id)` | Elimina el proyecto (cascada borra sus `WeekPlan`/`RoleRequirement`) | Requiere sesión válida |
| `getProjects()` | Lista todos los proyectos del usuario autenticado, con semanas y requerimientos | Filtra por `userId` de la sesión |
| `getProject(id)` | Detalle de un proyecto específico | — |
| `getRoles()` | Catálogo completo de cargos disponibles | — |

Cada mutación llama `revalidatePath(...)` para invalidar el cache de Server Components afectados (Next.js App Router cachea renders de servidor; sin esto, el dashboard mostraría datos obsoletos tras crear/editar).

### `lib/project-utils.ts` — Utilidades de dominio (funciones puras, sin I/O)

| Función | Propósito |
|---|---|
| `getProjectProgress(startDate, weeks)` | % de avance del proyecto según fecha actual vs. rango total |
| `getTotalHeadcount(weekPlans)` | Suma de personas requeridas en todas las semanas (para KPIs) |
| `getSparklineData(weekPlans)` | Transforma `weekPlans` en `{ weekNumber, total }[]` ordenado, insumo del sparkline |
| `formatDate` / `formatWeekRange` | Formateo de fechas en español (`es-CL`) |
| `statusConfig` | Mapeo de estado → label + clases de color (badge) |

### `components/gantt-chart.tsx` — Carta Gantt

Componente cliente con estado de selección unificado:

```ts
type Selection =
  | { type: "week"; weekNumber: number }
  | { type: "role"; roleId: string }
  | null;
```

- **Grilla principal:** filas = cargos (agrupados por categoría: Supervisión, Técnico, Operativo, Administrativo), columnas = semanas del proyecto.
- **Fila de "Dotación total":** barra de progreso relativa al máximo de personas en cualquier semana del proyecto (`maxHeadcount`).
- **Selección de semana:** resalta la columna y muestra un panel con el desglose de cargos de esa semana específica.
- **Selección de cargo:** resalta la fila y muestra un panel con la curva de ese cargo a través de *todas* las semanas (reutilizando `DotacionSparkline`), el pico máximo, cuántas semanas tiene actividad, y una tabla semana a semana.
- Ambas selecciones son independientes y pueden coexistir.

### `components/dotacion-sparkline.tsx` — Gráfico de curva

SVG puro (sin librería de charting externa) que dibuja una curva suavizada (bezier cúbica) a partir de puntos `{ weekNumber, total }`:
- Área de relleno con gradiente.
- Línea con puntos en cada semana.
- Punto destacado (más grande, sólido) en el pico de la curva.
- Reutilizado tanto en las cards de proyecto (dashboard y listado) como en el panel de detalle de cargo del Gantt.

### `components/new-project-form.tsx` — Wizard de creación

Formulario cliente con estado local (`useState`) para los 2 pasos. En el paso 2, el estado de cargos por semana se modela como:

```ts
type WeekData = { roles: { roleId: string; quantity: number }[] };
const [weekData, setWeekData] = useState<WeekData[]>(...)  // un elemento por semana
```

Incluye función "Copiar semana anterior" para acelerar la planificación cuando la dotación se mantiene similar semana a semana (común en proyectos de minería con curva de personal estable).

### `components/sidebar.tsx` — Navegación

Sidebar oscuro fijo con:
- Logo + nombre de la plataforma.
- Links de navegación (Dashboard, Proyectos habilitados; Empleados y Reportes marcados como "Pronto" — deshabilitados, anticipando fases futuras).
- Menú de usuario (dropdown) con accesos a configuración y `signOut()`.

### `components/project-actions.tsx` — Acciones de proyecto

Dropdown con cambios de estado (`Activo`/`Pausado`/`Completado`) y eliminación (con `confirm()` nativo del browser antes de proceder). Usa `useTransition` para mostrar estado de carga sin bloquear la UI.

---

## Autenticación y autorización

- **Modelo:** un único rol funcional implementado (`ADMIN`), aunque el campo `User.role` admite valores futuros (`SUPER_ADMIN`, `PM`, `RRHH`) sin cambios de schema — solo falta la lógica de autorización granular por rol.
- **Sesión:** JWT firmado con `NEXTAUTH_SECRET`, sin persistencia en base de datos (`strategy: "jwt"`).
- **Protección de rutas:** todo lo que no sea `/login` o `/api/*` requiere sesión válida, enforced en `proxy.ts` a nivel de Next.js (antes de que cualquier Server Component se ejecute).
- **Protección a nivel de datos:** además del proxy, cada Server Action en `lib/actions/projects.ts` valida `await auth()` y lanza si no hay sesión — defensa en profundidad ante invocaciones directas a la Server Action (son alcanzables por POST directo, no solo desde la UI).

---

## Desarrollo local

### Requisitos

- Node.js 20+
- npm

### Pasos

```bash
git clone https://github.com/benjadiaz87/dotacion.git
cd dotacion
npm install

# Crear la base de datos local y aplicar el schema
npx prisma migrate dev

# Poblar con datos demo (usuario admin + catálogo de cargos + proyecto de ejemplo)
npx tsx prisma/seed.ts

# Levantar el servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

**Credenciales demo** (creadas por el seed):
- Email: `admin@faenas.cl`
- Password: `admin123`

### Reiniciar el servidor

La mayoría de los cambios de código se recargan solos (Turbopack hot reload). Reiniciar manualmente solo es necesario tras cambios en `.env`, en `prisma/schema.prisma`, o en `proxy.ts`:

```bash
pkill -f "next dev"
npm run dev
```

### Inspeccionar la base de datos

```bash
npx prisma studio
```

Abre una UI visual en `http://localhost:5555` para ver y editar registros directamente.

---

## Variables de entorno

Archivo `.env` (no versionado, ver `.gitignore`):

```bash
DATABASE_URL="file:./dev.db"                                   # SQLite local
NEXTAUTH_SECRET="<string aleatorio largo>"                      # firma de JWT — generar con `openssl rand -base64 32`
NEXTAUTH_URL="http://localhost:3000"                             # URL pública del deploy
```

> En producción, `DATABASE_URL` debe apuntar a una instancia de PostgreSQL (ver sección de despliegue) y `NEXTAUTH_SECRET` debe ser un secreto único generado para ese ambiente — nunca reutilizar el de desarrollo.

---

## Scripts disponibles

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo con Turbopack |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm run db:seed` / `npx tsx prisma/seed.ts` | Pobla la base de datos con datos demo |
| `npx prisma migrate dev --name <nombre>` | Crea y aplica una nueva migración tras editar el schema |
| `npx prisma studio` | UI visual de la base de datos |
| `npx prisma generate` | Regenera el cliente tipado de Prisma (normalmente automático tras `migrate dev`) |

---

## Decisiones técnicas y por qué

| Decisión | Alternativa considerada | Por qué se eligió esta |
|---|---|---|
| SQLite en desarrollo | Prisma Postgres (cloud) | El conector cloud (`db.prisma.io` vía Accelerate) rechazó las credenciales generadas por `npx create-db` en este entorno; SQLite elimina toda dependencia externa para desarrollar |
| Prisma 5.x (no 7.x) | Prisma 7 (`engine: "client"`) | Prisma 7 requiere un *driver adapter* explícito (`@prisma/adapter-pg`, etc.) incluso para SQLite, lo que complicó la conexión sin aportar valor en este estado del proyecto; Prisma 5 usa el engine binario clásico con `url` directo en el schema |
| Campos `String` en vez de `enum` en Prisma | `enum` nativo de Prisma | SQLite no soporta `enum` a nivel de motor — Prisma los modela como `String` con un `CHECK` que SQLite tampoco aplica. Se documenta como deuda técnica a resolver al migrar a Postgres |
| Server Actions en vez de API REST | Route Handlers (`app/api/.../route.ts`) | Tipado end-to-end sin contrato de API manual; menos código para un equipo pequeño en el MVP |
| `proxy.ts` en vez de `middleware.ts` | — | Next.js 16 deprecó `middleware.ts` en favor de `proxy.ts` (ver warning de build); se siguió la convención nueva desde el inicio |
| shadcn/ui (Base UI) | Radix UI directo | Fue lo que el CLI de shadcn instaló en este entorno; se documentó la limitación de `asChild` para que futuros componentes no repitan el bug de `<button>` anidado |

---

## Roadmap

| Fase | Alcance |
|---|---|
| **✅ Fase 1 — MVP** | Auth, CRUD de proyectos, planificación semanal por cargo, vista Gantt, dashboard |
| **Fase 2 — Empleados** | CRUD de empleados (RUT, datos personales, cargo), asignación a proyectos por semana, Gantt con cubierto vs. pendiente |
| **Fase 3 — Documentación** | Upload de documentos por empleado, checklist por cargo, estados manuales (pendiente/aprobado/rechazado), alertas de vencimiento |
| **Fase 4 — Validación automática** | OCR (AWS Textract / Google Document AI), extracción y validación automática de campos, jobs asíncronos |
| **Fase 5 — Contratos automáticos** | Templates por cargo, generación de PDF con datos del empleado, firma digital |

### Para escalar a miles de empleados por proyecto (mineras grandes)

La arquitectura actual de monolito Next.js + Server Actions es apta para el volumen del MVP. Al crecer a miles de empleados por proyecto y múltiples clientes (mineras) simultáneos, se recomienda:
- Migrar a **PostgreSQL** con esquema separado por tenant (cada minera = un schema), para aislamiento de datos.
- Extraer **jobs pesados** (validación de documentos, generación de contratos) a una cola (BullMQ + Redis) en vez de ejecutarlos sincrónicamente en la Server Action.
- Si el equipo crece, separar `lib/actions/*` en servicios independientes (es el límite natural ya existente en el código).

---

## Despliegue a producción

> **No desplegar con SQLite.** SQLite vive en el disco del proceso — en plataformas serverless (Vercel) el filesystem no persiste entre invocaciones, y en cualquier despliegue con más de una instancia los datos quedarían inconsistentes entre réplicas.

Pasos para producción:

1. Provisionar una base de datos **PostgreSQL** (Supabase, Neon, Railway, RDS, etc.)
2. Actualizar `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   y volver a tipar como `enum` los campos `role`, `status`, `category` (ver tabla de decisiones técnicas).
3. Actualizar `DATABASE_URL` en las variables de entorno del hosting con la connection string de Postgres.
4. Ejecutar `npx prisma migrate deploy` (no `migrate dev`) contra la base de producción.
5. Generar un `NEXTAUTH_SECRET` único para producción.
6. Desplegar (Vercel es la integración más directa para Next.js).
