import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Certificado de Inscripción en el Registro Nacional de Prestadores Individuales
// de Salud (Superintendencia de Salud). Se valida con el "código validación".
export type SnsData = {
  codigoValidacion: string | null;
  run: string | null;
  fullName: string | null;
  numeroInscripcion: string | null;
  fechaRegistro: string | null;
  sexo: string | null;
  nacionalidad: string | null;
  fechaNacimiento: string | null;
  ordenProfesional: string | null; // profesión + título/universidad/fecha
  fechaEmision: string | null;
};

const EXTRACT_PROMPT = `Eres un extractor de datos de "Certificados de Inscripción en el Registro Nacional de Prestadores Individuales de Salud" emitidos por la Superintendencia de Salud de Chile (credencial SNS).
Analiza el documento PDF y extrae los siguientes campos en formato JSON exacto:
{
  "codigoValidacion": "1v1eNTkIk",
  "run": "15.261.534-5",
  "fullName": "María Fernanda Quiroz Ulzurrún",
  "numeroInscripcion": "66082",
  "fechaRegistro": "01/07/2010",
  "sexo": "Femenino",
  "nacionalidad": "Chilena",
  "fechaNacimiento": "05/05/1982",
  "ordenProfesional": "Psicólogo — título otorgado por la Universidad del Desarrollo, emitido el 13/10/2008",
  "fechaEmision": "21 de Julio de 2026"
}

Reglas:
- codigoValidacion: el código alfanumérico corto que aparece como "código validación:" (respeta mayúsculas/minúsculas exactas)
- run: formato con puntos y guión (ej: 15.261.534-5)
- numeroInscripcion: el número que sigue a "bajo el N°" (ej: 66082)
- fechaRegistro: la "Fecha de registro"
- ordenProfesional: resume la profesión y su título (universidad y fecha de emisión del título). Si hay varias órdenes profesionales, sepáralas con "; "
- fechaEmision: la fecha en que se otorgó el certificado ("Otorgado en ... con fecha ...")
- Si un campo no es visible, devuelve null
- Devuelve SOLO el JSON, sin texto adicional`;

export async function extractSnsData(pdfBase64: string): Promise<SnsData> {
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
  return JSON.parse(jsonMatch[0]) as SnsData;
}
