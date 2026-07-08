# 🎬 Guión de Demo — DotaciónFaenas (~15 min)

> **La historia que vendemos:** "Hoy habilitar a un trabajador para faena es un Excel,
> 40 documentos en carpetas y semanas de correos. DotaciónFaenas lo convierte en un
> pipeline visual tipo CRM, con autoservicio del trabajador y verificación automática
> contra el Registro Civil."

---

## ✅ Checklist pre-demo (5 min antes)

```bash
cd dotacion-faenas
npm run dev                      # → http://localhost:3000
# Microservicio verificador (si se demostrará verificación RC):
cd dotacion-verificador && npm run dev   # puerto 3001
```

- [ ] Servidor arriba y dashboard carga
- [ ] Hay ≥3 documentos PENDING (para el banner ámbar): si no, marcar alguno desde un pipeline
- [ ] Un trabajador en **Etapa 4 con todo aprobado** (para el confetti de habilitación en vivo)
- [ ] Foto de carnet de prueba en el teléfono o escritorio (para el magic link)
- [ ] Ventana de incógnito lista (simula el teléfono del trabajador)
- [ ] Zoom del navegador 100%, modo claro

**Credenciales:**

| Rol | Email | Contraseña |
|---|---|---|
| Superadmin | superadmin@faenas.cl | super123 |
| Admin | admin@faenas.cl | admin123 |
| Auditor (solo lectura) | auditor@faenas.cl | auditor123 |

---

## Acto 1 — Login (30 seg)

1. Abrir `/login`. **Dejar respirar 3 segundos**: aurora animada, stats que cuentan (120+, 8.500+).
2. Clic en **"Explorar con cuenta demo"** → entra solo.

> 💬 *"Un clic y estamos dentro. Sin instalación, corre en cualquier navegador."*

## Acto 2 — Dashboard: el pulso de la operación (2 min)

Al cargar, **no hablar por 5 segundos** — dejar que los números cuenten hacia arriba
y el embudo crezca en cascada.

Recorrer en orden:
1. **Badge "Operación en vivo"** pulsando — 35 trabajadores en pipeline.
2. **4 KPIs**: total, habilitados, en proceso y el **anillo de cobertura de dotación**.
   > 💬 *"Este es el número que le importa al gerente: contratados versus dotación
   > requerida esta semana, en un solo vistazo, con semáforo."*
3. **Embudo de habilitación**: 12 → 8 → 5 → 4 y tasa de habilitación.
   > 💬 *"Cada trabajador avanza por 4 etapas: Evaluación Documental, Evaluación
   > Previa, Contratación y Habilitación. Como un CRM de ventas, pero de personas."*
4. **Banner ámbar "N documentos esperando revisión"** — clic NO todavía, solo mencionarlo:
   > 💬 *"Esto llegó solo: trabajadores subieron documentos desde su teléfono. Ya volvemos."*

## Acto 3 — Pipeline del trabajador: el corazón (3 min)

1. **⌘K** → escribir "Pedro" → Enter.
   > 💬 *"Búsqueda global desde cualquier pantalla, por nombre o RUT."*
2. Mostrar la **ficha tipo Salesforce**: chevrons de etapas, flags
   **Acreditado / Contratado / Habilitado**, KPIs de docs.
3. Clic en una **etapa futura** (gris): *"puedes ver qué se le va a exigir más adelante"*.
4. Volver a la etapa actual → señalar el banner **"Siguiente acción"**:
   > 💬 *"El sistema siempre te dice qué hacer ahora: revisar 2 documentos, pedir uno faltante…"*
5. **Aprobar** un documento pendiente → la barra de progreso sube animada.
6. Con el trabajador preparado (Etapa 4 completa): **"Completar y avanzar"** → 🎉 **confetti masivo**
   y los 3 flags se encienden.
   > 💬 *"Habilitado para faena. Y esto alimenta el pool disponible del dashboard al instante."*

## Acto 4 — Magic Link: el killer feature (3 min)

1. Abrir un trabajador en **Etapa 1** → sección "Enlace de carga para el trabajador"
   → **Generar enlace** → **Copiar**.
   > 💬 *"El trabajador no necesita cuenta ni contraseña. Le mandas esto por WhatsApp."*
2. Pegar en **ventana incógnito** (idealmente modo responsive/móvil):
   portal con su nombre, progreso y lista de documentos.
3. Subir la **foto del carnet** → mostrar el pipeline visual:
   **extracción con IA (Claude Vision) → verificación en Registro Civil → aprobado**.
   > 💬 *"Leyó el RUT y el número de documento con IA y lo validó contra el Registro
   > Civil, con CAPTCHA resuelto automáticamente. Cero digitación, cero fraude."*
4. Si el microservicio no está arriba: subir un PDF cualquiera → queda "En revisión".

## Acto 5 — El loop se cierra (30 seg)

Volver al dashboard (como admin): el **banner ámbar** ahora incluye lo recién subido.
Clic → tabla de empleados con el **badge pulsante** en la fila del trabajador.

> 💬 *"RRHH nunca más persigue papeles: los documentos llegan solos y la bandeja
> te dice exactamente dónde mirar."*

## Acto 6 — Proyectos y dotación (2 min)

1. Sidebar → **Proyectos**: hero con cobertura global + cards con barra de cobertura
   por faena (semáforo) y curva de dotación.
2. Entrar a **Atacama Norte**: anillo de cobertura de la semana, avance del proyecto
   con shimmer, tabs **Dotación / Carta Gantt** (el pill se desliza).
3. **Asignar trabajador**: buscar → solo los **habilitados** aparecen asignables.
   > 💬 *"Nadie entra a faena sin estar habilitado — la regla vive en el sistema."*

## Acto 7 — Superadmin: Cargos y Acceso (2.5 min)

**Cerrar sesión → entrar como superadmin** (aparecen 2 pestañas nuevas).

1. **Cargos** → **Crear nuevo cargo** ("Operador de Grúa Torre", color, categoría)
   → aterriza en su pipeline vacío.
2. **Etapa 1**: tarjeta violeta con los **7 documentos recomendados prellenados** →
   "Prellenar 7 documentos".
3. **Etapa 2**: "Crear nuevo documento" → *"Certificación de grúa torre"* → añadido.
   > 💬 *"Cada cargo define sus propias exigencias por etapa. Y al cambiar un requisito,
   > el sistema recalcula el pipeline de los 35 trabajadores al instante."*
4. **Acceso**: mostrar los 3 niveles (Superadmin / Admin / Auditor) y crear un usuario en vivo.

## Acto 8 — Auditor: gobernanza (1 min)

Login como **auditor@faenas.cl** en otra ventana:
- Ve todo: dashboard, proyectos, pipelines completos.
- **Cero botones**: no puede aprobar, asignar, crear ni eliminar.
> 💬 *"Perfil de solo lectura para RRHH corporativo o el mandante: transparencia
> total sin riesgo de que toquen nada. Y no es solo visual — el servidor rechaza
> cualquier intento de escritura."*

## Cierre (30 seg)

> 💬 *"De un Excel con 40 columnas a esto: pipeline visual, autoservicio del
> trabajador, verificación con IA contra el Registro Civil, requisitos por cargo
> y control de acceso por roles. Todo lo que vieron está funcionando hoy."*

---

## 🧯 Plan B / notas

- **Verificación RC falla** (CAPTCHA/microservicio): el doc queda "En revisión" →
  aprobarlo manual y seguir. Frase: *"la verificación automática reintenta sola;
  mientras tanto RRHH puede aprobar manual"*.
- **Confetti no dispara**: solo ocurre al avanzar de etapa; ten al trabajador de
  Etapa 4 listo ANTES de la demo.
- **⌘K en Windows**: Ctrl+K, o el botón "Buscar…" del sidebar.
- **Reset rápido de datos**: `npx prisma db seed` (recrea etapas, docs y 20 workers base).
- No mostrar: página de reportes si no se pobló, configuración (link muerto del menú de usuario).
