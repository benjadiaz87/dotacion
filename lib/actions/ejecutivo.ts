"use server";

import { db } from "@/lib/db";
import { assertAuthenticated } from "@/lib/authz";
import { getProjectDotacionByWeek } from "@/lib/actions/workers";

// ─── Supuestos de ahorro (ajustables) ─────────────────────────────────────────
// Cada validación automática (extracción IA + verificación en Registro Civil)
// reemplaza el trámite manual de descargar, leer y contrastar un documento.
// Estos valores alimentan el número de "ahorro" del panel ejecutivo — cámbialos
// con datos reales del cliente en la demo.
const MINUTOS_POR_VALIDACION_MANUAL = 30;
const COSTO_HORA_ANALISTA_CLP = 6000;

export type EjecutivoStats = {
  // Riesgo de paro de faena
  riesgo: {
    cargosSinRelevo: number;      // cupos requeridos sin habilitado en las próximas 2 semanas
    semanasHorizonte: number;
    proyectosAfectados: number;
  };
  // Exposición a multas / deshabilitación
  cumplimiento: {
    vencidos: number;             // documentos aprobados ya vencidos
    porVencer: number;            // vencen dentro de 30 días
    trabajadoresAfectados: number;
  };
  // Ahorro generado por la Validación Inteligente Dotia
  ahorro: {
    validaciones: number;         // documentos validados automáticamente
    horasAhorradas: number;
    montoCLP: number;
    minutosPorValidacion: number;
    costoHoraCLP: number;
  };
};

const VENCIMIENTO_DIAS = 30;
const HORIZONTE_SEMANAS = 2;

export async function getEjecutivoStats(): Promise<EjecutivoStats> {
  await assertAuthenticated();
  const now = Date.now();

  // ── Riesgo de paro: cupos sin habilitado en las próximas HORIZONTE_SEMANAS ──
  const projects = await db.project.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  let cargosSinRelevo = 0;
  const proyectosAfectadosSet = new Set<string>();

  for (const project of projects) {
    const weeks = await getProjectDotacionByWeek(project.id);
    if (weeks.length === 0) continue;
    const currentIdx = Math.max(
      weeks.findIndex((w) => now >= w.startDate.getTime() && now <= w.endDate.getTime()),
      0
    );
    let deficitProyecto = 0;
    for (let i = currentIdx; i < Math.min(currentIdx + HORIZONTE_SEMANAS, weeks.length); i++) {
      for (const r of weeks[i].roles) {
        deficitProyecto += Math.max(r.neededThisWeek - r.filledHabilitado, 0);
      }
    }
    if (deficitProyecto > 0) {
      cargosSinRelevo += deficitProyecto;
      proyectosAfectadosSet.add(project.id);
    }
  }

  // ── Cumplimiento: documentos aprobados vencidos / por vencer ──
  const limite = new Date(now + VENCIMIENTO_DIAS * 24 * 60 * 60 * 1000);
  const docsConVencimiento = await db.workerDocument.findMany({
    where: { status: "APPROVED", expiresAt: { not: null, lte: limite } },
    select: { expiresAt: true, workerId: true },
  });
  let vencidos = 0;
  let porVencer = 0;
  const afectados = new Set<string>();
  for (const d of docsConVencimiento) {
    if (!d.expiresAt) continue;
    if (d.expiresAt.getTime() < now) vencidos++;
    else porVencer++;
    afectados.add(d.workerId);
  }

  // ── Ahorro: documentos validados automáticamente (tienen extractedData) ──
  const validaciones = await db.workerDocument.count({
    where: { status: "APPROVED", extractedData: { not: null } },
  });
  const horasAhorradas = Math.round((validaciones * MINUTOS_POR_VALIDACION_MANUAL) / 60 * 10) / 10;
  const montoCLP = Math.round(horasAhorradas * COSTO_HORA_ANALISTA_CLP);

  return {
    riesgo: {
      cargosSinRelevo,
      semanasHorizonte: HORIZONTE_SEMANAS,
      proyectosAfectados: proyectosAfectadosSet.size,
    },
    cumplimiento: {
      vencidos,
      porVencer,
      trabajadoresAfectados: afectados.size,
    },
    ahorro: {
      validaciones,
      horasAhorradas,
      montoCLP,
      minutosPorValidacion: MINUTOS_POR_VALIDACION_MANUAL,
      costoHoraCLP: COSTO_HORA_ANALISTA_CLP,
    },
  };
}

// ─── Historial de Validaciones Inteligentes Dotia ─────────────────────────────
// Documentos que pasaron por verificación automática (tienen extractedData).

export type ValidacionHistorial = {
  id: string;
  workerId: string;
  workerName: string;
  workerRut: string;
  documentType: string;
  status: string;            // APPROVED | REJECTED | PENDING
  documentNumber: string | null;
  verifyNote: string | null;
  expiresAt: Date | null;
  uploadedAt: Date;
};

export async function getValidacionesHistorial(): Promise<ValidacionHistorial[]> {
  await assertAuthenticated();
  const docs = await db.workerDocument.findMany({
    where: { extractedData: { not: null } },
    orderBy: { uploadedAt: "desc" },
    include: {
      worker: { select: { id: true, fullName: true, rut: true } },
      documentType: { select: { name: true } },
    },
  });

  return docs.map((d) => ({
    id: d.id,
    workerId: d.worker.id,
    workerName: d.worker.fullName,
    workerRut: d.worker.rut,
    documentType: d.documentType.name,
    status: d.status,
    documentNumber: d.documentNumber,
    verifyNote: d.verifyNote,
    expiresAt: d.expiresAt,
    uploadedAt: d.uploadedAt,
  }));
}

// ─── Línea base real para la calculadora de ROI ───────────────────────────────

export type RoiBaseline = {
  validacionesRealizadas: number;   // documentos ya validados automáticamente
  trabajadores: number;             // dotación total en el sistema
  // Supuestos por defecto (los mismos del panel), editables en la calculadora
  minutosPorValidacionManual: number;
  costoHoraCLP: number;
  segundosPorValidacionDotia: number;
};

export async function getRoiBaseline(): Promise<RoiBaseline> {
  await assertAuthenticated();
  const [validacionesRealizadas, trabajadores] = await Promise.all([
    db.workerDocument.count({ where: { extractedData: { not: null } } }),
    db.worker.count(),
  ]);
  return {
    validacionesRealizadas,
    trabajadores,
    minutosPorValidacionManual: MINUTOS_POR_VALIDACION_MANUAL,
    costoHoraCLP: COSTO_HORA_ANALISTA_CLP,
    segundosPorValidacionDotia: 8, // tiempo típico de la validación automática
  };
}
