"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { assertSuperadmin, ROLES, type AppRole } from "@/lib/authz";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  isSelf: boolean;
};

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  await assertSuperadmin();
  const session = await auth();
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    isSelf: u.id === session?.user?.id,
  }));
}

const createUserSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(ROLES),
});

export async function createPlatformUser(data: {
  name: string;
  email: string;
  password: string;
  role: AppRole;
}) {
  await assertSuperadmin();
  const parsed = createUserSchema.parse(data);

  const existing = await db.user.findUnique({ where: { email: parsed.email } });
  if (existing) throw new Error("Ya existe un usuario con ese email");

  const hash = await bcrypt.hash(parsed.password, 12);
  await db.user.create({
    data: { name: parsed.name, email: parsed.email, password: hash, role: parsed.role },
  });

  revalidatePath("/dashboard/acceso");
  return { ok: true };
}
