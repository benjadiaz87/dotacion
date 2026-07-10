"use client";

import * as XLSX from "xlsx";
import type { WorkerListItem } from "@/lib/actions/workers";
import type { WeekDotacion } from "@/lib/actions/workers";
import type { DisponibleWorker } from "@/lib/actions/seguimiento";

// Ajusta el ancho de columnas al contenido
function autoWidth(rows: Record<string, unknown>[]): { wch: number }[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) => ({
    wch: Math.min(
      40,
      Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2
    ),
  }));
}

function sheetFrom(rows: Record<string, unknown>[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = autoWidth(rows);
  return ws;
}

function download(wb: XLSX.WorkBook, filename: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${stamp}.xlsx`);
}

// ─── Empleados ────────────────────────────────────────────────────────────────

export function exportEmpleados(workers: WorkerListItem[]) {
  const rows = workers.map((w) => ({
    "Nombre": w.fullName,
    "RUT": w.rut,
    "Cargo": w.primaryRole?.name ?? "Sin cargo",
    "Etapa": w.semaphore === "green" ? "Habilitado" : `${Math.min(w.currentStageOrder, w.stagesTotal)}/${w.stagesTotal} — ${w.stageName}`,
    "Habilitado": w.semaphore === "green" ? "Sí" : "No",
    "Docs por revisar": w.pendingReviewCount,
    "Proyectos": w.projects.map((p) => p.name).join(", ") || "Sin asignar",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFrom(rows), "Empleados");
  download(wb, "empleados");
}

// ─── Proyecto: Torre de Control ───────────────────────────────────────────────

export function exportProyecto(
  projectName: string,
  weeksData: WeekDotacion[],
  disponiblesHabilitados: DisponibleWorker[]
) {
  const wb = XLSX.utils.book_new();

  // Hoja 1 — Cobertura por semana
  const cobertura = weeksData.map((w) => {
    const needed = w.roles.reduce((s, r) => s + r.neededThisWeek, 0);
    const hab = w.roles.reduce((s, r) => s + Math.min(r.filledHabilitado, r.neededThisWeek), 0);
    return {
      "Semana": `S${w.weekNumber}`,
      "Desde": new Date(w.startDate).toLocaleDateString("es-CL"),
      "Hasta": new Date(w.endDate).toLocaleDateString("es-CL"),
      "Requeridos": needed,
      "Asignados": w.totalWorkers,
      "Habilitados": w.totalHabilitados,
      "Cobertura habilitada": needed > 0 ? `${Math.round((hab / needed) * 100)}%` : "100%",
      "Déficit": Math.max(needed - hab, 0),
    };
  });
  XLSX.utils.book_append_sheet(wb, sheetFrom(cobertura), "Cobertura semanal");

  // Hoja 2 — Déficit por cargo y semana (matriz de la torre)
  const cargos = new Map<string, string>();
  for (const w of weeksData) for (const r of w.roles) cargos.set(r.roleId, r.roleName);
  const matriz = Array.from(cargos.entries()).map(([roleId, roleName]) => {
    const row: Record<string, unknown> = { "Cargo": roleName };
    for (const w of weeksData) {
      const r = w.roles.find((x) => x.roleId === roleId);
      row[`S${w.weekNumber}`] = r && r.neededThisWeek > 0
        ? `${Math.min(r.filledHabilitado, r.neededThisWeek)}/${r.neededThisWeek}`
        : "";
    }
    return row;
  });
  XLSX.utils.book_append_sheet(wb, sheetFrom(matriz), "Déficit por cargo");

  // Hoja 3 — Trabajadores asignados (detalle por semana)
  const asignados: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const w of weeksData) {
    for (const r of w.roles) {
      for (const wk of r.workers) {
        const key = `${wk.id}-${w.weekNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);
        asignados.push({
          "Semana": `S${w.weekNumber}`,
          "Nombre": wk.fullName,
          "RUT": wk.rut,
          "Cargo": r.roleName,
          "Habilitado": wk.habilitado ? "Sí" : "No",
        });
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, sheetFrom(asignados), "Asignaciones");

  // Hoja 4 — Banco de habilitados disponibles
  const banco = disponiblesHabilitados.map((d) => ({
    "Nombre": d.fullName,
    "RUT": d.rut,
    "Cargo": d.roleName ?? "Sin cargo",
  }));
  XLSX.utils.book_append_sheet(wb, sheetFrom(banco), "Banco habilitados");

  download(wb, projectName.replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, "").replace(/\s+/g, "_").toLowerCase());
}
