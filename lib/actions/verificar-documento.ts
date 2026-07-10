"use server";

import { assertCanUploadFor, assertCanWrite } from "@/lib/authz";

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

  // Reverso opcional guardado por uploadWorkerDocument
  let reversoUrl: string | null = null;
  try {
    reversoUrl = doc.extractedData ? (JSON.parse(doc.extractedData).reversoUrl ?? null) : null;
  } catch { /* extractedData de una verificación anterior sin reverso */ }
  if (reversoUrl) {
    const backBuffer = await readFile(path.join(process.cwd(), "public", reversoUrl));
    body.back = backBuffer.toString("base64");
    body.backMime = getMime(reversoUrl);
  }

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

  // Guarda clase + vigencia como documentNumber, el vencimiento efectivo
  // (con extensión legal +1 año) en expiresAt, y el payload completo de la IA
  {
    const vigencia = result.fechaVencimientoExtendida ?? result.fechaVencimientoReal;
    const expiresAt = parseFechaVencimiento(vigencia);
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: {
        ...(result.data?.clases
          ? { documentNumber: vigencia ? `${result.data.clases} · vigente hasta ${vigencia}` : result.data.clases }
          : {}),
        ...(expiresAt ? { expiresAt } : {}),
        extractedData: JSON.stringify({
          ...result.data,
          fechaVencimientoReal: result.fechaVencimientoReal,
          fechaVencimientoExtendida: result.fechaVencimientoExtendida,
          ...(reversoUrl ? { reversoUrl } : {}),
        }),
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
  antecedentesDetalle: string | null;
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

  // Guarda folio, fecha de emisión y el payload completo leído por la IA
  const issuedAt = parseFechaVencimiento(data.fechaEmision);
  await db.workerDocument.update({
    where: { id: workerDocumentId },
    data: {
      ...(data.folio ? { documentNumber: data.folio } : {}),
      ...(issuedAt ? { issuedAt } : {}),
      extractedData: JSON.stringify(data),
    },
  });

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

// ─── Hoja de Vida del Conductor ───────────────────────────────────────────────
// Mismo esquema de verificación que antecedentes: folio + código contra el RC.

export type HojaVidaExtracted = {
  folio: string | null;
  codigoVerificacion: string | null;
  rut: string | null;
  fullName: string | null;
  fechaEmision: string | null;
  licencias: string | null;
  sinAnotaciones: boolean | null;
  anotacionesDetalle: string | null;
};

export async function extractHojaVidaFromPdf(
  workerDocumentId: string,
): Promise<HojaVidaExtracted> {
  const doc = await db.workerDocument.findUnique({ where: { id: workerDocumentId } });
  if (!doc) throw new Error("Documento no encontrado");
  await assertCanUploadFor(doc.workerId);

  const filePath = path.join(process.cwd(), "public", doc.fileUrl);
  const buffer = await readFile(filePath);
  const pdfBase64 = buffer.toString("base64");

  const res = await fetch(`${VERIFICADOR_URL}/extract/hoja-vida`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdf: pdfBase64 }),
  });

  if (!res.ok) throw new Error(`Error extrayendo datos: ${await res.text()}`);

  const { data }: { ok: boolean; data: HojaVidaExtracted } = await res.json();

  // Guarda folio, fecha de emisión y el payload completo leído por la IA
  const issuedAt = parseFechaVencimiento(data.fechaEmision);
  await db.workerDocument.update({
    where: { id: workerDocumentId },
    data: {
      ...(data.folio ? { documentNumber: data.folio } : {}),
      ...(issuedAt ? { issuedAt } : {}),
      extractedData: JSON.stringify(data),
    },
  });

  return data;
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

  // Persistir todo lo leído por la IA: N° de serie, vencimiento y payload completo
  const expiresAt = parseFechaVencimiento(data.expiryDate);
  await db.workerDocument.update({
    where: { id: workerDocumentId },
    data: {
      ...(data.documentNumber ? { documentNumber: data.documentNumber } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      extractedData: JSON.stringify(data),
    },
  });

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


// ─── Verificación masiva (admin) ─────────────────────────────────────────────
// Corre la verificación automática de todos los documentos pendientes del
// trabajador cuyo tipo la soporta. Se invoca desde la ficha del trabajador.

export type BulkVerifyItem = {
  documentId: string;
  documentTypeName: string;
  valid: boolean;
  message: string;
};

const hasKw = (n: string, kws: string[]) => kws.some((k) => n.toLowerCase().includes(k));
const kindOf = (name: string): "carnet" | "hoja_vida" | "antecedentes" | "licencia" | null => {
  if (hasKw(name, ["cédula", "cedula", "carnet", "identidad"])) return "carnet";
  if (name.toLowerCase().includes("hoja de vida") && name.toLowerCase().includes("conductor")) return "hoja_vida";
  if (hasKw(name, ["antecedente"])) return "antecedentes";
  if (hasKw(name, ["licencia", "conducir"])) return "licencia";
  return null;
};

export async function verifyAllWorkerDocuments(workerId: string): Promise<BulkVerifyItem[]> {
  await assertCanWrite();

  const docs = await db.workerDocument.findMany({
    where: { workerId, status: "PENDING" },
    include: { documentType: { select: { name: true } } },
  });

  const results: BulkVerifyItem[] = [];
  for (const doc of docs) {
    const kind = kindOf(doc.documentType.name);
    if (!kind) continue;
    const base = { documentId: doc.id, documentTypeName: doc.documentType.name };
    try {
      if (kind === "carnet") {
        const data = await extractCarnetFromImage(doc.id);
        if (!data.rut || !data.documentNumber) {
          results.push({ ...base, valid: false, message: "No se pudo leer RUT o número de serie" });
        } else {
          const r = await verifyCarnetInRC(doc.id, data.rut, data.documentNumber);
          results.push({ ...base, valid: r.valid, message: r.message });
        }
      } else if (kind === "antecedentes" || kind === "hoja_vida") {
        const data = kind === "antecedentes"
          ? await extractAntecedentesFromPdf(doc.id)
          : await extractHojaVidaFromPdf(doc.id);
        if (!data.folio || !data.codigoVerificacion) {
          results.push({ ...base, valid: false, message: "No se pudo leer folio o código de verificación" });
        } else {
          const r = await verifyAntecedentesInRC(doc.id, data.folio, data.codigoVerificacion, data.rut);
          results.push({ ...base, valid: r.valid, message: r.message });
        }
      } else {
        const r = await validateLicenciaDoc(doc.id);
        results.push({ ...base, valid: r.valid, message: r.message });
      }
    } catch (e) {
      results.push({ ...base, valid: false, message: e instanceof Error ? e.message : "Error inesperado" });
    }
  }

  revalidatePath("/dashboard/trabajadores");
  revalidatePath("/dashboard/empleados");
  return results;
}
