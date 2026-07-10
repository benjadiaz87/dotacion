import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type CarnetData = {
  rut: string | null;
  fullName: string | null;
  documentNumber: string | null; // número de serie
  birthDate: string | null;
  expiryDate: string | null;
  nationality: string | null;
};

const EXTRACT_PROMPT = `Eres un extractor de datos de cédulas de identidad chilenas.
Analiza la imagen y extrae los siguientes campos en formato JSON exacto:
{
  "rut": "12345678-9",
  "fullName": "APELLIDO1 APELLIDO2 NOMBRE",
  "documentNumber": "A123456789",
  "birthDate": "DD/MM/YYYY",
  "expiryDate": "DD/MM/YYYY",
  "nationality": "CHILENA"
}

Reglas:
- rut: incluir guión y dígito verificador (ej: 12.345.678-9 o 12345678-9)
- documentNumber: el número de serie que aparece al dorso o reverso de la cédula, puede ser alfanumérico
- Si un campo no es visible, devuelve null
- Devuelve SOLO el JSON, sin texto adicional`;

export async function extractCarnetData(imageBase64: string, mimeType: "image/jpeg" | "image/png" | "image/webp"): Promise<CarnetData> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
          { type: "text", text: EXTRACT_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No se pudo extraer JSON de la respuesta");
  return JSON.parse(jsonMatch[0]) as CarnetData;
}
