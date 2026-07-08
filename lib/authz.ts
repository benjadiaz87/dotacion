import { auth } from "@/lib/auth";

export const ROLES = ["SUPERADMIN", "ADMIN", "AUDITOR"] as const;
export type AppRole = (typeof ROLES)[number];

export async function getSessionRole(): Promise<AppRole | null> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role && (ROLES as readonly string[]).includes(role) ? (role as AppRole) : null;
}

// Mutaciones generales: cualquier rol excepto AUDITOR (solo lectura)
export async function assertCanWrite() {
  const role = await getSessionRole();
  if (!role) throw new Error("No autorizado");
  if (role === "AUDITOR") throw new Error("Tu rol es de solo lectura (Auditor)");
}

// Secciones exclusivas del superadmin (Cargos, Acceso)
export async function assertSuperadmin() {
  const role = await getSessionRole();
  if (role !== "SUPERADMIN") throw new Error("No autorizado: requiere rol Superadmin");
}

// Subida/verificación de documentos de un trabajador:
// - Admin/Superadmin con sesión: permitido
// - Auditor: rechazado (solo lectura)
// - Sin sesión (portal público): permitido solo si el trabajador tiene un
//   enlace de carga vigente (magic link)
export async function assertCanUploadFor(workerId: string) {
  const role = await getSessionRole();
  if (role === "AUDITOR") throw new Error("Tu rol es de solo lectura (Auditor)");
  if (role) return; // ADMIN o SUPERADMIN

  const { db } = await import("@/lib/db");
  const token = await db.workerUploadToken.findFirst({
    where: { workerId, expiresAt: { gt: new Date() } },
  });
  if (!token) throw new Error("No autorizado");
}
