"use server";

import { db } from "@/lib/db";
import { getProjectDotacionByWeek } from "@/lib/actions/workers";

export type SeguimientoWorker = {
  id: string;
  fullName: string;
  rut: string;
  stageOrder: number; // 1..stagesTotal, o stagesTotal+1 si habilitado
  habilitado: boolean;
};

export type SeguimientoRow = {
  roleId: string;
  roleName: string;
  roleColor: string;
  requeridos: number; // dotación requerida del cargo en la semana en curso
  total: number; // trabajadores asignados de este cargo
  byStage: number[]; // conteo por etapa (índice 0 = etapa 1)
  habilitados: number;
  pctHabilitados: number;
  alerta: string | null;
  workers: SeguimientoWorker[];
};

export type DisponibleWorker = {
  id: string;
  fullName: string;
  rut: string;
  stageOrder: number;
  habilitado: boolean;
  roleId: string | null;
  roleName: string | null;
  roleColor: string | null;
};

export type SeguimientoData = {
  stages: { order: number; name: string }[];
  stageTotals: number[]; // por etapa
  habilitadosTotal: number;
  // Trabajadores NO asignados a este proyecto, agrupados por etapa
  // (clave = order de etapa; stagesTotal + 1 = habilitados)
  disponibles: Record<number, DisponibleWorker[]>;
  kpis: {
    dotacionRequerida: number;
    asignados: number;
    habilitados: number;
    pctHabilitados: number;
    cargosAlerta: number;
  };
  rows: SeguimientoRow[];
};

export async function getProjectSeguimiento(projectId: string): Promise<SeguimientoData> {
  const [stages, weeksData, assignments] = await Promise.all([
    db.stage.findMany({ orderBy: { order: "asc" }, select: { order: true, name: true } }),
    getProjectDotacionByWeek(projectId),
    db.workerAssignment.findMany({
      where: { weekPlan: { projectId } },
      include: {
        role: true,
        worker: { include: { role: true } },
      },
    }),
  ]);

  const stagesTotal = stages.length;

  // Semana en curso (o la última) para los requeridos por cargo
  const now = Date.now();
  const currentWeek =
    weeksData.find((w) => now >= w.startDate.getTime() && now <= w.endDate.getTime()) ??
    weeksData[weeksData.length - 1];
  const requeridosPorRol = new Map<string, number>();
  for (const r of currentWeek?.roles ?? []) {
    requeridosPorRol.set(r.roleId, r.neededThisWeek);
  }

  // Trabajadores únicos del proyecto, con su cargo (propio o de la asignación)
  const workerMap = new Map<string, { worker: SeguimientoWorker; roleId: string; roleName: string; roleColor: string }>();
  for (const a of assignments) {
    if (workerMap.has(a.workerId)) continue;
    const role = a.worker.role ?? a.role;
    workerMap.set(a.workerId, {
      worker: {
        id: a.worker.id,
        fullName: a.worker.fullName,
        rut: a.worker.rut,
        stageOrder: a.worker.currentStageOrder,
        habilitado: a.worker.currentStageOrder > stagesTotal,
      },
      roleId: role.id,
      roleName: role.name,
      roleColor: role.color,
    });
  }

  // Agrupar por cargo
  const rowMap = new Map<string, SeguimientoRow>();
  for (const { worker, roleId, roleName, roleColor } of workerMap.values()) {
    let row = rowMap.get(roleId);
    if (!row) {
      row = {
        roleId, roleName, roleColor,
        requeridos: requeridosPorRol.get(roleId) ?? 0,
        total: 0,
        byStage: Array(stagesTotal).fill(0),
        habilitados: 0,
        pctHabilitados: 0,
        alerta: null,
        workers: [],
      };
      rowMap.set(roleId, row);
    }
    row.total++;
    row.workers.push(worker);
    if (worker.habilitado) row.habilitados++;
    else row.byStage[worker.stageOrder - 1]++;
  }

  // Cargos requeridos sin ningún trabajador asignado también son filas (con alerta)
  for (const r of currentWeek?.roles ?? []) {
    if (!rowMap.has(r.roleId) && r.neededThisWeek > 0) {
      rowMap.set(r.roleId, {
        roleId: r.roleId,
        roleName: r.roleName,
        roleColor: r.roleColor,
        requeridos: r.neededThisWeek,
        total: 0,
        byStage: Array(stagesTotal).fill(0),
        habilitados: 0,
        pctHabilitados: 0,
        alerta: null,
        workers: [],
      });
    }
  }

  // Métricas por fila y alertas
  const rows = Array.from(rowMap.values()).map((row) => {
    row.pctHabilitados = row.total > 0 ? Math.round((row.habilitados / row.total) * 100) : 0;
    row.workers.sort((a, b) => b.stageOrder - a.stageOrder || a.fullName.localeCompare(b.fullName));
    if (row.total === 0) {
      row.alerta = `Sin trabajadores asignados (requiere ${row.requeridos})`;
    } else if (row.requeridos > 0 && row.habilitados < row.requeridos) {
      row.alerta = `Faltan ${row.requeridos - row.habilitados} habilitado${row.requeridos - row.habilitados !== 1 ? "s" : ""}`;
    } else if (row.habilitados === 0) {
      row.alerta = "Ninguno habilitado aún";
    }
    return row;
  });

  // Orden: primero los con alerta más grave (sin gente), luego por nombre
  rows.sort((a, b) => {
    const sev = (r: SeguimientoRow) => (r.total === 0 ? 0 : r.alerta ? 1 : 2);
    return sev(a) - sev(b) || a.roleName.localeCompare(b.roleName);
  });

  // Totales por etapa
  const stageTotals = Array(stagesTotal).fill(0);
  let habilitadosTotal = 0;
  for (const { worker } of workerMap.values()) {
    if (worker.habilitado) habilitadosTotal++;
    else stageTotals[worker.stageOrder - 1]++;
  }

  const asignados = workerMap.size;
  const dotacionRequerida = currentWeek?.cargosTotales ?? 0;

  // Pool disponible: trabajadores no asignados a este proyecto, por etapa
  const assignedIds = Array.from(workerMap.keys());
  const noAsignados = await db.worker.findMany({
    where: { id: { notIn: assignedIds } },
    include: { role: true },
    orderBy: { fullName: "asc" },
  });
  const disponibles: Record<number, DisponibleWorker[]> = {};
  for (const w of noAsignados) {
    const habilitado = w.currentStageOrder > stagesTotal;
    const key = habilitado ? stagesTotal + 1 : w.currentStageOrder;
    (disponibles[key] ??= []).push({
      id: w.id,
      fullName: w.fullName,
      rut: w.rut,
      stageOrder: w.currentStageOrder,
      habilitado,
      roleId: w.role?.id ?? null,
      roleName: w.role?.name ?? null,
      roleColor: w.role?.color ?? null,
    });
  }

  return {
    stages,
    stageTotals,
    habilitadosTotal,
    disponibles,
    kpis: {
      dotacionRequerida,
      asignados,
      habilitados: habilitadosTotal,
      pctHabilitados: asignados > 0 ? Math.round((habilitadosTotal / asignados) * 100) : 0,
      cargosAlerta: rows.filter((r) => r.alerta !== null).length,
    },
    rows,
  };
}
