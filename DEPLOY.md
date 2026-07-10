# Deploy en Railway

Dotia se despliega como **dos servicios** del mismo repo dentro de un proyecto
Railway, más **un volumen** para los datos persistentes.

```
Proyecto Railway "dotia"
├── Servicio "app"          (root: /,             Next.js + Prisma/SQLite)
│     └── Volumen montado en /data   (base de datos + documentos subidos)
└── Servicio "verificador"  (root: /verificador,  Fastify + puppeteer, Dockerfile)
```

## 1. Servicio `app` (Next.js)

- **Source**: este repo, branch `dev` (o `main` cuando se promueva), **Root Directory** `/`.
- **Build**: automático con Nixpacks (`npm install && npm run build`).
- **Start command**: `sh scripts/railway-start.sh`
  (enlaza `public/uploads` al volumen, corre `prisma migrate deploy` y levanta Next).
- **Volumen**: crear uno y montarlo en `/data`.
- **Variables**:

  | Variable | Valor |
  |---|---|
  | `DATABASE_URL` | `file:/data/dotia.db` |
  | `NEXTAUTH_URL` | `https://<dominio-del-servicio>` |
  | `NEXTAUTH_SECRET` | generar con `openssl rand -base64 32` (NO reutilizar el de dev) |
  | `AUTH_TRUST_HOST` | `true` |
  | `VERIFICADOR_URL` | `http://verificador.railway.internal:3001` |

- **Networking**: Generate Domain (Railway da HTTPS automático). Con HTTPS
  funcionan la cámara del navegador y los magic links compartibles.

## 2. Servicio `verificador`

- **Source**: mismo repo, **Root Directory** `/verificador`. Railway detecta el
  `Dockerfile` (Chromium del sistema para puppeteer).
- **Sin dominio público** — solo se accede por private networking desde `app`.
- **Variables**:

  | Variable | Valor |
  |---|---|
  | `ANTHROPIC_API_KEY` | key de producción |
  | `TWOCAPTCHA_KEY` | key de 2captcha (verificación Registro Civil) |
  | `PORT` | `3001` |

## 3. Primera puesta en marcha

1. Con la app arriba, poblar datos iniciales (usuarios): abrir un shell del
   servicio `app` en Railway y correr `npm run db:seed`, o crear los usuarios
   a mano. El seed crea también los datos demo.
2. Verificar el flujo completo: login → ficha de trabajador → subir documento
   → "Validar todos los documentos pendientes".

## Notas operativas

- **Respaldos**: el volumen contiene `dotia.db` y `uploads/` con documentos
  personales sensibles (RUTs, antecedentes). Programar respaldo periódico
  (Railway CLI: `railway volume ...` o un cron que suba un tar a S3/Backblaze).
- **Recursos**: el verificador levanta Chromium; asignarle al menos 1 GB de RAM.
- **Escala**: SQLite sirve para un piloto de equipo. Si crece el uso concurrente,
  migrar `DATABASE_URL` a Postgres de Railway (Prisma lo soporta cambiando el
  provider) y los uploads a S3.
