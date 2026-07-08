"use server";

import { assertCanUploadFor } from "@/lib/authz";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { readFile } from "fs/promises";
import path from "path";

const VERIFICADOR_URL = process.env.VERIFICADOR_URL ?? "http://localhost:3001";

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
