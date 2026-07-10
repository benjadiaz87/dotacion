"use server";

import { assertCanWrite, assertCanUploadFor } from "@/lib/authz";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { safeExtension, assertUploadSize, saveUpload } from "@/lib/uploads";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { z } from "zod";
import { computeSemaphore, computeRoleFillSplit, type DocSemaphore, type DotacionWorker } from "@/lib/project-utils";

const workerSchema = z.object({
  rut: z.string().min(3),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  roleId: z.string().optional(),
});

export async function getOrCreateWorker(data: z.infer<typeof workerSchema>) {
  await assertCanWrite();
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const parsed = workerSchema.parse(data);

  const existing = await db.worker.findUnique({ where: { rut: parsed.rut } });
  if (existing) return existing;

  const worker = await db.worker.create({ data: parsed });
  revalidatePath("/dashboard/empleados");
  return worker;
}

export async function searchWorkers(query: string) {
  if (!query || query.length < 2) return [];
  return db.worker.findMany({
    where: {
      OR: [
        { rut: { contains: query } },
        { fullName: { contains: query } },
      ],
    },
    take: 10,
  });
}

export type WorkerSearchResult = {
  id: string;
  rut: string;
  fullName: string;
  semaphore: DocSemaphore;
  asignable: boolean;
};

export async function searchWorkersWithStatus(query: string): Promise<WorkerSearchResult[]> {
  if (!query || query.length < 2) return [];
  const [workers, maxStage] = await Promise.all([
    db.worker.findMany({
      where: {
        OR: [{ rut: { contains: query } }, { fullName: { contains: query } }],
      },
      include: { documents: true },
      take: 15,
    }),
    db.stage.aggregate({ _max: { order: true } }),
  ]);

  const maxOrder = maxStage._max.order ?? 4;

  return workers.map((w) => {
    const habilitado = w.currentStageOrder > maxOrder;
    const semaphore: DocSemaphore = habilitado
      ? "green"
      : w.currentStageOrder > 1 || w.documents.some((d) => d.status === "APPROVED")
      ? "yellow"
      : "red";
    return { id: w.id, rut: w.rut, fullName: w.fullName, semaphore, asignable: habilitado };
  });
}

export async function getDocumentTypes() {
  return db.documentType.findMany({ orderBy: { name: "asc" } });
}

export async function getWorker(id: string) {
  return db.worker.findUnique({
    where: { id },
    include: {
      documents: { include: { documentType: true } },
      assignments: { include: { role: true, weekPlan: { include: { project: true } } } },
    },
  });
}

export async function isWorkerHabilitado(workerId: string): Promise<boolean> {
  const [worker, maxStage] = await Promise.all([
    db.worker.findUnique({ where: { id: workerId }, select: { currentStageOrder: true } }),
    db.stage.aggregate({ _max: { order: true } }),
  ]);
  if (!worker) return false;
  return worker.currentStageOrder > (maxStage._max.order ?? 4);
}

export type WorkerListItem = {
  id: string;
  rut: string;
  fullName: string;
  primaryRole: { id: string; name: string; color: string } | null;
  requiredDocsCount: number;
  approvedDocsCount: number;
  semaphore: DocSemaphore;
  asignable: boolean;
  projects: { id: string; name: string }[];
  currentStageOrder: number;
  stageName: string;
  stagesTotal: number;
  pendingReviewCount: number;
};

export async function getAllWorkers(): Promise<WorkerListItem[]> {
  const [workers, requiredTypes, stages] = await Promise.all([
    db.worker.findMany({
      include: {
        role: true,
        documents: { include: { documentType: true } },
        assignments: { include: { role: true, weekPlan: { include: { project: true } } } },
      },
      orderBy: { fullName: "asc" },
    }),
    db.documentType.findMany({ where: { required: true } }),
    db.stage.findMany({ orderBy: { order: "asc" } }),
  ]);

  const stagesTotal = stages.length;

  return workers.map((w) => {
    const approvedDocsCount = requiredTypes.filter((t) =>
      w.documents.some((d) => d.documentTypeId === t.id && d.status === "APPROVED")
    ).length;

    // Semáforo basado en avance de pipeline (no en conteo de documentos)
    const habilitado = w.currentStageOrder > stagesTotal;
    const semaphore: DocSemaphore = habilitado
      ? "green"
      : w.currentStageOrder > 1 || approvedDocsCount > 0
      ? "yellow"
      : "red";

    const pendingReviewCount = w.documents.filter((d) => d.status === "PENDING").length;
    const stageName = habilitado
      ? "Habilitado"
      : stages.find((s) => s.order === w.currentStageOrder)?.name ?? "—";

    // Cargo propio del trabajador; fallback al más frecuente entre asignaciones
    const roleFreq = new Map<string, { count: number; role: { id: string; name: string; color: string } }>();
    for (const a of w.assignments) {
      const entry = roleFreq.get(a.roleId);
      if (entry) entry.count++;
      else roleFreq.set(a.roleId, { count: 1, role: a.role });
    }
    const primaryRole =
      w.role ??
      Array.from(roleFreq.values()).sort((a, b) => b.count - a.count)[0]?.role ??
      null;

    const projectsMap = new Map<string, string>();
    for (const a of w.assignments) {
      projectsMap.set(a.weekPlan.project.id, a.weekPlan.project.name);
    }

    return {
      id: w.id,
      rut: w.rut,
      fullName: w.fullName,
      primaryRole,
      requiredDocsCount: requiredTypes.length,
      approvedDocsCount,
      semaphore,
      asignable: semaphore === "green",
      projects: Array.from(projectsMap.entries()).map(([id, name]) => ({ id, name })),
      currentStageOrder: w.currentStageOrder,
      stageName,
      stagesTotal,
      pendingReviewCount,
    };
  });
}

export async function assignWorkerToWeeks(
  workerId: string,
  weekPlanIds: string[],
  roleId: string
) {
  await assertCanWrite();
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  for (const weekPlanId of weekPlanIds) {
    await db.workerAssignment.upsert({
      where: { workerId_weekPlanId: { workerId, weekPlanId } },
      update: { roleId },
      create: { workerId, weekPlanId, roleId },
    });
  }

  revalidatePath("/dashboard/proyectos");
}

export async function deleteWorker(workerId: string) {
  await assertCanWrite();
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  await db.worker.delete({ where: { id: workerId } });

  revalidatePath("/dashboard/empleados");
  revalidatePath("/dashboard/proyectos");
}

export async function removeAssignment(workerId: string, weekPlanId: string) {
  await assertCanWrite();
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  await db.workerAssignment.delete({
    where: { workerId_weekPlanId: { workerId, weekPlanId } },
  });

  revalidatePath("/dashboard/proyectos");
}

export async function uploadWorkerDocument(workerId: string, documentTypeId: string, formData: FormData) {
  // Permite admins con sesión y trabajadores con enlace vigente; bloquea Auditor
  await assertCanUploadFor(workerId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Archivo requerido");

  const documentNumber = (formData.get("documentNumber") as string | null)?.trim() || null;

  // Solo tipos de documento esperados y con límite de tamaño
  const ext = safeExtension(file.name);
  assertUploadSize(file);
  const fileName = `${workerId}-${documentTypeId}-${Date.now()}.${ext}`;
  const fileUrl = await saveUpload(fileName, Buffer.from(await file.arrayBuffer()));

  // Reverso opcional (p. ej. licencia de conducir): se guarda junto al anverso
  // y su URL viaja en extractedData para que la verificación lo use
  let backUrl: string | null = null;
  const back = formData.get("fileBack") as File | null;
  if (back && back.size > 0) {
    const backExt = safeExtension(back.name);
    assertUploadSize(back);
    const backName = `${workerId}-${documentTypeId}-${Date.now()}-reverso.${backExt}`;
    backUrl = await saveUpload(backName, Buffer.from(await back.arrayBuffer()));
  }

  const doc = await db.workerDocument.upsert({
    where: { workerId_documentTypeId: { workerId, documentTypeId } },
    update: {
      fileUrl,
      fileName: file.name,
      documentNumber,
      status: "PENDING",
      uploadedAt: new Date(),
      extractedData: backUrl ? JSON.stringify({ reversoUrl: backUrl }) : null,
    },
    create: {
      workerId,
      documentTypeId,
      fileUrl,
      fileName: file.name,
      documentNumber,
      status: "PENDING",
      extractedData: backUrl ? JSON.stringify({ reversoUrl: backUrl }) : undefined,
    },
  });

  revalidatePath("/dashboard/trabajadores");
  revalidatePath("/dashboard/empleados");
  return { documentId: doc.id };
}

export async function updateDocumentStatus(documentId: string, status: "APPROVED" | "REJECTED") {
  await assertCanWrite();
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  await db.workerDocument.update({ where: { id: documentId }, data: { status } });
  revalidatePath("/dashboard/proyectos");
}

// ── Dotación agregada por proyecto ──

export type RoleDotacion = {
  roleId: string;
  roleName: string;
  roleColor: string;
  workers: DotacionWorker[];
  habilitadosCount: number;
  neededThisWeek: number;
  filledHabilitado: number;
  filledSinHabilitar: number;
  vacantes: number;
};

// ── Dotación por semana (para slider de navegación temporal) ──

export type WeekDotacion = {
  weekNumber: number;
  weekPlanId: string;
  startDate: Date;
  endDate: Date;
  totalWorkers: number;
  totalHabilitados: number;
  criticos: number;
  cargosCubiertos: number;
  cargosTotales: number;
  vacantesTotal: number;
  cargoMasCritico: { roleId: string; roleName: string; roleColor: string; deficit: number } | null;
  roles: RoleDotacion[];
};

export async function getProjectDotacionByWeek(projectId: string): Promise<WeekDotacion[]> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      weekPlans: {
        include: { requirements: { include: { role: true } }, assignments: { include: { role: true, worker: true } } },
        orderBy: { weekNumber: "asc" },
      },
    },
  });
  if (!project) return [];

  // Habilitación se calcula una sola vez por trabajador (no cambia entre semanas)
  const allWorkerIds = new Set<string>();
  for (const wp of project.weekPlans) {
    for (const a of wp.assignments) allWorkerIds.add(a.workerId);
  }
  const habilitacionMap = new Map<string, boolean>();
  for (const id of allWorkerIds) {
    habilitacionMap.set(id, await isWorkerHabilitado(id));
  }

  return project.weekPlans.map((wp) => {
    const roleAgg = new Map<
      string,
      { roleId: string; roleName: string; roleColor: string; workers: DotacionWorker[]; neededThisWeek: number }
    >();

    for (const req of wp.requirements) {
      roleAgg.set(req.roleId, {
        roleId: req.roleId,
        roleName: req.role.name,
        roleColor: req.role.color,
        workers: [],
        neededThisWeek: req.quantity,
      });
    }

    for (const a of wp.assignments) {
      if (!roleAgg.has(a.roleId)) {
        roleAgg.set(a.roleId, {
          roleId: a.roleId,
          roleName: a.role.name,
          roleColor: a.role.color,
          workers: [],
          neededThisWeek: 0,
        });
      }
      roleAgg.get(a.roleId)!.workers.push({
        id: a.workerId,
        rut: a.worker.rut,
        fullName: a.worker.fullName,
        habilitado: habilitacionMap.get(a.workerId) ?? false,
      });
    }

    const roles: RoleDotacion[] = Array.from(roleAgg.values())
      .map((r) => {
        const split = computeRoleFillSplit(r.workers, r.neededThisWeek);
        return {
          roleId: r.roleId,
          roleName: r.roleName,
          roleColor: r.roleColor,
          workers: r.workers,
          habilitadosCount: split.habilitadosCount,
          neededThisWeek: r.neededThisWeek,
          filledHabilitado: split.filledHabilitado,
          filledSinHabilitar: split.filledSinHabilitar,
          vacantes: split.vacantes,
        };
      })
      .sort((a, b) => a.roleName.localeCompare(b.roleName));

    const weekWorkerIds = new Set(wp.assignments.map((a) => a.workerId));
    const totalWorkers = weekWorkerIds.size;
    const totalHabilitados = Array.from(weekWorkerIds).filter((id) => habilitacionMap.get(id)).length;
    const criticos = roles.filter((r) => r.workers.length < r.neededThisWeek || r.habilitadosCount === 0).length;

    const cargosTotales = roles.reduce((s, r) => s + r.neededThisWeek, 0);
    const cargosCubiertos = roles.reduce((s, r) => s + r.filledHabilitado + r.filledSinHabilitar, 0);
    const vacantesTotal = roles.reduce((s, r) => s + r.vacantes, 0);

    const cargoMasCritico = roles
      .filter((r) => r.vacantes > 0)
      .sort((a, b) => b.vacantes - a.vacantes)[0];

    return {
      weekNumber: wp.weekNumber,
      weekPlanId: wp.id,
      startDate: wp.startDate,
      endDate: wp.endDate,
      totalWorkers,
      totalHabilitados,
      criticos,
      cargosCubiertos,
      cargosTotales,
      vacantesTotal,
      cargoMasCritico: cargoMasCritico
        ? {
            roleId: cargoMasCritico.roleId,
            roleName: cargoMasCritico.roleName,
            roleColor: cargoMasCritico.roleColor,
            deficit: cargoMasCritico.vacantes,
          }
        : null,
      roles,
    };
  });
}

// ── Pronóstico de próxima vacante crítica (mirando hacia adelante desde hoy) ──

export type CriticalForecast = {
  weekNumber: number;
  startDate: Date;
  weeksFromNow: number;
  roleName: string;
  roleColor: string;
  deficit: number;
} | null;

export async function getProjectCriticalForecast(projectId: string): Promise<CriticalForecast> {
  const weeksData = await getProjectDotacionByWeek(projectId);
  if (weeksData.length === 0) return null;

  const now = Date.now();
  const currentIndex = weeksData.findIndex((w) => now <= w.endDate.getTime());
  const startIndex = currentIndex === -1 ? 0 : currentIndex;

  for (let i = startIndex; i < weeksData.length; i++) {
    const week = weeksData[i];
    if (week.cargoMasCritico) {
      return {
        weekNumber: week.weekNumber,
        startDate: week.startDate,
        weeksFromNow: i - startIndex,
        roleName: week.cargoMasCritico.roleName,
        roleColor: week.cargoMasCritico.roleColor,
        deficit: week.cargoMasCritico.deficit,
      };
    }
  }
  return null;
}

// ── Estadísticas a nivel empresa (cross-proyecto, para el dashboard) ──

export type CompanyStats = {
  vacantesTotal: number;
  dotacionRequerida: number;
  dotacionCubierta: number;
  poolDisponible: number;
  tiempoPromedioPrimeraAsignacionDias: number | null;
  projectsBreakdown: {
    projectId: string; projectName: string; vacantes: number;
    requeridos: number; cubiertos: number;
  }[];
};

export async function getCompanyStats(): Promise<CompanyStats> {
  const activeProjects = await db.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, createdAt: true },
  });

  const projectsBreakdown: {
    projectId: string; projectName: string; vacantes: number;
    requeridos: number; cubiertos: number;
  }[] = [];
  let vacantesTotal = 0;
  let dotacionRequerida = 0;
  let dotacionCubierta = 0;

  for (const project of activeProjects) {
    const weeksData = await getProjectDotacionByWeek(project.id);
    const now = Date.now();
    const currentWeek =
      weeksData.find((w) => now >= w.startDate.getTime() && now <= w.endDate.getTime()) ??
      weeksData[weeksData.length - 1];
    const vacantes = currentWeek?.vacantesTotal ?? 0;
    const requeridos = currentWeek?.cargosTotales ?? 0;
    const cubiertos = currentWeek?.cargosCubiertos ?? 0;
    vacantesTotal += vacantes;
    dotacionRequerida += requeridos;
    dotacionCubierta += cubiertos;
    projectsBreakdown.push({ projectId: project.id, projectName: project.name, vacantes, requeridos, cubiertos });
  }

  // Pool disponible: trabajadores habilitados sin ninguna asignación vigente
  const allWorkers = await getAllWorkers();
  const poolDisponible = allWorkers.filter((w) => w.asignable && w.projects.length === 0).length;

  // Tiempo promedio entre creación del proyecto y su primera asignación de trabajador
  const projectsWithAssignments = await db.project.findMany({
    where: { weekPlans: { some: { assignments: { some: {} } } } },
    select: {
      createdAt: true,
      weekPlans: { select: { assignments: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 } } },
    },
  });

  const deltas: number[] = [];
  for (const p of projectsWithAssignments) {
    const firstAssignment = p.weekPlans
      .flatMap((wp) => wp.assignments)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (firstAssignment) {
      const days = (firstAssignment.createdAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      deltas.push(Math.max(0, days));
    }
  }
  const tiempoPromedioPrimeraAsignacionDias =
    deltas.length > 0 ? Math.round((deltas.reduce((s, d) => s + d, 0) / deltas.length) * 10) / 10 : null;

  return {
    vacantesTotal,
    dotacionRequerida,
    dotacionCubierta,
    poolDisponible,
    tiempoPromedioPrimeraAsignacionDias,
    projectsBreakdown: projectsBreakdown.sort((a, b) => b.vacantes - a.vacantes),
  };
}

// ── Pipeline funnel stats (para el dashboard) ─────────────────────────────────

export type PipelineStats = {
  total: number;
  habilitados: number;
  byStage: { order: number; name: string; type: string; count: number }[];
  pendingReview: { docsCount: number; workersCount: number };
};

export async function getPipelineStats(): Promise<PipelineStats> {
  const [stages, workers, pendingDocs] = await Promise.all([
    db.stage.findMany({ orderBy: { order: "asc" } }),
    db.worker.findMany({ select: { currentStageOrder: true } }),
    db.workerDocument.findMany({ where: { status: "PENDING" }, select: { workerId: true } }),
  ]);

  const maxOrder = stages[stages.length - 1]?.order ?? 4;
  const countMap = new Map<number, number>();
  for (const w of workers) {
    countMap.set(w.currentStageOrder, (countMap.get(w.currentStageOrder) ?? 0) + 1);
  }

  const habilitados = workers.filter((w) => w.currentStageOrder > maxOrder).length;

  return {
    total: workers.length,
    habilitados,
    byStage: stages.map((s) => ({ order: s.order, name: s.name, type: s.type, count: countMap.get(s.order) ?? 0 })),
    pendingReview: {
      docsCount: pendingDocs.length,
      workersCount: new Set(pendingDocs.map((d) => d.workerId)).size,
    },
  };
}

// ── Búsqueda global (⌘K) ──────────────────────────────────────────────────────

export type GlobalSearchData = {
  workers: { id: string; fullName: string; rut: string; stageName: string; habilitado: boolean }[];
  projects: { id: string; name: string; client: string | null; status: string }[];
};

export async function getGlobalSearchData(): Promise<GlobalSearchData> {
  const [workers, projects, stages] = await Promise.all([
    db.worker.findMany({ select: { id: true, fullName: true, rut: true, currentStageOrder: true }, orderBy: { fullName: "asc" } }),
    db.project.findMany({ select: { id: true, name: true, client: true, status: true }, orderBy: { name: "asc" } }),
    db.stage.findMany({ orderBy: { order: "asc" } }),
  ]);

  const maxOrder = stages[stages.length - 1]?.order ?? 4;

  return {
    workers: workers.map((w) => ({
      id: w.id,
      fullName: w.fullName,
      rut: w.rut,
      stageName: w.currentStageOrder > maxOrder
        ? "Habilitado"
        : stages.find((s) => s.order === w.currentStageOrder)?.name ?? "—",
      habilitado: w.currentStageOrder > maxOrder,
    })),
    projects,
  };
}
