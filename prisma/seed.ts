import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("admin123", 12);

  const user = await prisma.user.upsert({
    where: { email: "admin@faenas.cl" },
    update: {},
    create: {
      email: "admin@faenas.cl",
      name: "Administrador",
      password: hash,
      role: "ADMIN" as string,
    },
  });

  const roles = [
    { name: "Jefe de Oficina Técnica", category: "SUPERVISION" as const, color: "#10b981" },
    { name: "Operador de Bulldozer", category: "OPERATIVO" as const, color: "#3b82f6" },
    { name: "Prevencionista de Riesgos", category: "ADMINISTRATIVO" as const, color: "#f59e0b" },
  ];

  // Eliminar cargos que ya no están en el catálogo vigente (y sus requerimientos asociados)
  const obsoleteRoles = await prisma.role.findMany({
    where: { name: { notIn: roles.map((r) => r.name) } },
  });
  const obsoleteIds = obsoleteRoles.map((r) => r.id);
  if (obsoleteIds.length > 0) {
    await prisma.roleRequirement.deleteMany({ where: { roleId: { in: obsoleteIds } } });
    await prisma.role.deleteMany({ where: { id: { in: obsoleteIds } } });
  }

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { category: role.category, color: role.color },
      create: role,
    });
  }

  // Proyecto demo
  const allRoles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));

  const start = new Date("2025-02-03");
  const project = await prisma.project.upsert({
    where: { id: "demo-project-1" },
    update: {},
    create: {
      id: "demo-project-1",
      name: "Proyecto Minero Atacama Norte",
      description: "Extracción de cobre en sector norte del yacimiento",
      location: "Atacama, Chile",
      client: "Minera Norte S.A.",
      startDate: start,
      weeks: 8,
      status: "ACTIVE",
      userId: user.id,
    },
  });

  const weeklyPlans = [
    {
      weekNumber: 1,
      roles: [
        { name: "Jefe de Oficina Técnica", qty: 1 },
        { name: "Operador de Bulldozer", qty: 4 },
        { name: "Prevencionista de Riesgos", qty: 1 },
      ],
    },
    {
      weekNumber: 2,
      roles: [
        { name: "Jefe de Oficina Técnica", qty: 1 },
        { name: "Operador de Bulldozer", qty: 6 },
        { name: "Prevencionista de Riesgos", qty: 1 },
      ],
    },
    {
      weekNumber: 3,
      roles: [
        { name: "Jefe de Oficina Técnica", qty: 2 },
        { name: "Operador de Bulldozer", qty: 9 },
        { name: "Prevencionista de Riesgos", qty: 2 },
      ],
    },
    {
      weekNumber: 4,
      roles: [
        { name: "Jefe de Oficina Técnica", qty: 2 },
        { name: "Operador de Bulldozer", qty: 12 },
        { name: "Prevencionista de Riesgos", qty: 2 },
      ],
    },
    {
      weekNumber: 5,
      roles: [
        { name: "Jefe de Oficina Técnica", qty: 2 },
        { name: "Operador de Bulldozer", qty: 14 },
        { name: "Prevencionista de Riesgos", qty: 3 },
      ],
    },
    {
      weekNumber: 6,
      roles: [
        { name: "Jefe de Oficina Técnica", qty: 2 },
        { name: "Operador de Bulldozer", qty: 16 },
        { name: "Prevencionista de Riesgos", qty: 3 },
      ],
    },
    {
      weekNumber: 7,
      roles: [
        { name: "Jefe de Oficina Técnica", qty: 1 },
        { name: "Operador de Bulldozer", qty: 10 },
        { name: "Prevencionista de Riesgos", qty: 2 },
      ],
    },
    {
      weekNumber: 8,
      roles: [
        { name: "Jefe de Oficina Técnica", qty: 1 },
        { name: "Operador de Bulldozer", qty: 5 },
        { name: "Prevencionista de Riesgos", qty: 1 },
      ],
    },
  ];

  for (const plan of weeklyPlans) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (plan.weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const wp = await prisma.weekPlan.upsert({
      where: { projectId_weekNumber: { projectId: project.id, weekNumber: plan.weekNumber } },
      update: {},
      create: {
        weekNumber: plan.weekNumber,
        startDate: weekStart,
        endDate: weekEnd,
        projectId: project.id,
      },
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

  console.log("✅ Seed completado");
  console.log("   Email: admin@faenas.cl");
  console.log("   Password: admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
