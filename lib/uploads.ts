import path from "path";
import { mkdir, writeFile } from "fs/promises";

// Los archivos subidos viven FUERA de public/ para que nunca se sirvan
// estáticamente sin autenticación: se entregan vía app/uploads/[...path],
// que exige sesión. En Railway el volumen se monta aquí (ver railway-start.sh).
export const UPLOADS_ROOT =
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "storage", "uploads");

// Tipos permitidos para documentos y capturas
export const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export function safeExtension(fileName: string): string {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(`Tipo de archivo no permitido (.${ext}). Usa: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }
  return ext;
}

export function assertUploadSize(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`El archivo supera el máximo de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`);
  }
}

/** Resuelve una fileUrl tipo "/uploads/x.pdf" a su ruta en disco, bloqueando path traversal. */
export function resolveUploadPath(fileUrl: string): string {
  const rel = fileUrl.replace(/^\/uploads\//, "");
  const abs = path.normalize(path.join(UPLOADS_ROOT, rel));
  if (!abs.startsWith(path.normalize(UPLOADS_ROOT) + path.sep)) {
    throw new Error("Ruta de archivo inválida");
  }
  return abs;
}

/** Guarda un buffer bajo UPLOADS_ROOT y devuelve la fileUrl pública ("/uploads/…"). */
export async function saveUpload(relPath: string, buffer: Buffer): Promise<string> {
  const abs = resolveUploadPath(`/uploads/${relPath}`);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return `/uploads/${relPath}`;
}
