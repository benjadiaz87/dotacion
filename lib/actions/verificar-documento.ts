"use server";

import { assertCanUploadFor } from "@/lib/authz";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { readFile } from "fs/promises";
import path from "path";

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
  status: "VALIDO" | "INVALIDO" | "NO_ENCONTRADO" | "ERROR";
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
): Promise<AntecedentesVerificationResult> {
  const doc = await db.workerDocument.findUnique({ where: { id: workerDocumentId }, select: { workerId: true } });
  if (!doc) throw new Error("Documento no encontrado");
  await assertCanUploadFor(doc.workerId);

  const res = await fetch(`${VERIFICADOR_URL}/verify/antecedentes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folio, codigoVerificacion }),
  });

  if (!res.ok) throw new Error(`Error verificando en RC: ${res.status}`);

  const result: AntecedentesVerificationResult & { ok: boolean } = await res.json();

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
  status: "VIGENTE" | "NO_VIGENTE" | "NO_ENCONTRADO" | "ERROR";
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

  // Persist documentNumber for later manual verification if needed
  if (data.documentNumber) {
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: { documentNumber: data.documentNumber },
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
  const docCheck = await db.workerDocument.findUnique({ where: { id: workerDocumentId }, select: { workerId: true } });
  if (!docCheck) throw new Error("Documento no encontrado");
  await assertCanUploadFor(docCheck.workerId);

  const res = await fetch(`${VERIFICADOR_URL}/verify/carnet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rut, documentNumber }),
  });

  if (!res.ok) throw new Error(`Error verificando en RC: ${res.status}`);

  const result: VerificationResult & { ok: boolean } = await res.json();

  if (result.valid) {
    await db.workerDocument.update({
      where: { id: workerDocumentId },
      data: { status: "APPROVED" },
    });
  }

  return result;
}
