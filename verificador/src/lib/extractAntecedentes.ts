import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type AntecedentesData = {
  folio: string | null;
  codigoVerificacion: string | null;
  rut: string | null;
  fullName: string | null;
  fechaEmision: string | null;
  tipoFines: string | null;
  sinAntecedentes: boolean | null;
  antecedentesDetalle: string | null;
};

const EXTRACT_PROMPT = `Eres un extractor de datos de certificados de antecedentes chilenos emitidos por el Servicio de Registro Civil e Identificación.
Analiza el documento PDF y extrae los siguientes campos en formato JSON exacto:
{
  "folio": "500705067198",
  "codigoVerificacion": "abe5f012b779",
  "rut": "16.766.409-1",
  "fullName": "BENJAMÍN JACOBO DÍAZ FIGUEROA",
  "fechaEmision": "8 Julio 2026",
  "tipoFines": "FINES PARTICULARES",
  "sinAntecedentes": true,
  "antecedentesDetalle": null
}

Reglas:
- folio: el número que aparece como "FOLIO :" o "REPUBLICA DE CHILE" seguido de número
- codigoVerificacion: el código alfanumérico corto que aparece como "Código Verificación" (ej: abe5f012b779)
- rut: formato con puntos y guión (ej: 16.766.409-1)
- sinAntecedentes: true si dice "SIN ANTECEDENTES" en el registro de condenas, false si hay condenas
- antecedentesDetalle: si sinAntecedentes es false, transcribe TODAS las condenas/anotaciones que aparezcan, una por línea, con el máximo detalle visible (tribunal/causa, delito, pena, fecha). Si sinAntecedentes es true, devuelve null
- tipoFines: el tipo de certificado (FINES PARTICULARES, FINES ESPECIALES, etc.)
- Si un campo no es visible, devuelve null
- Devuelve SOLO el JSON, sin texto adicional`;

export async function extractAntecedentesData(pdfBase64: string): Promise<AntecedentesData> {
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
  return JSON.parse(jsonMatch[0]) as AntecedentesData;
}
