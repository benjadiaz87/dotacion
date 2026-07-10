import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type HojaVidaData = {
  folio: string | null;
  codigoVerificacion: string | null;
  rut: string | null;
  fullName: string | null;
  fechaEmision: string | null;
  licencias: string | null; // resumen de licencias vigentes: clase, fecha, municipalidad
  sinAnotaciones: boolean | null;
  anotacionesDetalle: string | null;
};

const EXTRACT_PROMPT = `Eres un extractor de datos de certificados de Hoja de Vida del Conductor chilenos emitidos por el Servicio de Registro Civil e Identificación.
Analiza el documento PDF y extrae los siguientes campos en formato JSON exacto:
{
  "folio": "500705422900",
  "codigoVerificacion": "abe5f012b779",
  "rut": "16.766.409-1",
  "fullName": "BENJAMÍN JACOBO DÍAZ FIGUEROA",
  "fechaEmision": "8 Julio 2026",
  "licencias": "Clase B — obtenida 15/03/2015, Municipalidad de Santiago",
  "sinAnotaciones": true,
  "anotacionesDetalle": null
}

Reglas:
- folio: el número que aparece como "FOLIO :" (ej: 500705422900)
- codigoVerificacion: el código alfanumérico corto que aparece como "Código Verificación"
- rut: formato con puntos y guión (ej: 16.766.409-1)
- fechaEmision: la fecha de emisión del certificado
- licencias: resume TODAS las licencias del Registro Nacional de Conductores que aparezcan (clase, fecha de obtención/control, municipalidad), separadas por "; ". Si no aparecen, null
- sinAnotaciones: true si el registro de anotaciones/infracciones dice "SIN ANOTACIONES" o "NO REGISTRA ANOTACIONES", false si hay anotaciones
- anotacionesDetalle: si sinAnotaciones es false, transcribe TODAS las anotaciones/infracciones que aparezcan, una por línea, con el máximo detalle visible (juzgado, infracción, fecha, sanción). Si sinAnotaciones es true, devuelve null
- Si un campo no es visible, devuelve null
- Devuelve SOLO el JSON, sin texto adicional`;

export async function extractHojaVidaData(pdfBase64: string): Promise<HojaVidaData> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: EXTRACT_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No se pudo extraer JSON de la respuesta");
  return JSON.parse(jsonMatch[0]) as HojaVidaData;
}
