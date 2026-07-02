export const statusConfig = {
  ACTIVE: { label: "Activo", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  PAUSED: { label: "Pausado", color: "text-amber-700 bg-amber-50 border-amber-200" },
  COMPLETED: { label: "Completado", color: "text-blue-700 bg-blue-50 border-blue-200" },
  CANCELLED: { label: "Cancelado", color: "text-red-700 bg-red-50 border-red-200" },
};

export function getProjectProgress(startDate: Date, weeks: number): number {
  const start = new Date(startDate).getTime();
  const end = start + weeks * 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function getTotalHeadcount(
  weekPlans: { requirements: { quantity: number }[] }[]
): number {
  return weekPlans.reduce(
    (sum, wp) => sum + wp.requirements.reduce((s, r) => s + r.quantity, 0),
    0
  );
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getSparklineData(
  weekPlans: { weekNumber: number; requirements: { quantity: number }[] }[]
): { weekNumber: number; total: number }[] {
  return [...weekPlans]
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((wp) => ({
      weekNumber: wp.weekNumber,
      total: wp.requirements.reduce((s, r) => s + r.quantity, 0),
    }));
}

export function formatWeekRange(start: Date, end: Date): string {
  const s = new Date(start).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  const e = new Date(end).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  return `${s} – ${e}`;
}

export type DocSemaphore = "green" | "yellow" | "red";

export function computeSemaphore(requiredCount: number, approvedCount: number): DocSemaphore {
  if (requiredCount === 0 || approvedCount === requiredCount) return "green";
  if (approvedCount === 0) return "red";
  return "yellow";
}

export type DotacionWorker = {
  id: string;
  rut: string;
  fullName: string;
  habilitado: boolean;
};

export function computeRoleFillSplit(workers: DotacionWorker[], needed: number) {
  const habilitadosCount = workers.filter((w) => w.habilitado).length;
  const noHabilitadosCount = workers.length - habilitadosCount;
  const filledHabilitado = Math.min(habilitadosCount, needed);
  const filledSinHabilitar = Math.min(noHabilitadosCount, Math.max(0, needed - filledHabilitado));
  const vacantes = Math.max(0, needed - filledHabilitado - filledSinHabilitar);
  return { habilitadosCount, filledHabilitado, filledSinHabilitar, vacantes };
}
