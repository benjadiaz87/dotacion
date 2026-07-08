import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STAGES = [
  { order: 1, name: "Evaluación Documental",   type: "PROCESO", description: "7 documentos precontratación entregados por el candidato" },
  { order: 2, name: "Evaluación Previa",        type: "PROCESO", description: "Exámenes, capacitaciones y certificaciones antes de contratar" },
  { order: 3, name: "Proceso de Contratación", type: "PROCESO", description: "Generación y firma de contratos y documentos asociados" },
  { order: 4, name: "Proceso de Habilitación", type: "PROCESO", description: "Registro en plataforma, pase de manejo, acceso faena, alta ERP" },
];

const STAGE_DOCS: { stageName: string; docs: { name: string; required: boolean }[] }[] = [
  {
    stageName: "Evaluación Documental",
    docs: [
      { name: "Cédula de Identidad",           required: true },
      { name: "Certificado de Antecedentes",   required: true },
      { name: "Licencia de conducir vigente",  required: false },
      { name: "Credencial SNS",                required: true },
      { name: "Credencial Sernageomin",         required: true },
      { name: "Hoja de vida",                  required: true },
      { name: "Título profesional/Técnico",    required: true },
    ],
  },
  {
    stageName: "Evaluación Previa",
    docs: [
      { name: "Inducción hombre nuevo",                            required: true },
      { name: "Certificación de competencias",                     required: true },
      { name: "Certificación de operador de equipo",               required: false },
      { name: "Capacitación trabajo en altura física",             required: true },
      { name: "Exámenes Preocupacionales",                         required: true },
      { name: "Evaluación psicosensotécnica",                      required: false },
      { name: "Examen de Aptitud Altura Geográfica (≥3.000 msnm)", required: true },
      { name: "Espirometría basal",                                required: true },
      { name: "Audiometría basal",                                 required: true },
      { name: "Rx tórax",                                         required: true },
      { name: "Test de drogas y alcohol",                          required: true },
      { name: "Capacitación Trabajo en Altura Física (≥1.8 m)",   required: true },
      { name: "Capacitación Espacios Confinados",                  required: true },
      { name: "Capacitación Manejo de Sustancias Peligrosas",      required: true },
      { name: "Capacitación Primeros Auxilios Básicos",            required: true },
      { name: "Manejo defensivo para conductores",                 required: false },
      { name: "Examen Psicolaboral",                               required: true },
    ],
  },
  {
    stageName: "Proceso de Contratación",
    docs: [
      { name: "Contrato de Trabajo",              required: true },
      { name: "ODI firmada",                      required: true },
      { name: "Afiliación mutualidad",            required: true },
      { name: "EPP entregado y firmado",          required: true },
      { name: "RIOHS entregado y firmado",        required: true },
      { name: "Afiliación AFP vigente",           required: true },
      { name: "Afiliación salud (Isapre/Fonasa)", required: true },
    ],
  },
  {
    stageName: "Proceso de Habilitación",
    docs: [
      { name: "Registro en plataforma contratista", required: true },
      { name: "Pase de manejo interno",             required: true },
      { name: "Acceso permitido a faena",           required: true },
      { name: "Alta en sistema ERP",                required: true },
    ],
  },
];

// 20 empleados con distribución tipo embudo (más en etapas iniciales)
const WORKERS_DEMO = [
  // Etapa 1 — Evaluación Documental (7)
  { rut: "17.234.561-K", fullName: "Rodrigo Espinoza Morales",   role: "Operador de Bulldozer",     stage: 1, docsApproved: [] },
  { rut: "18.345.672-3", fullName: "Felipe Contreras Soto",      role: "Operador de Bulldozer",     stage: 1, docsApproved: [] },
  { rut: "19.456.783-5", fullName: "Cristian Vásquez Díaz",      role: "Operador de Bulldozer",     stage: 1, docsApproved: ["Cédula de Identidad"] },
  { rut: "20.567.894-7", fullName: "Marcelo Fuentes Rojas",      role: "Prevencionista de Riesgos", stage: 1, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes"] },
  { rut: "21.678.905-9", fullName: "Ignacio Herrera Pinto",      role: "Operador de Bulldozer",     stage: 1, docsApproved: [] },
  { rut: "22.789.016-1", fullName: "Sebastián Moya Lazo",        role: "Jefe de Oficina Técnica",   stage: 1, docsApproved: ["Cédula de Identidad"] },
  { rut: "23.890.127-3", fullName: "Tomás Pereira Cáceres",      role: "Operador de Bulldozer",     stage: 1, docsApproved: [] },

  // Etapa 2 — Evaluación Previa (5)
  { rut: "12.901.238-5", fullName: "Andrés Salinas Vergara",     role: "Operador de Bulldozer",     stage: 2, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes", "Hoja de vida", "Credencial SNS", "Credencial Sernageomin"] },
  { rut: "13.012.349-7", fullName: "Diego Castro Núñez",         role: "Prevencionista de Riesgos", stage: 2, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes"] },
  { rut: "14.123.450-9", fullName: "Camilo Reyes Flores",        role: "Operador de Bulldozer",     stage: 2, docsApproved: ["Cédula de Identidad", "Hoja de vida"] },
  { rut: "15.234.561-1", fullName: "Javiera Moreno Espinoza",    role: "Jefe de Oficina Técnica",   stage: 2, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes", "Credencial SNS"] },
  { rut: "16.345.672-3", fullName: "Valentina Torres Araya",     role: "Prevencionista de Riesgos", stage: 2, docsApproved: ["Cédula de Identidad"] },

  // Etapa 3 — Proceso de Contratación (3)
  { rut: "12.456.783-5", fullName: "Roberto Muñoz Castillo",     role: "Operador de Bulldozer",     stage: 3, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes", "Hoja de vida"] },
  { rut: "13.567.894-7", fullName: "Patricia Leiva Gutiérrez",   role: "Jefe de Oficina Técnica",   stage: 3, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes"] },
  { rut: "14.678.905-9", fullName: "Eduardo Silva Bravo",        role: "Operador de Bulldozer",     stage: 3, docsApproved: ["Cédula de Identidad"] },

  // Etapa 4 — Proceso de Habilitación (2)
  { rut: "15.789.016-1", fullName: "Carolina Ramírez Vidal",     role: "Prevencionista de Riesgos", stage: 4, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes"] },
  { rut: "16.890.127-3", fullName: "Héctor Jiménez Saavedra",    role: "Operador de Bulldozer",     stage: 4, docsApproved: ["Cédula de Identidad"] },

  // Habilitados — completaron todo el pipeline (stage=5 = done) (3)
  { rut: "15.678.901-2", fullName: "Ana Torres Vega",            role: "Prevencionista de Riesgos", stage: 5, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes"] },
  { rut: "13.456.789-0", fullName: "Luis Fernández Rojas",       role: "Operador de Bulldozer",     stage: 5, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes"] },
  { rut: "16.766.409-1", fullName: "Benjamín Díaz Fuentes",      role: "Jefe de Oficina Técnica",   stage: 5, docsApproved: ["Cédula de Identidad", "Certificado de Antecedentes"] },
];

async function main() {
  const hash = await bcrypt.hash("admin123", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@faenas.cl" },
    update: {},
    create: { email: "admin@faenas.cl", name: "Administrador", password: hash, role: "ADMIN" as string },
  });

  // ── Roles ──────────────────────────────────────────────────────────────────
  const roles = [
    { name: "Jefe de Oficina Técnica",   category: "SUPERVISION"     as const, color: "#10b981" },
    { name: "Operador de Bulldozer",     category: "OPERATIVO"       as const, color: "#3b82f6" },
    { name: "Prevencionista de Riesgos", category: "ADMINISTRATIVO"  as const, color: "#f59e0b" },
  ];
  const obsoleteRoles = await prisma.role.findMany({ where: { name: { notIn: roles.map((r) => r.name) } } });
  if (obsoleteRoles.length > 0) {
    const ids = obsoleteRoles.map((r) => r.id);
    await prisma.roleRequirement.deleteMany({ where: { roleId: { in: ids } } });
    await prisma.role.deleteMany({ where: { id: { in: ids } } });
  }
  for (const r of roles) {
    await prisma.role.upsert({ where: { name: r.name }, update: { category: r.category, color: r.color }, create: r });
  }
  const allRoles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));

  // ── Etapas ─────────────────────────────────────────────────────────────────
  for (const s of STAGES) {
    await prisma.stage.upsert({ where: { order: s.order }, update: s, create: s });
  }
  const stageMap = Object.fromEntries((await prisma.stage.findMany()).map((s) => [s.name, s]));

  // ── DocumentTypes + StageDocRequirements ───────────────────────────────────
  for (const { stageName, docs } of STAGE_DOCS) {
    const stage = stageMap[stageName];
    if (!stage) continue;
    for (const doc of docs) {
      await prisma.documentType.upsert({ where: { name: doc.name }, update: { required: doc.required }, create: { name: doc.name, required: doc.required } });
      const dt = await prisma.documentType.findUniqueOrThrow({ where: { name: doc.name } });
      const existing = await prisma.stageDocRequirement.findFirst({ where: { stageId: stage.id, documentTypeId: dt.id, roleId: null } });
      if (!existing) {
        await prisma.stageDocRequirement.create({ data: { stageId: stage.id, documentTypeId: dt.id, roleId: null } });
      }
    }
  }

  // ── Proyectos demo ─────────────────────────────────────────────────────────
  const start1 = new Date("2025-02-03");
  const project1 = await prisma.project.upsert({
    where: { id: "demo-project-1" },
    update: {},
    create: { id: "demo-project-1", name: "Proyecto Minero Atacama Norte", description: "Extracción de cobre en sector norte", location: "Atacama, Chile", client: "Minera Norte S.A.", startDate: start1, weeks: 8, status: "ACTIVE", userId: user.id },
  });

  const start2 = new Date("2025-03-10");
  const project2 = await prisma.project.upsert({
    where: { id: "demo-project-2" },
    update: {},
    create: { id: "demo-project-2", name: "Faena El Teniente — Expansión", description: "Obras de expansión túnel sur", location: "Rancagua, Chile", client: "Codelco El Teniente", startDate: start2, weeks: 12, status: "ACTIVE", userId: user.id },
  });

  const weeklyTemplate = (n: number) => Array.from({ length: n }, (_, i) => ({
    weekNumber: i + 1,
    roles: [
      { name: "Jefe de Oficina Técnica",   qty: i < 4 ? 1 : 2 },
      { name: "Operador de Bulldozer",      qty: 4 + i * 2 },
      { name: "Prevencionista de Riesgos", qty: i < 6 ? 1 : 2 },
    ],
  }));

  for (const [project, start, nWeeks] of [[project1, start1, 8], [project2, start2, 12]] as const) {
    for (const plan of weeklyTemplate(nWeeks)) {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + (plan.weekNumber - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const wp = await prisma.weekPlan.upsert({
        where: { projectId_weekNumber: { projectId: project.id, weekNumber: plan.weekNumber } },
        update: {},
        create: { weekNumber: plan.weekNumber, startDate: weekStart, endDate: weekEnd, projectId: project.id },
      });
      for (const r of plan.roles) {
        if (!roleMap[r.name]) continue;
        await prisma.roleRequirement.upsert({
          where: { weekPlanId_roleId: { weekPlanId: wp.id, roleId: roleMap[r.name] } },
          update: { quantity: r.qty },
          create: { weekPlanId: wp.id, roleId: roleMap[r.name], quantity: r.qty },
        });
      }
    }
  }

  // ── Trabajadores ───────────────────────────────────────────────────────────
  const dtMap = Object.fromEntries((await prisma.documentType.findMany()).map((d) => [d.name, d.id]));
  const weekPlans1 = await prisma.weekPlan.findMany({ where: { projectId: project1.id } });
  const weekPlans2 = await prisma.weekPlan.findMany({ where: { projectId: project2.id } });

  for (const [i, w] of WORKERS_DEMO.entries()) {
    const worker = await prisma.worker.upsert({
      where: { rut: w.rut },
      update: { fullName: w.fullName, currentStageOrder: w.stage },
      create: { rut: w.rut, fullName: w.fullName, currentStageOrder: w.stage },
    });

    // Upload approved docs
    for (const docName of w.docsApproved) {
      const dtId = dtMap[docName];
      if (!dtId) continue;
      await prisma.workerDocument.upsert({
        where: { workerId_documentTypeId: { workerId: worker.id, documentTypeId: dtId } },
        update: { status: "APPROVED" },
        create: { workerId: worker.id, documentTypeId: dtId, fileUrl: `/uploads/demo-${docName.toLowerCase().replace(/\s/g, "-")}.pdf`, fileName: `${docName}.pdf`, status: "APPROVED" },
      });
    }

    // Assign habilitados (stage 7) and contratados (stage 5+) to projects
    if (w.stage >= 5) {
      const roleId = roleMap[w.role];
      if (roleId) {
        const plans = i % 2 === 0 ? weekPlans1 : weekPlans2;
        for (const wp of plans.slice(0, 4)) {
          await prisma.workerAssignment.upsert({
            where: { workerId_weekPlanId: { workerId: worker.id, weekPlanId: wp.id } },
            update: { roleId },
            create: { workerId: worker.id, weekPlanId: wp.id, roleId },
          });
        }
      }
    }
  }

  console.log("✅ Seed completado — 20 empleados, 2 proyectos, 7 etapas");
  console.log("   admin@faenas.cl / admin123");
}

main().catch(console.error).finally(() => prisma.$disconnect());
