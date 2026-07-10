"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { assertCanWrite } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type FeatureRequestItem = {
  id: string;
  titulo: string;
  tipo: string;
  area: string;
  prioridad: string;
  problema: string;
  comportamiento: string;
  criterios: string;
  pantalla: string | null;
  status: string;
  createdBy: string;
  createdAt: Date;
};

export async function getFeatureRequests(): Promise<FeatureRequestItem[]> {
  return db.featureRequest.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
}

const featureSchema = z.object({
  titulo: z.string().min(5, "El título debe ser descriptivo (mín. 5 caracteres)"),
  tipo: z.enum(["FEATURE", "MEJORA", "BUG"]),
  area: z.string().min(1),
  prioridad: z.enum(["ALTA", "MEDIA", "BAJA"]),
  problema: z.string().min(20, "Explica el problema con más detalle (mín. 20 caracteres)"),
  comportamiento: z.string().min(20, "Describe el comportamiento esperado paso a paso (mín. 20 caracteres)"),
  criterios: z.string().min(10, "Define al menos un criterio de aceptación"),
  pantalla: z.string().optional(),
});

export async function createFeatureRequest(data: z.infer<typeof featureSchema>) {
  await assertCanWrite();
  const session = await auth();
  const parsed = featureSchema.parse(data);
  await db.featureRequest.create({
    data: { ...parsed, pantalla: parsed.pantalla || null, createdBy: session?.user?.name ?? "desconocido" },
  });
  revalidatePath("/dashboard/features");
  return { ok: true };
}

export async function updateFeatureStatus(id: string, status: "NUEVA" | "EN_DESARROLLO" | "HECHA" | "DESCARTADA") {
  await assertCanWrite();
  await db.featureRequest.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/features");
  return { ok: true };
}
