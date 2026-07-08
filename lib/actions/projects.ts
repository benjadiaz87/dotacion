"use server";

import { assertCanWrite } from "@/lib/authz";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  client: z.string().optional(),
  startDate: z.string().min(1),
  weeks: z.coerce.number().int().min(1).max(104),
});

export type WeekPlanInput = {
  weekNumber: number;
  roles: { roleId: string; quantity: number }[];
};

export async function createProject(
  data: z.infer<typeof projectSchema>,
  weekPlans: WeekPlanInput[]
) {
  await assertCanWrite();
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const parsed = projectSchema.parse(data);

  const project = await db.project.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      location: parsed.location,
      client: parsed.client,
      startDate: new Date(parsed.startDate),
      weeks: parsed.weeks,
      userId: session.user.id,
      weekPlans: {
        create: weekPlans.map((wp) => {
          const start = new Date(parsed.startDate);
          start.setDate(start.getDate() + (wp.weekNumber - 1) * 7);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          return {
            weekNumber: wp.weekNumber,
            startDate: start,
            endDate: end,
            requirements: {
              create: wp.roles
                .filter((r) => r.quantity > 0)
                .map((r) => ({ roleId: r.roleId, quantity: r.quantity })),
            },
          };
        }),
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/proyectos");
  redirect(`/dashboard/proyectos/${project.id}`);
}

export async function updateProjectStatus(id: string, status: string) {
  await assertCanWrite();
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  await db.project.update({ where: { id }, data: { status: status as never } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/proyectos");
}

export async function deleteProject(id: string) {
  await assertCanWrite();
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  await db.project.delete({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/proyectos");
}

export async function getProjects() {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Superadmin y Auditor ven todos los proyectos; Admin solo los propios
  const role = (session.user as { role?: string }).role;
  const seesAll = role === "SUPERADMIN" || role === "AUDITOR";

  return db.project.findMany({
    where: seesAll ? {} : { userId: session.user.id },
    include: {
      weekPlans: {
        include: { requirements: { include: { role: true } } },
        orderBy: { weekNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      weekPlans: {
        include: { requirements: { include: { role: true } } },
        orderBy: { weekNumber: "asc" },
      },
    },
  });
}

export async function getRoles() {
  return db.role.findMany({ orderBy: { category: "asc" } });
}
