"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { assertCanWrite } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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
  images: string | null;
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

export async function createFeatureRequest(data: z.infer<typeof featureSchema>, formData?: FormData) {
  await assertCanWrite();
  const session = await auth();
  const parsed = featureSchema.parse(data);

  // Capturas opcionales — se guardan junto a los demás archivos en uploads/
  const urls: string[] = [];
  const files = (formData?.getAll("images") ?? []) as File[];
  if (files.length > 0) {
    const dir = path.join(process.cwd(), "public", "uploads", "qa");
    await mkdir(dir, { recursive: true });
    for (const f of files.slice(0, 6)) {
      if (!f || f.size === 0 || !f.type.startsWith("image/")) continue;
      const ext = f.name.split(".").pop() || "png";
      const name = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await writeFile(path.join(dir, name), Buffer.from(await f.arrayBuffer()));
      urls.push(`/uploads/qa/${name}`);
    }
  }

  await db.featureRequest.create({
    data: {
      ...parsed,
      pantalla: parsed.pantalla || null,
      images: urls.length > 0 ? JSON.stringify(urls) : null,
      createdBy: session?.user?.name ?? "desconocido",
    },
  });
  revalidatePath("/dashboard/features");
  revalidatePath("/dashboard/bugs");
  return { ok: true };
}

export async function updateFeatureStatus(id: string, status: "NUEVA" | "EN_DESARROLLO" | "HECHA" | "DESCARTADA") {
  await assertCanWrite();
  await db.featureRequest.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/features");
  revalidatePath("/dashboard/bugs");
  return { ok: true };
}
