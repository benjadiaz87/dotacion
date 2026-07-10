import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type LicenciaData = {
  rut: string | null;
  fullName: string | null;
  fechaNacimiento: string | null;
  fechaVencimiento: string | null;       // DD/MM/YYYY
  clases: string | null;                 // ej: "B", "A2, B", "C"
  restricciones: string | null;
  numero: string | null;                 // número de licencia si aparece
};

export type LicenciaValidationResult = {
  valid: boolean;
  status: "VIGENTE" | "VENCIDA" | "RUT_NO_COINCIDE" | "NO_LEGIBLE" | "ERROR";
  message: string;
  data: LicenciaData;
  fechaVencimientoReal: string | null;   // fecha en el documento
  fechaVencimientoExtendida: string | null; // +1 año por extensión legal
  diasRestantes: number | null;
};

const EXTRACT_PROMPT = `Eres un extractor de datos de licencias de conducir chilenas.
Analiza la imagen o documento y extrae los siguientes campos en formato JSON exacto:
{
  "rut": "12.345.678-9",
  "fullName": "APELLIDO1 APELLIDO2 NOMBRE",
  "fechaNacimiento": "DD/MM/YYYY",
  "fechaVencimiento": "DD/MM/YYYY",
  "clases": "B",
  "restricciones": "NINGUNA",
  "numero": "123456789"
}

Reglas:
- rut: con puntos y guión (ej: 16.766.409-1)
- fechaVencimiento: la fecha de expiración o vencimiento de la licencia, formato DD/MM/YYYY
- clases: las clases habilitadas (A1, A2, A3, A4, B, C, D, E, F) separadas por coma si hay varias
- restricciones: cualquier restricción indicada, o "NINGUNA" si no hay
- numero: número o código de la licencia si es visible, null si no
- Si un campo no es visible o no existe, devuelve null
- Devuelve SOLO el JSON, sin texto adicional`;

type ImageInput = { base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf" };

function toContentBlock(img: ImageInput) {
  return img.mimeType === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: img.base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: img.mimeType, data: img.base64 } };
}

export async function extractLicenciaData(
  front: ImageInput,
  back?: ImageInput,  // reverso opcional — aporta número de serie, restricciones, etc.
): Promise<LicenciaData> {
  const imageBlocks = [toContentBlock(front), ...(back ? [toContentBlock(back)] : [])];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: [
        ...imageBlocks,
        { type: "text", text: back
            ? EXTRACT_PROMPT + "\n\nNota: Se adjuntan ambos lados de la licencia. Combina la información de anverso y reverso para un resultado completo."
            : EXTRACT_PROMPT
        },
      ],
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No se pudo extraer JSON de la respuesta");
  return JSON.parse(jsonMatch[0]) as LicenciaData;
}

function parseDate(str: string): Date | null {
  // Accepts DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  const parts = str.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  let day: number, month: number, year: number;
  if (parts[0].length === 4) {
    [year, month, day] = parts.map(Number);
  } else {
    [day, month, year] = parts.map(Number);
  }
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function validateLicencia(data: LicenciaData, workerRut?: string): LicenciaValidationResult {
  if (!data.fechaVencimiento) {
    return {
      valid: false,
      status: "NO_LEGIBLE",
      message: "No se pudo leer la fecha de vencimiento de la licencia",
      data,
      fechaVencimientoReal: null,
      fechaVencimientoExtendida: null,
      diasRestantes: null,
    };
  }

  const fechaOriginal = parseDate(data.fechaVencimiento);
  if (!fechaOriginal) {
    return {
      valid: false,
      status: "NO_LEGIBLE",
      message: `Fecha de vencimiento no reconocida: ${data.fechaVencimiento}`,
      data,
      fechaVencimientoReal: data.fechaVencimiento,
      fechaVencimientoExtendida: null,
      diasRestantes: null,
    };
  }

  // Extensión legal de 1 año aplicada a todas las licencias chilenas
  const fechaExtendida = new Date(fechaOriginal);
  fechaExtendida.setFullYear(fechaExtendida.getFullYear() + 1);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diasRestantes = Math.ceil((fechaExtendida.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  // Cruce de RUT si se proporciona
  if (workerRut && data.rut) {
    const normalizeRut = (r: string) => r.replace(/[.\-\s]/g, "").toUpperCase();
    if (normalizeRut(data.rut) !== normalizeRut(workerRut)) {
      return {
        valid: false,
        status: "RUT_NO_COINCIDE",
        message: `El RUT del documento (${data.rut}) no coincide con el del trabajador (${workerRut})`,
        data,
        fechaVencimientoReal: formatDate(fechaOriginal),
        fechaVencimientoExtendida: formatDate(fechaExtendida),
        diasRestantes,
      };
    }
  }

  if (fechaExtendida < hoy) {
    return {
      valid: false,
      status: "VENCIDA",
      message: `Licencia vencida. Venció el ${formatDate(fechaOriginal)} (extendida hasta ${formatDate(fechaExtendida)})`,
      data,
      fechaVencimientoReal: formatDate(fechaOriginal),
      fechaVencimientoExtendida: formatDate(fechaExtendida),
      diasRestantes,
    };
  }

  return {
    valid: true,
    status: "VIGENTE",
    message: `Licencia vigente hasta ${formatDate(fechaExtendida)} (${diasRestantes} días restantes)`,
    data,
    fechaVencimientoReal: formatDate(fechaOriginal),
    fechaVencimientoExtendida: formatDate(fechaExtendida),
    diasRestantes,
  };
}
