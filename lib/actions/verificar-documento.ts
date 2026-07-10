"use server";

import { assertCanUploadFor } from "@/lib/authz";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { readFile } from "fs/promises";
import path from "path";

// ─── Licencia de conducir ──────────────────────────────────────────────────────

export type LicenciaExtracted = {
  rut: string | null;
  fullName: string | null;
  fechaNacimiento: string | null;
  fechaVencimiento: string | null;
  clases: string | null;
  restricciones: string | null;
  numero: string | null;
};

export type LicenciaValidationResult = {
  valid: boolean;
  status: "VIGENTE" | "VENCIDA" | "RUT_NO_COINCIDE" | "NO_LEGIBLE" | "ERROR";
  message: string;
  data: LicenciaExtracted;
  fechaVencimientoReal: string | null;
  fechaVencimientoExtendida: string | null;
  diasRestantes: number | null;
};

function getMime(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

// Normaliza RUT para comparación: sin puntos, guiones ni espacios, K mayúscula
function rutMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const norm = (r: string) => r.replace(/[.\s-]/g, "").toUpperCase();
  return norm(a) === norm(b);
}

// Mensaje único para el error de RUT en todas las validaciones
function rutMismatchMessage(rutDocumento: string, rutTrabajador: string): string {
  return `El RUT del documento (${rutDocumento}) no coincide con el RUT del trabajador (${rutTrabajador})`;
}

// Parsea la fecha de vencimiento que la IA lee del documento.
// Acepta: ISO (2027-03-12), dd/mm/yyyy, dd-mm-yyyy, y "12 MAR 2027" (carnets chilenos).
const MESES_ES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11,
};
function parseFechaVencimiento(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const t = raw.trim();

  // ISO: 2027-03-12
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // dd/mm/yyyy o dd-mm-yyyy
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // "12 MAR 2027" / "12 de marzo de 2027"
  m = t.toLowerCase().match(/(\d{1,2})\s*(?:de\s+)?([a-záé]+)\.?\s*(?:de\s+)?(\d{4})/);
  if (m) {
    const mes = MESES_ES[m[2].slice(0, 4)] ?? MESES_ES[m[2].slice(0, 3)];
    if (mes !== undefined) {
      const d = new Date(Date.UTC(+m[3], mes, +m[1]));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

// Persiste el motivo del fallo (o lo limpia si pasó) para mostrarlo en el pipeline
async function saveVerifyNote(workerDocumentId: string, valid: boolean, message: string) {
  await db.workerDocument.update({
    where: { id: workerDocumentId },
    data: { verifyNote: valid ? null : message },
  });
  revalidatePath("/dashboard/trabajadores/[id]", "page");
}

export async function validateLicenciaDoc(
  workerDocumentId: string,
): Promise<LicenciaValidationResult> {
  const doc = await db.workerDocument.findUnique({
    where: { id: workerDocumentId },
    include: { worker: { select: { rut: true } } },
  });
  if (!doc) throw new Error("Documento no encontrado");
  await assertCanUploadFor(doc.workerId);

  const filePath = path.join(process.cwd(), "public", doc.fileUrl);
  const buffer = await readFile(filePath);
  const frontBase64 = buffer.toString("base64");

  const body: Record<string, string> = {
    front: frontBase64,
    frontMime: getMime(doc.fileName),
    workerRut: doc.worker.rut,
  };

  const res = await fetch(`${VERIFICADOR_URL}/validate/licencia`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Los archivos pueden ser grandes — sin timeout corto
  });

  if (!res.ok) throw new Error(`Error validando licencia: ${await res.text()}`);

  const result: LicenciaValidationResult & { ok: boolean } = await res.json();

  // Doble chequeo servidor: el RUT leído debe coincidir con el del trabajador
  if (result.valid && result.data?.rut && !rutMatches(result.data.rut, doc.worker.rut)) {
    const message = rutMismatchMessage(result.data.rut, doc.worker.rut);
    await saveVerifyNote(workerDocumentId, false, message);
    return { ...result, valid: false, status: "RUT_NO_COINCIDE", message };
  }
  await saveVerifyNote(workerDocumentId, result.valid, result.message);

  // Guarda clase + vigencia como documentNumber, y el vencimiento efectivo
  // (con extensión legal +1 año si aplica) en expiresAt para las alertas
  if (result.data?.clases || result.fechaVencimientoExtendida || result.fechaVencimientoReal) {
    const vigencia = result.fechaVencimientoExtendida ?? result.fechaVencimientoReal;
    const expiresAt = parseFechaVencimiento(vigencia);
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: {
        ...(result.data?.clases
          ? { documentNumber: vigencia ? `${result.data.clases} · vigente hasta ${vigencia}` : result.data.clases }
          : {}),
        ...(expiresAt ? { expiresAt } : {}),
      },
    });
  }

  if (result.valid) {
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: { status: "APPROVED" },
    });
    revalidatePath("/dashboard/trabajadores/[id]", "page");
  }

  return result;
}

const VERIFICADOR_URL = process.env.VERIFICADOR_URL ?? "http://localhost:3001";

// ─── Antecedentes ─────────────────────────────────────────────────────────────

export type AntecedentesExtracted = {
  folio: string | null;
  codigoVerificacion: string | null;
  rut: string | null;
  fullName: string | null;
  fechaEmision: string | null;
  tipoFines: string | null;
  sinAntecedentes: boolean | null;
};

export type AntecedentesVerificationResult = {
  valid: boolean;
  status: "VALIDO" | "INVALIDO" | "NO_ENCONTRADO" | "RUT_NO_COINCIDE" | "ERROR";
  message: string;
  confirmedFolio?: string;
  confirmedRut?: string;
};

// Extrae folio + código verificación del PDF vía Claude
export async function extractAntecedentesFromPdf(
  workerDocumentId: string,
): Promise<AntecedentesExtracted> {
  const doc = await db.workerDocument.findUnique({ where: { id: workerDocumentId } });
  if (!doc) throw new Error("Documento no encontrado");
  await assertCanUploadFor(doc.workerId);

  const filePath = path.join(process.cwd(), "public", doc.fileUrl);
  const buffer = await readFile(filePath);
  const pdfBase64 = buffer.toString("base64");

  const res = await fetch(`${VERIFICADOR_URL}/extract/antecedentes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdf: pdfBase64 }),
  });

  if (!res.ok) throw new Error(`Error extrayendo datos: ${await res.text()}`);

  const { data }: { ok: boolean; data: AntecedentesExtracted } = await res.json();

  // Guarda el folio como documentNumber para futuras referencias
  if (data.folio) {
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: { documentNumber: data.folio },
    });
  }

  return data;
}

// Verifica en Registro Civil usando folio + código, aprueba si es válido
export async function verifyAntecedentesInRC(
  workerDocumentId: string,
  folio: string,
  codigoVerificacion: string,
  rutExtraido?: string | null,
): Promise<AntecedentesVerificationResult> {
  const doc = await db.workerDocument.findUnique({
    where: { id: workerDocumentId },
    select: { workerId: true, worker: { select: { rut: true } } },
  });
  if (!doc) throw new Error("Documento no encontrado");
  await assertCanUploadFor(doc.workerId);

  // El RUT del certificado debe ser el del trabajador de la ficha
  if (rutExtraido && !rutMatches(rutExtraido, doc.worker.rut)) {
    const message = rutMismatchMessage(rutExtraido, doc.worker.rut);
    await saveVerifyNote(workerDocumentId, false, message);
    return { valid: false, status: "RUT_NO_COINCIDE", message };
  }

  const res = await fetch(`${VERIFICADOR_URL}/verify/antecedentes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folio, codigoVerificacion }),
  });

  if (!res.ok) throw new Error(`Error verificando en RC: ${res.status}`);

  const result: AntecedentesVerificationResult & { ok: boolean } = await res.json();

  // Si el RC devuelve el RUT confirmado del folio, también debe coincidir
  if (result.valid && result.confirmedRut && !rutMatches(result.confirmedRut, doc.worker.rut)) {
    const message = rutMismatchMessage(result.confirmedRut, doc.worker.rut);
    await saveVerifyNote(workerDocumentId, false, message);
    return { ...result, valid: false, status: "RUT_NO_COINCIDE", message };
  }
  await saveVerifyNote(workerDocumentId, result.valid, result.message);

  if (result.valid) {
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: { status: "APPROVED" },
    });
    revalidatePath("/dashboard/trabajadores/[id]", "page");
  }

  return result;
}

export type CarnetExtracted = {
  rut: string | null;
  fullName: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  expiryDate: string | null;
  nationality: string | null;
};

export type VerificationResult = {
  valid: boolean;
  status: "VIGENTE" | "NO_VIGENTE" | "NO_ENCONTRADO" | "RUT_NO_COINCIDE" | "ERROR";
  message: string;
  confirmedRut?: string;
  confirmedDocumentNumber?: string;
};

// Step 1 — extract data from image via Claude Vision, save documentNumber to DB
// Reads the file from disk using the saved fileUrl — avoids passing large base64 through server action args
export async function extractCarnetFromImage(
  workerDocumentId: string,
): Promise<CarnetExtracted> {
  const doc = await db.workerDocument.findUnique({ where: { id: workerDocumentId } });
  if (!doc) throw new Error("Documento no encontrado");
  await assertCanUploadFor(doc.workerId);

  const filePath = path.join(process.cwd(), "public", doc.fileUrl);
  const buffer = await readFile(filePath);
  const imageBase64 = buffer.toString("base64");
  const ext = doc.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  const res = await fetch(`${VERIFICADOR_URL}/extract/carnet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64, mimeType }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error extrayendo datos: ${err}`);
  }

  const { data }: { ok: boolean; data: CarnetExtracted } = await res.json();

  // Persistir N° de serie y fecha de vencimiento leída por la IA
  const expiresAt = parseFechaVencimiento(data.expiryDate);
  if (data.documentNumber || expiresAt) {
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: {
        ...(data.documentNumber ? { documentNumber: data.documentNumber } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      },
    });
  }

  return data;
}

// Step 2 — verify in Registro Civil, update status if valid
export async function verifyCarnetInRC(
  workerDocumentId: string,
  rut: string,
  documentNumber: string
): Promise<VerificationResult> {
  const docCheck = await db.workerDocument.findUnique({
    where: { id: workerDocumentId },
    select: { workerId: true, worker: { select: { rut: true } } },
  });
  if (!docCheck) throw new Error("Documento no encontrado");
  await assertCanUploadFor(docCheck.workerId);

  // El RUT leído del carnet debe ser el del trabajador de la ficha
  if (!rutMatches(rut, docCheck.worker.rut)) {
    const message = rutMismatchMessage(rut, docCheck.worker.rut);
    await saveVerifyNote(workerDocumentId, false, message);
    return { valid: false, status: "RUT_NO_COINCIDE", message };
  }

  const res = await fetch(`${VERIFICADOR_URL}/verify/carnet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rut, documentNumber }),
  });

  if (!res.ok) throw new Error(`Error verificando en RC: ${res.status}`);

  const result: VerificationResult & { ok: boolean } = await res.json();

  // Si el RC devuelve el RUT confirmado, también debe coincidir
  if (result.valid && result.confirmedRut && !rutMatches(result.confirmedRut, docCheck.worker.rut)) {
    const message = rutMismatchMessage(result.confirmedRut, docCheck.worker.rut);
    await saveVerifyNote(workerDocumentId, false, message);
    return { ...result, valid: false, status: "RUT_NO_COINCIDE", message };
  }
  await saveVerifyNote(workerDocumentId, result.valid, result.message);

  if (result.valid) {
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: { status: "APPROVED" },
    });
  }

  return result;
}
