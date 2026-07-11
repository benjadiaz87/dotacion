"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Guards ───────────────────────────────────────────────────────────────────

import { assertSuperadmin, assertAuthenticated, assertCanWrite } from "@/lib/authz";

const assertCargoAdmin = assertSuperadmin;

// ─── Queries ──────────────────────────────────────────────────────────────────

export type RoleWithRequirements = {
  id: string;
  name: string;
  category: string;
  color: string;
  workersCount: number;
  requirements: {
    id: string;
    stageId: string;
    stageOrder: number;
    documentTypeId: string;
    documentTypeName: string;
    required: boolean;
  }[];
};

export type CargosData = {
  roles: RoleWithRequirements[];
  stages: { id: string; order: number; name: string }[];
  documentTypes: { id: string; name: string; required: boolean }[];
  baseRequirements: { stageId: string; documentTypeId: string; documentTypeName: string }[];
};

export async function getCargosData(): Promise<CargosData> {
  await assertAuthenticated();
  const [roles, stages, documentTypes, baseReqs] = await Promise.all([
    db.role.findMany({
      orderBy: { name: "asc" },
      include: {
        stageReqs: { include: { documentType: true, stage: true } },
        _count: { select: { workers: true } },
      },
    }),
    db.stage.findMany({ orderBy: { order: "asc" }, select: { id: true, order: true, name: true } }),
    db.documentType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, required: true } }),
    db.stageDocRequirement.findMany({
      where: { roleId: null },
      include: { documentType: true },
    }),
  ]);

  return {
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      color: r.color,
      workersCount: r._count.workers,
      requirements: r.stageReqs.map((sr) => ({
        id: sr.id,
        stageId: sr.stageId,
        stageOrder: sr.stage.order,
        documentTypeId: sr.documentTypeId,
        documentTypeName: sr.documentType.name,
        required: sr.documentType.required,
      })),
    })),
    stages,
    documentTypes,
    baseRequirements: baseReqs.map((b) => ({
      stageId: b.stageId,
      documentTypeId: b.documentTypeId,
      documentTypeName: b.documentType.name,
    })),
  };
}

// ─── Detalle de un cargo (página del pipeline del cargo) ──────────────────────

// Los 7 documentos recomendados de precontratación (Etapa 1)
const STAGE1_RECOMMENDED = [
  "Cédula de Identidad",
  "Certificado de Antecedentes",
  "Licencia de conducir vigente",
  "Credencial SNS",
  "Credencial Sernageomin",
  "Hoja de Vida del Conductor",
  "Título profesional/Técnico",
];

export type RoleDetail = {
  role: { id: string; name: string; category: string; color: string; workersCount: number };
  stages: { id: string; order: number; name: string; description: string | null }[];
  // requisitos del cargo agrupados por stageId
  requirements: Record<string, { id: string; documentTypeId: string; name: string; required: boolean }[]>;
  documentTypes: { id: string; name: string; required: boolean }[];
  stage1Recommended: { id: string; name: string; required: boolean }[];
};

export async function getRoleDetail(roleId: string): Promise<RoleDetail | null> {
  await assertAuthenticated();
  const [role, stages, documentTypes] = await Promise.all([
    db.role.findUnique({
      where: { id: roleId },
      include: {
        stageReqs: { include: { documentType: true } },
        _count: { select: { workers: true } },
      },
    }),
    db.stage.findMany({ orderBy: { order: "asc" } }),
    db.documentType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, required: true } }),
  ]);
  if (!role) return null;

  const requirements: RoleDetail["requirements"] = {};
  for (const sr of role.stageReqs) {
    (requirements[sr.stageId] ??= []).push({
      id: sr.id,
      documentTypeId: sr.documentTypeId,
      name: sr.documentType.name,
      required: sr.documentType.required,
    });
  }
  for (const list of Object.values(requirements)) list.sort((a, b) => a.name.localeCompare(b.name));

  const stage1Recommended = documentTypes.filter((dt) => STAGE1_RECOMMENDED.includes(dt.name));

  return {
    role: { id: role.id, name: role.name, category: role.category, color: role.color, workersCount: role._count.workers },
    stages: stages.map((s) => ({ id: s.id, order: s.order, name: s.name, description: s.description })),
    requirements,
    documentTypes,
    stage1Recommended,
  };
}

// ─── Mutations: roles ─────────────────────────────────────────────────────────

export async function createRole(name: string, category: string, color: string) {
  await assertCargoAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre del cargo es obligatorio");
  const existing = await db.role.findUnique({ where: { name: trimmed } });
  if (existing) throw new Error("Ya existe un cargo con ese nombre");
  const role = await db.role.create({ data: { name: trimmed, category, color } });
  revalidatePath("/dashboard/cargos");
  return role.id;
}

export type DeleteRoleResult =
  | { ok: true }
  | { ok: false; needsConfirm: true; workers: number; assignments: number; planRequirements: number }
  | { ok: false; needsConfirm?: false; reason: string };

export async function deleteRole(roleId: string, force = false): Promise<DeleteRoleResult> {
  await assertCargoAdmin();
  const [workers, assignments, planRequirements] = await Promise.all([
    db.worker.count({ where: { roleId } }),
    db.workerAssignment.count({ where: { roleId } }),
    db.roleRequirement.count({ where: { roleId } }),
  ]);

  const inUse = workers > 0 || assignments > 0 || planRequirements > 0;
  if (inUse && !force) {
    return { ok: false, needsConfirm: true, workers, assignments, planRequirements };
  }

  await db.$transaction([
    // Trabajadores quedan sin cargo (sus pipelines se recalculan abajo)
    db.worker.updateMany({ where: { roleId }, data: { roleId: null } }),
    // Asignaciones a proyectos y requerimientos de planificación del cargo
    db.workerAssignment.deleteMany({ where: { roleId } }),
    db.roleRequirement.deleteMany({ where: { roleId } }),
    // Requisitos documentales del cargo
    db.stageDocRequirement.deleteMany({ where: { roleId } }),
    db.role.delete({ where: { id: roleId } }),
  ]);

  if (inUse) await recalcAllWorkerStages();
  revalidatePath("/dashboard/cargos");
  revalidatePath("/dashboard/empleados");
  return { ok: true };
}

// ─── Mutations: requisitos documentales ───────────────────────────────────────

// Selecciona un tipo de documento existente como requisito del cargo en una etapa
export async function addRoleRequirement(roleId: string, stageId: string, documentTypeId: string) {
  await assertCargoAdmin();
  const dup = await db.stageDocRequirement.findFirst({ where: { roleId, stageId, documentTypeId } });
  if (dup) throw new Error("Ese requisito ya existe para este cargo y etapa");
  await db.stageDocRequirement.create({ data: { roleId, stageId, documentTypeId } });
  await recalcAllWorkerStages();
  revalidatePath("/dashboard/cargos");
  return { ok: true };
}

// Añade varios requisitos de una vez (prellenado recomendado de Etapa 1)
export async function addManyRoleRequirements(roleId: string, stageId: string, documentTypeIds: string[]) {
  await assertCargoAdmin();
  let added = 0;
  for (const documentTypeId of documentTypeIds) {
    const dup = await db.stageDocRequirement.findFirst({ where: { roleId, stageId, documentTypeId } });
    if (!dup) {
      await db.stageDocRequirement.create({ data: { roleId, stageId, documentTypeId } });
      added++;
    }
  }
  if (added > 0) await recalcAllWorkerStages();
  revalidatePath("/dashboard/cargos");
  return { added };
}

// Crea un tipo de documento nuevo y lo asocia como requisito del cargo
export async function createDocTypeForRole(
  roleId: string,
  stageId: string,
  name: string,
  required: boolean
) {
  await assertCargoAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre del documento es obligatorio");
  let docType = await db.documentType.findUnique({ where: { name: trimmed } });
  if (!docType) {
    docType = await db.documentType.create({ data: { name: trimmed, required } });
  }
  const dup = await db.stageDocRequirement.findFirst({ where: { roleId, stageId, documentTypeId: docType.id } });
  if (dup) throw new Error("Ese requisito ya existe para este cargo y etapa");
  await db.stageDocRequirement.create({ data: { roleId, stageId, documentTypeId: docType.id } });
  await recalcAllWorkerStages();
  revalidatePath("/dashboard/cargos");
  return { ok: true };
}

export async function removeRoleRequirement(requirementId: string) {
  await assertCargoAdmin();
  const req = await db.stageDocRequirement.findUniqueOrThrow({ where: { id: requirementId } });
  if (req.roleId === null) throw new Error("No se pueden eliminar requisitos base desde aquí");
  await db.stageDocRequirement.delete({ where: { id: requirementId } });
  await recalcAllWorkerStages();
  revalidatePath("/dashboard/cargos");
  return { ok: true };
}

// ─── Recalcular pipelines ─────────────────────────────────────────────────────
// Reubica a cada trabajador en la primera etapa cuyos requisitos (base + cargo)
// no estén completos. Si todo está OK queda habilitado (stagesTotal + 1).

export async function recalcAllWorkerStages(): Promise<{ moved: number }> {
  await assertCanWrite();
  const [stages, allReqs, workers] = await Promise.all([
    db.stage.findMany({ orderBy: { order: "asc" }, select: { id: true, order: true } }),
    db.stageDocRequirement.findMany({ include: { documentType: { select: { required: true } } } }),
    db.worker.findMany({
      include: {
        documents: { select: { documentTypeId: true, status: true } },
        exceptions: { select: { stageId: true, documentTypeId: true } },
      },
    }),
  ]);

  let moved = 0;

  for (const w of workers) {
    const approved = new Set(w.documents.filter((d) => d.status === "APPROVED").map((d) => d.documentTypeId));
    const excepted = new Set(w.exceptions.map((e) => `${e.stageId}:${e.documentTypeId}`));

    let newOrder = stages.length + 1; // habilitado si completa todo
    for (const stage of stages) {
      const reqs = allReqs.filter(
        (r) =>
          r.stageId === stage.id &&
          r.documentType.required &&
          (r.roleId === null || r.roleId === w.roleId)
      );
      const complete = reqs.every(
        (r) => approved.has(r.documentTypeId) || excepted.has(`${stage.id}:${r.documentTypeId}`)
      );
      if (!complete) {
        newOrder = stage.order;
        break;
      }
    }

    if (newOrder !== w.currentStageOrder) {
      await db.worker.update({ where: { id: w.id }, data: { currentStageOrder: newOrder } });
      moved++;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/empleados");
  return { moved };
}
