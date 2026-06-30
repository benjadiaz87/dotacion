# Dotación de Faenas

Plataforma para gestionar la dotación de personal en faenas mineras y constructivas. Permite crear proyectos, planificar cargos requeridos semana a semana, y visualizar todo en una carta Gantt interactiva.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **Tailwind CSS** + **shadcn/ui** (base-ui)
- **Prisma** + **SQLite** (desarrollo local)
- **NextAuth v5** (credentials + JWT)

## Funcionalidades

- Login de administrador
- Dashboard con proyectos vigentes y KPIs
- Wizard de creación de proyectos: duración en semanas + cargos requeridos por semana
- Vista Gantt por proyecto: cargos × semanas, con detalle al hacer clic en una semana o en un cargo
- Curva de dotación (sparkline) por proyecto

## Desarrollo local

```bash
npm install
npx prisma migrate dev
npx tsx prisma/seed.ts   # datos demo
npm run dev
```

Credenciales demo tras el seed:
- **Email:** `admin@faenas.cl`
- **Password:** `admin123`

## Roadmap

- Gestión de empleados individuales y asignación a proyectos
- Carga y validación de documentación
- Generación automática de contratos
