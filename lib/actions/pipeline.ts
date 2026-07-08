"use server";

import { assertCanWrite } from "@/lib/authz";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageWithDocs = {
  id: string;
  order: number;
  name: string;
  type: "PROCESO" | "HITO";
  description: string | null;
  requirements: {
    documentTypeId: string;
    documentType: { id: string; name: string; required: boolean };
  }[];
};

export type WorkerPipelineData = {
  workerId: string;
  currentStageOrder: number;
  stages: StageWithDocs[];
  // Documents the worker has already uploaded (keyed by documentTypeId)
  documents: Record<string, { id: string; status: string; fileUrl: string; fileName: string; documentNumber: string | null }>;
  // Exceptions granted (keyed by `${stageId}:${documentTypeId}`)
  exceptions: Record<string, { justification: string; createdAt: Date }>;
  // Primary role (for role-specific doc filtering)
  primaryRoleId: string | null;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getWorkerPipeline(workerId: string): Promise<WorkerPipelineData> {
  const [worker, stages] = await Promise.all([
    db.worker.findUniqueOrThrow({
      where: { id: workerId },
      include: {
        documents: true,
        exceptions: { include: { documentType: true, stage: true } },
        assignments: { include: { role: true }, take: 1, orderBy: { createdAt: "desc" } },
      },
    }),
    db.stage.findMany({
      orderBy: { order: "asc" },
      include: {
        requirements: {
          where: { roleId: null }, // base requirements (all roles)
          include: { documentType: true },
        },
      },
    }),
  ]);

  // Cargo del trabajador (campo propio); fallback a su última asignación
  const primaryRoleId = worker.roleId ?? worker.assignments[0]?.role.id ?? null;

  // Merge role-specific requirements for the worker's role
  if (primaryRoleId) {
    const roleReqs = await db.stageDocRequirement.findMany({
      where: { roleId: primaryRoleId },
      include: { documentType: true },
    });
    for (const req of roleReqs) {
      const stage = stages.find((s) => s.id === req.stageId);
      if (stage && !stage.requirements.some((r) => r.documentTypeId === req.documentTypeId)) {
        stage.requirements.push(req);
      }
    }
  }

  const documents = Object.fromEntries(
    worker.documents.map((d) => [d.documentTypeId, { id: d.id, status: d.status, fileUrl: d.fileUrl, fileName: d.fileName, documentNumber: d.documentNumber }])
  );

  const exceptions = Object.fromEntries(
    worker.exceptions.map((e) => [`${e.stageId}:${e.documentTypeId}`, { justification: e.justification, createdAt: e.createdAt }])
  );

  return {
    workerId,
    currentStageOrder: worker.currentStageOrder,
    stages: stages as StageWithDocs[],
    documents,
    exceptions,
    primaryRoleId,
  };
}

// ─── Advance stage ────────────────────────────────────────────────────────────

export type AdvanceResult =
  | { ok: true; newStageOrder: number }
  | { ok: false; missing: { documentTypeId: string; name: string }[] };

export async function advanceWorkerStage(
  workerId: string,
  fromStageOrder: number,
  exceptions: { documentTypeId: string; justification: string }[]
): Promise<AdvanceResult> {
  await assertCanWrite();
  const worker = await db.worker.findUniqueOrThrow({
    where: { id: workerId },
    include: {
      documents: true,
      assignments: { include: { role: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  if (worker.currentStageOrder !== fromStageOrder) {
    throw new Error("El trabajador ya avanzó de etapa");
  }

  const workerRoleId = worker.roleId ?? worker.assignments[0]?.role.id ?? null;
  const currentStage = await db.stage.findUniqueOrThrow({
    where: { order: fromStageOrder },
    include: {
      requirements: {
        // requisitos base + los específicos del cargo del trabajador
        where: workerRoleId ? { OR: [{ roleId: null }, { roleId: workerRoleId }] } : { roleId: null },
        include: { documentType: true },
      },
    },
  });

  // For HITO stages there are no docs — just advance
  if (currentStage.type === "HITO") {
    const nextStage = await db.stage.findFirst({ where: { order: { gt: fromStageOrder } } });
    if (!nextStage) return { ok: true, newStageOrder: fromStageOrder };

    await db.worker.update({ where: { id: workerId }, data: { currentStageOrder: nextStage.order } });
    revalidatePath(`/dashboard/trabajadores/${workerId}`);
    revalidatePath("/dashboard/empleados");
    return { ok: true, newStageOrder: nextStage.order };
  }

  // Check which required docs are missing
  const exceptionDocIds = new Set(exceptions.map((e) => e.documentTypeId));
  const missing = currentStage.requirements
    .filter((r) => r.documentType.required)
    .filter((r) => {
      const doc = worker.documents.find((d) => d.documentTypeId === r.documentTypeId);
      return (!doc || doc.status !== "APPROVED") && !exceptionDocIds.has(r.documentTypeId);
    });

  if (missing.length > 0) {
    return { ok: false, missing: missing.map((m) => ({ documentTypeId: m.documentTypeId, name: m.documentType.name })) };
  }

  // Save exceptions
  for (const exc of exceptions) {
    await db.workerDocException.create({
      data: {
        workerId,
        documentTypeId: exc.documentTypeId,
        stageId: currentStage.id,
        justification: exc.justification,
      },
    });
  }

  const nextStage = await db.stage.findFirst({ where: { order: { gt: fromStageOrder } } });
  if (!nextStage) return { ok: true, newStageOrder: fromStageOrder };

  await db.worker.update({ where: { id: workerId }, data: { currentStageOrder: nextStage.order } });
  revalidatePath(`/dashboard/trabajadores/${workerId}`);
  revalidatePath("/dashboard/empleados");
  return { ok: true, newStageOrder: nextStage.order };
}

// ─── Update document status (manual review) ───────────────────────────────────

export async function updateDocumentStatus(documentId: string, status: "APPROVED" | "REJECTED") {
  await assertCanWrite();
  const doc = await db.workerDocument.findUniqueOrThrow({ where: { id: documentId }, include: { worker: true } });
  await db.workerDocument.update({ where: { id: documentId }, data: { status } });
  revalidatePath(`/dashboard/trabajadores/${doc.workerId}`);
}
