"use server";

import { db } from "@/lib/db";
import { assertCanWrite, assertAuthenticated } from "@/lib/authz";
import { getProjectDotacionByWeek } from "@/lib/actions/workers";
import { revalidatePath } from "next/cache";

// ─── Configuración ────────────────────────────────────────────────────────────

export type AlertConfig = {
  gapsEnabled: boolean;
  gapsSemanas: number;
  salidasEnabled: boolean;
  salidasSemanas: number;
  vencimientosEnabled: boolean;
  vencimientoDias: number;
  curvaEnabled: boolean;
};

export async function getAlertConfig(): Promise<AlertConfig> {
  await assertAuthenticated();
  const s = await db.alertSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return {
    gapsEnabled: s.gapsEnabled,
    gapsSemanas: s.gapsSemanas,
    salidasEnabled: s.salidasEnabled,
    salidasSemanas: s.salidasSemanas,
    vencimientosEnabled: s.vencimientosEnabled,
    vencimientoDias: s.vencimientoDias,
    curvaEnabled: s.curvaEnabled,
  };
}

export async function updateAlertConfig(config: AlertConfig) {
  await assertCanWrite();
  await db.alertSetting.upsert({
    where: { id: "default" },
    update: config,
    create: { id: "default", ...config },
  });
  revalidatePath("/dashboard/alertas");
  return { ok: true };
}

// ─── Motor de alertas ─────────────────────────────────────────────────────────

export type AlertItem = {
  id: string;
  tipo: "gap" | "salida" | "vencimiento" | "curva";
  severidad: "critica" | "advertencia" | "info";
  titulo: string;
  detalle: string;
  accion: string; // etiqueta del botón
  href: string; // destino de la acción
  fecha?: string; // referencia temporal legible
};

export type AlertasData = {
  alertas: AlertItem[];
  counts: { critica: number; advertencia: number; info: number };
  config: AlertConfig;
};

export async function getAlertas(): Promise<AlertasData> {
  await assertAuthenticated();
  const config = await getAlertConfig();
  const alertas: AlertItem[] = [];
  const now = Date.now();

  const projects = await db.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });

  // ── 1) Gaps próximos + 2) Salidas sin relevo (por proyecto) ──
  for (const project of projects) {
    const weeks = await getProjectDotacionByWeek(project.id);
    if (weeks.length === 0) continue;
    const currentIdx = Math.max(
      weeks.findIndex((w) => now >= w.startDate.getTime() && now <= w.endDate.getTime()),
      0
    );

    if (config.gapsEnabled) {
      for (let i = currentIdx; i < Math.min(currentIdx + config.gapsSemanas, weeks.length); i++) {
        const w = weeks[i];
        const gaps = w.roles
          .map((r) => ({ roleName: r.roleName, deficit: Math.max(r.neededThisWeek - r.filledHabilitado, 0) }))
          .filter((g) => g.deficit > 0);
        const totalDeficit = gaps.reduce((s, g) => s + g.deficit, 0);
        if (totalDeficit > 0) {
          alertas.push({
            id: `gap-${project.id}-${w.weekNumber}`,
            tipo: "gap",
            severidad: i - currentIdx <= 1 ? "critica" : "advertencia",
            titulo: `Gap de dotación en ${project.name} — Semana ${w.weekNumber}`,
            detalle: `Faltan ${totalDeficit} habilitado${totalDeficit !== 1 ? "s" : ""}: ${gaps.map((g) => `${g.roleName} (${g.deficit})`).join(", ")}`,
            accion: "Cubrir cupos",
            href: `/dashboard/proyectos/${project.id}`,
            fecha: `S${w.weekNumber}`,
          });
        }
      }
    }

    if (config.salidasEnabled) {
      for (let i = currentIdx; i < Math.min(currentIdx + config.salidasSemanas, weeks.length - 1); i++) {
        const nextWeek = weeks[i + 1];
        const nextIds = new Set(nextWeek.roles.flatMap((r) => r.workers.map((wk) => wk.id)));
        for (const r of weeks[i].roles) {
          for (const wk of r.workers) {
            if (nextIds.has(wk.id)) continue;
            // ¿Queda déficit en la semana siguiente para su cargo? → nadie lo releva
            const nextRole = nextWeek.roles.find((x) => x.roleId === r.roleId);
            const sinRelevo = !nextRole || nextRole.filledHabilitado < nextRole.neededThisWeek;
            if (sinRelevo && (nextRole?.neededThisWeek ?? 0) > 0) {
              alertas.push({
                id: `salida-${project.id}-${wk.id}-${weeks[i].weekNumber}`,
                tipo: "salida",
                severidad: "advertencia",
                titulo: `${wk.fullName} sale en S${weeks[i].weekNumber} sin relevo`,
                detalle: `${r.roleName} en ${project.name} — su cupo queda descubierto en S${nextWeek.weekNumber}`,
                accion: "Buscar relevo",
                href: `/dashboard/proyectos/${project.id}`,
                fecha: `S${weeks[i].weekNumber}`,
              });
            }
          }
        }
      }
    }
  }

  // ── 3) Vencimientos de documentos ──
  if (config.vencimientosEnabled) {
    const limite = new Date(now + config.vencimientoDias * 24 * 60 * 60 * 1000);
    const docs = await db.workerDocument.findMany({
      where: { status: "APPROVED", expiresAt: { not: null, lte: limite } },
      include: {
        worker: {
          select: {
            id: true, fullName: true, currentStageOrder: true,
            // Cargo y faena donde hoy está asignado — para nombrar la consecuencia
            assignments: {
              select: { role: { select: { name: true } }, weekPlan: { select: { project: { select: { name: true } } } } },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        documentType: { select: { name: true } },
      },
      orderBy: { expiresAt: "asc" },
    });
    for (const d of docs) {
      const exp = d.expiresAt!;
      const vencido = exp.getTime() < now;
      const diasRestantes = Math.ceil((exp.getTime() - now) / (24 * 60 * 60 * 1000));
      const asignacion = d.worker.assignments[0];
      // Consecuencia de negocio: qué cargo/faena queda expuesto
      const consecuencia = asignacion
        ? `${asignacion.role.name} en ${asignacion.weekPlan.project.name}`
        : null;
      alertas.push({
        id: `venc-${d.id}`,
        tipo: "vencimiento",
        severidad: vencido ? "critica" : "advertencia",
        titulo: vencido
          ? consecuencia
            ? `${d.worker.fullName} quedó deshabilitado → ${consecuencia} descubierto`
            : `${d.worker.fullName} quedó deshabilitado — documento vencido`
          : consecuencia
            ? `${d.worker.fullName} pierde habilitación en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""} → riesgo en ${consecuencia}`
            : `Documento de ${d.worker.fullName} vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`,
        detalle: `${d.documentType.name} — ${vencido ? `venció el ${exp.toLocaleDateString("es-CL")}` : `vence el ${exp.toLocaleDateString("es-CL")}`}`,
        accion: vencido ? "Renovar o reemplazar" : "Renovar documento",
        href: `/dashboard/trabajadores/${d.worker.id}`,
        fecha: exp.toLocaleDateString("es-CL"),
      });
    }
  }

  // ── 4) Cambios de curva (últimos 14 días) ──
  if (config.curvaEnabled) {
    const desde = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const cambios = await db.curveChangeLog.findMany({
      where: { createdAt: { gte: desde } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    for (const c of cambios) {
      const delta = c.newQty - c.oldQty;
      alertas.push({
        id: `curva-${c.id}`,
        tipo: "curva",
        severidad: "info",
        titulo: `Cambio de curva en ${c.project.name}`,
        detalle: `${c.roleName} en S${c.weekNumber}: ${c.oldQty} → ${c.newQty} (${delta > 0 ? "+" : ""}${delta}) — por ${c.changedBy}`,
        accion: "Ver semanas afectadas",
        href: `/dashboard/proyectos/${c.projectId}`,
        fecha: c.createdAt.toLocaleDateString("es-CL"),
      });
    }
  }

  // Orden: críticas → advertencias → info
  const sev = { critica: 0, advertencia: 1, info: 2 };
  alertas.sort((a, b) => sev[a.severidad] - sev[b.severidad]);

  return {
    alertas,
    counts: {
      critica: alertas.filter((a) => a.severidad === "critica").length,
      advertencia: alertas.filter((a) => a.severidad === "advertencia").length,
      info: alertas.filter((a) => a.severidad === "info").length,
    },
    config,
  };
}
