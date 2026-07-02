import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const cedula = await prisma.documentType.findUniqueOrThrow({
    where: { name: "Cédula de Identidad" },
  });

  // Pool ampliado de trabajadores (incluye los 5 ya existentes + nuevos)
  const newWorkers = [
    { rut: "17.890.123-4", fullName: "Roberto Castillo Herrera", role: "Operador de Bulldozer", habilitado: true },
    { rut: "18.901.234-5", fullName: "Francisca Salinas Ortiz", role: "Operador de Bulldozer", habilitado: true },
    { rut: "19.012.345-6", fullName: "Diego Hernández Ramos", role: "Operador de Bulldozer", habilitado: false },
    { rut: "20.123.456-7", fullName: "Camila Espinoza Flores", role: "Operador de Bulldozer", habilitado: true },
    { rut: "21.234.567-8", fullName: "Matías Contreras Silva", role: "Prevencionista de Riesgos", habilitado: true },
    { rut: "22.345.678-9", fullName: "Valentina Reyes Cárdenas", role: "Prevencionista de Riesgos", habilitado: false },
    { rut: "23.456.789-0", fullName: "Sebastián Morales Vidal", role: "Prevencionista de Riesgos", habilitado: true },
    { rut: "24.567.890-1", fullName: "Javiera Núñez Bravo", role: "Jefe de Oficina Técnica", habilitado: true },
    { rut: "25.678.901-2", fullName: "Cristóbal Pizarro Leiva", role: "Jefe de Oficina Técnica", habilitado: true },
    { rut: "26.789.012-3", fullName: "Antonia Vargas Tapia", role: "Jefe de Oficina Técnica", habilitado: false },
    { rut: "27.890.123-4", fullName: "Ignacio Sandoval Maturana", role: "Operador de Bulldozer", habilitado: true },
    { rut: "28.901.234-5", fullName: "Fernanda Araya Cortés", role: "Operador de Bulldozer", habilitado: true },
  ];

  const createdWorkers: { id: string; role: string }[] = [];

  for (const w of newWorkers) {
    const worker = await prisma.worker.upsert({
      where: { rut: w.rut },
      update: { fullName: w.fullName },
      create: { rut: w.rut, fullName: w.fullName },
    });
    createdWorkers.push({ id: worker.id, role: w.role });

    if (w.habilitado) {
      await prisma.workerDocument.upsert({
        where: { workerId_documentTypeId: { workerId: worker.id, documentTypeId: cedula.id } },
        update: { status: "APPROVED" },
        create: {
          workerId: worker.id,
          documentTypeId: cedula.id,
          fileUrl: "/uploads/demo-cedula.pdf",
          fileName: "cedula-demo.pdf",
          status: "APPROVED",
        },
      });
    }
  }

  // Asignar algunos al proyecto demo existente (Atacama Norte) en semanas con mayor necesidad
  const atacama = await prisma.project.findUnique({
    where: { id: "demo-project-1" },
    include: { weekPlans: { orderBy: { weekNumber: "asc" } } },
  });

  if (atacama) {
    const peakWeeks = atacama.weekPlans.filter((wp) => wp.weekNumber >= 3 && wp.weekNumber <= 6);
    for (const cw of createdWorkers.filter((c) => c.role === "Operador de Bulldozer").slice(0, 4)) {
      for (const wp of peakWeeks) {
        await prisma.workerAssignment.upsert({
          where: { workerId_weekPlanId: { workerId: cw.id, weekPlanId: wp.id } },
          update: { roleId: roleMap[cw.role] },
          create: { workerId: cw.id, weekPlanId: wp.id, roleId: roleMap[cw.role] },
        });
      }
    }
  }

  // Asignar al proyecto "Test Benja" en todas sus semanas
  const testBenja = await prisma.project.findFirst({
    where: { name: "Test Benja" },
    include: { weekPlans: { orderBy: { weekNumber: "asc" } } },
  });

  if (testBenja) {
    const assignToTestBenja = [
      ...createdWorkers.filter((c) => c.role === "Jefe de Oficina Técnica"),
      ...createdWorkers.filter((c) => c.role === "Prevencionista de Riesgos"),
      ...createdWorkers.filter((c) => c.role === "Operador de Bulldozer").slice(4),
    ];

    for (const cw of assignToTestBenja) {
      for (const wp of testBenja.weekPlans) {
        await prisma.workerAssignment.upsert({
          where: { workerId_weekPlanId: { workerId: cw.id, weekPlanId: wp.id } },
          update: { roleId: roleMap[cw.role] },
          create: { workerId: cw.id, weekPlanId: wp.id, roleId: roleMap[cw.role] },
        });
      }
    }
  }

  const totalWorkers = await prisma.worker.count();
  console.log(`✅ ${newWorkers.length} trabajadores nuevos creados. Total en BD: ${totalWorkers}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
