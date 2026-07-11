"use server";
import { assertAuthenticated } from "@/lib/authz";

import { db } from "@/lib/db";
import { computeSemaphore, computeRoleFillSplit, type DocSemaphore } from "@/lib/project-utils";

export type ProyectoCobertura = {
  id: string;
  name: string;
  status: string;
  client: string | null;
  cubiertos: number;
  totales: number;
  pct: number;
  vacantes: number;
  habilitados: number;
  sinHabilitar: number;
  cargoMasCritico: { name: string; color: string; deficit: number } | null;
};

export type SemaphoreStats = {
  green: number;
  yellow: number;
  red: number;
  total: number;
};

export type ProyeccionSemana = {
  weekNumber: number;
  [projectName: string]: number;
};

export type ProyectoDetalle = {
  id: string;
  name: string;
  color: string;
  semanas: { weekNumber: number; cubiertos: number; vacantes: number; totales: number }[];
};

export type ReportesData = {
  coberturaProyectos: ProyectoCobertura[];
  semaphoreStats: SemaphoreStats;
  proyeccionVacantes: ProyeccionSemana[];
  proyectosActivos: { id: string; name: string; color: string }[];
  proyeccionDetalle: ProyectoDetalle[];
  poolDisponible: number;
  coberturaPromedio: number;
  totalVacantes: number;
  pctHabilitados: number;
  rotacion30dias: number;
};

export async function getReportesData(): Promise<ReportesData> {
  await assertAuthenticated();
  const [projects, requiredTypes, allWorkers] = await Promise.all([
    db.project.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      include: {
        weekPlans: {
          include: {
            requirements: { include: { role: true } },
            assignments: { include: { role: true, worker: { include: { documents: true } } } },
          },
          orderBy: { weekNumber: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.documentType.findMany({ where: { required: true } }),
    db.worker.findMany({ include: { documents: true, assignments: true } }),
  ]);

  // Helper: is worker habilitado
  function isHabilitado(workerDocs: { documentTypeId: string; status: string }[]): boolean {
    if (requiredTypes.length === 0) return true;
    return requiredTypes.every((t) =>
      workerDocs.some((d) => d.documentTypeId === t.id && d.status === "APPROVED")
    );
  }

  // Semaphore stats across all workers
  const semaphoreStats: SemaphoreStats = { green: 0, yellow: 0, red: 0, total: allWorkers.length };
  for (const w of allWorkers) {
    const approved = requiredTypes.filter((t) =>
      w.documents.some((d) => d.documentTypeId === t.id && d.status === "APPROVED")
    ).length;
    const s = computeSemaphore(requiredTypes.length, approved);
    semaphoreStats[s]++;
  }

  // Pool disponible
  const assignedWorkerIds = new Set(
    projects.flatMap((p) => p.weekPlans.flatMap((wp) => wp.assignments.map((a) => a.workerId)))
  );
  const poolDisponible = allWorkers.filter(
    (w) => !assignedWorkerIds.has(w.id) && isHabilitado(w.documents)
  ).length;

  // Rotación 30 días
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rotacion30dias = await db.workerAssignment.count({ where: { createdAt: { gte: since30 } } });

  // Por proyecto: cobertura actual (semana vigente o la más reciente)
  const now = Date.now();
  const coberturaProyectos: ProyectoCobertura[] = [];
  let totalVacantesGlobal = 0;
  let totalCubiertosGlobal = 0;
  let totalTotalesGlobal = 0;
  let totalHabilitadosGlobal = 0;
  let totalTrabajadoresGlobal = 0;

  // Proyección de vacantes: semana a semana por proyecto activo
  const proyeccionMap = new Map<number, ProyeccionSemana>();
  const proyectosActivos: { id: string; name: string; color: string }[] = [];
  const proyeccionDetalle: ProyectoDetalle[] = [];

  const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

  for (let pi = 0; pi < projects.length; pi++) {
    const project = projects[pi];
    const color = COLORS[pi % COLORS.length];
    if (project.status === "ACTIVE") {
      proyectosActivos.push({ id: project.id, name: project.name, color });
    }

    // Build habilitación map for this project's workers
    const workerHabMap = new Map<string, boolean>();
    const allProjectWorkerIds = new Set(project.weekPlans.flatMap((wp) => wp.assignments.map((a) => a.workerId)));
    for (const wid of allProjectWorkerIds) {
      const worker = allWorkers.find((w) => w.id === wid);
      workerHabMap.set(wid, worker ? isHabilitado(worker.documents) : false);
    }

    // Find current week
    const currentWp =
      project.weekPlans.find((wp) => now >= new Date(wp.startDate).getTime() && now <= new Date(wp.endDate).getTime()) ??
      project.weekPlans[project.weekPlans.length - 1];

    if (!currentWp) continue;

    // Aggregate roles for current week
    const roleAgg = new Map<string, { name: string; color: string; workers: { habilitado: boolean }[]; needed: number }>();
    for (const req of currentWp.requirements) {
      roleAgg.set(req.roleId, { name: req.role.name, color: req.role.color, workers: [], needed: req.quantity });
    }
    for (const a of currentWp.assignments) {
      if (!roleAgg.has(a.roleId))
        roleAgg.set(a.roleId, { name: a.role.name, color: a.role.color, workers: [], needed: 0 });
      roleAgg.get(a.roleId)!.workers.push({ habilitado: workerHabMap.get(a.workerId) ?? false });
    }

    let cubiertos = 0, totales = 0, vacantes = 0, habilitados = 0, sinHabilitar = 0;
    let masCritico: { name: string; color: string; deficit: number } | null = null;

    for (const r of roleAgg.values()) {
      const split = computeRoleFillSplit(
        r.workers.map((w, i) => ({ id: String(i), rut: "", fullName: "", habilitado: w.habilitado })),
        r.needed
      );
      cubiertos += split.filledHabilitado + split.filledSinHabilitar;
      totales += r.needed;
      vacantes += split.vacantes;
      habilitados += split.habilitadosCount;
      sinHabilitar += r.workers.length - split.habilitadosCount;
      if (split.vacantes > 0 && (!masCritico || split.vacantes > masCritico.deficit)) {
        masCritico = { name: r.name, color: r.color, deficit: split.vacantes };
      }
    }

    coberturaProyectos.push({
      id: project.id,
      name: project.name,
      status: project.status,
      client: project.client,
      cubiertos,
      totales,
      pct: totales > 0 ? Math.round((cubiertos / totales) * 100) : 100,
      vacantes,
      habilitados,
      sinHabilitar,
      cargoMasCritico: masCritico,
    });

    totalVacantesGlobal += vacantes;
    totalCubiertosGlobal += cubiertos;
    totalTotalesGlobal += totales;
    totalHabilitadosGlobal += habilitados;
    totalTrabajadoresGlobal += currentWp.assignments.length;

    // Proyección semana a semana (vacantes + detalle cubiertos)
    if (project.status === "ACTIVE") {
      const detalleSemanas: ProyectoDetalle["semanas"] = [];

      for (const wp of project.weekPlans) {
        const roleAggWp = new Map<string, { workers: { habilitado: boolean }[]; needed: number }>();
        for (const req of wp.requirements)
          roleAggWp.set(req.roleId, { workers: [], needed: req.quantity });
        for (const a of wp.assignments) {
          if (!roleAggWp.has(a.roleId)) roleAggWp.set(a.roleId, { workers: [], needed: 0 });
          roleAggWp.get(a.roleId)!.workers.push({ habilitado: workerHabMap.get(a.workerId) ?? false });
        }
        let wpVacantes = 0, wpCubiertos = 0, wpTotales = 0;
        for (const r of roleAggWp.values()) {
          const split = computeRoleFillSplit(
            r.workers.map((w, i) => ({ id: String(i), rut: "", fullName: "", habilitado: w.habilitado })),
            r.needed
          );
          wpVacantes += split.vacantes;
          wpCubiertos += split.filledHabilitado + split.filledSinHabilitar;
          wpTotales += r.needed;
        }
        if (!proyeccionMap.has(wp.weekNumber))
          proyeccionMap.set(wp.weekNumber, { weekNumber: wp.weekNumber });
        proyeccionMap.get(wp.weekNumber)![project.name] = wpVacantes;
        detalleSemanas.push({ weekNumber: wp.weekNumber, cubiertos: wpCubiertos, vacantes: wpVacantes, totales: wpTotales });
      }

      proyeccionDetalle.push({ id: project.id, name: project.name, color, semanas: detalleSemanas });
    }
  }

  const coberturaPromedio = totalTotalesGlobal > 0
    ? Math.round((totalCubiertosGlobal / totalTotalesGlobal) * 100)
    : 100;
  const pctHabilitados = totalTrabajadoresGlobal > 0
    ? Math.round((totalHabilitadosGlobal / totalTrabajadoresGlobal) * 100)
    : 0;

  const proyeccionVacantes = Array.from(proyeccionMap.values()).sort((a, b) => a.weekNumber - b.weekNumber);

  return {
    coberturaProyectos: coberturaProyectos.sort((a, b) => b.vacantes - a.vacantes),
    semaphoreStats,
    proyeccionVacantes,
    proyectosActivos,
    proyeccionDetalle,
    poolDisponible,
    coberturaPromedio,
    totalVacantes: totalVacantesGlobal,
    pctHabilitados,
    rotacion30dias,
  };
}
