import { auth } from "@/lib/auth";
import { resolveUploadPath } from "@/lib/uploads";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Entrega autenticada de documentos: contienen datos personales sensibles,
// por lo que nunca se sirven como estáticos públicos.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { path: parts } = await params;
  let abs: string;
  try {
    abs = resolveUploadPath(`/uploads/${parts.join("/")}`);
  } catch {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  try {
    const buffer = await readFile(abs);
    const ext = (abs.split(".").pop() ?? "").toLowerCase();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
