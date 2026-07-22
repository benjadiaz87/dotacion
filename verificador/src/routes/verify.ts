import { FastifyInstance } from "fastify";
import { extractCarnetData, type CarnetData } from "../lib/vision.js";
import { verifyCarnet } from "../verifiers/registro-civil.js";
import { extractAntecedentesData, type AntecedentesData } from "../lib/extractAntecedentes.js";
import { extractHojaVidaData } from "../lib/extractHojaVida.js";
import { verifyAntecedentes } from "../verifiers/antecedentes.js";
import { extractLicenciaData, validateLicencia } from "../lib/extractLicencia.js";
import { extractSnsData } from "../lib/extractSns.js";
import { verifySns } from "../verifiers/superdesalud.js";

export async function verifyRoutes(app: FastifyInstance) {
  // POST /extract/carnet  — solo extrae datos de la imagen
  app.post<{ Body: { image: string; mimeType?: string } }>("/extract/carnet", async (req, reply) => {
    const { image, mimeType = "image/jpeg" } = req.body;
    if (!image) return reply.status(400).send({ error: "image requerida (base64)" });

    const data = await extractCarnetData(image, mimeType as any);
    return reply.send({ ok: true, data });
  });

  // POST /verify/carnet  — solo verifica en RC
  app.post<{ Body: { rut: string; documentNumber: string } }>("/verify/carnet", async (req, reply) => {
    const { rut, documentNumber } = req.body;
    if (!rut || !documentNumber) return reply.status(400).send({ error: "rut y documentNumber requeridos" });

    const result = await verifyCarnet(rut, documentNumber);
    return reply.send({ ok: result.valid, ...result });
  });

  // POST /process/carnet  — extrae + verifica en una sola llamada
  app.post<{ Body: { image: string; mimeType?: string } }>("/process/carnet", async (req, reply) => {
    const { image, mimeType = "image/jpeg" } = req.body;
    if (!image) return reply.status(400).send({ error: "image requerida (base64)" });

    // 1. Extraer datos con Claude Vision
    let carnetData: CarnetData;
    try {
      carnetData = await extractCarnetData(image, mimeType as any);
    } catch (err) {
      return reply.status(422).send({ error: "No se pudo extraer datos de la imagen", detail: String(err) });
    }

    if (!carnetData.rut || !carnetData.documentNumber) {
      return reply.send({
        ok: false,
        extracted: carnetData,
        verification: null,
        message: "No se encontraron RUT o número de serie en la imagen",
      });
    }

    // 2. Verificar en Registro Civil
    const verification = await verifyCarnet(carnetData.rut, carnetData.documentNumber);

    return reply.send({
      ok: verification.valid,
      extracted: carnetData,
      verification,
    });
  });

  // POST /extract/hoja-vida  — extrae datos de la Hoja de Vida del Conductor (PDF base64)
  app.post<{ Body: { pdf: string } }>("/extract/hoja-vida", async (req, reply) => {
    const { pdf } = req.body;
    if (!pdf) return reply.status(400).send({ error: "pdf requerido (base64)" });
    const data = await extractHojaVidaData(pdf);
    return reply.send({ ok: true, data });
  });

  // POST /extract/antecedentes  — extrae folio + código del PDF (base64)
  app.post<{ Body: { pdf: string } }>("/extract/antecedentes", async (req, reply) => {
    const { pdf } = req.body;
    if (!pdf) return reply.status(400).send({ error: "pdf requerido (base64)" });

    try {
      const data = await extractAntecedentesData(pdf);
      return reply.send({ ok: true, data });
    } catch (err) {
      return reply.status(422).send({ error: "No se pudo extraer datos del PDF", detail: String(err) });
    }
  });

  // POST /verify/antecedentes  — verifica en RC con folio + código
  app.post<{ Body: { folio: string; codigoVerificacion: string } }>("/verify/antecedentes", async (req, reply) => {
    const { folio, codigoVerificacion } = req.body;
    if (!folio || !codigoVerificacion) return reply.status(400).send({ error: "folio y codigoVerificacion requeridos" });

    const result = await verifyAntecedentes(folio, codigoVerificacion);
    return reply.send({ ok: result.valid, ...result });
  });

  // POST /process/antecedentes  — extrae del PDF + verifica en RC en una sola llamada
  app.post<{ Body: { pdf: string } }>("/process/antecedentes", async (req, reply) => {
    const { pdf } = req.body;
    if (!pdf) return reply.status(400).send({ error: "pdf requerido (base64)" });

    // 1. Extraer datos con Claude
    let antecedentesData: AntecedentesData;
    try {
      antecedentesData = await extractAntecedentesData(pdf);
    } catch (err) {
      return reply.status(422).send({ error: "No se pudo extraer datos del PDF", detail: String(err) });
    }

    if (!antecedentesData.folio || !antecedentesData.codigoVerificacion) {
      return reply.send({
        ok: false,
        extracted: antecedentesData,
        verification: null,
        message: "No se encontraron folio o código de verificación en el PDF",
      });
    }

    // 2. Verificar en Registro Civil
    const verification = await verifyAntecedentes(antecedentesData.folio, antecedentesData.codigoVerificacion);

    return reply.send({
      ok: verification.valid,
      extracted: antecedentesData,
      verification,
    });
  });

  // POST /validate/licencia  — extrae + valida vigencia localmente (sin RC)
  // Acepta anverso (front) + reverso opcional (back). Cada uno puede ser imagen o PDF.
  app.post<{ Body: {
    front: string; frontMime?: string;
    back?: string; backMime?: string;
    workerRut?: string;
  } }>("/validate/licencia", async (req, reply) => {
    const { front, frontMime = "image/jpeg", back, backMime = "image/jpeg", workerRut } = req.body;
    if (!front) return reply.status(400).send({ error: "front requerido (base64 del anverso)" });

    try {
      const frontInput = { base64: front, mimeType: frontMime as any };
      const backInput  = back ? { base64: back, mimeType: backMime as any } : undefined;
      const data = await extractLicenciaData(frontInput, backInput);
      const result = validateLicencia(data, workerRut);
      return reply.send({ ok: result.valid, ...result });
    } catch (err) {
      return reply.status(422).send({ error: "No se pudo procesar el documento", detail: String(err) });
    }
  });

  // GET /health
  // ─── Credencial SNS (Superintendencia de Salud) ────────────────────────────
  // POST /extract/sns  — extrae datos de la credencial (PDF base64)
  app.post<{ Body: { pdf: string } }>("/extract/sns", async (req, reply) => {
    const { pdf } = req.body;
    if (!pdf) return reply.status(400).send({ error: "pdf requerido (base64)" });
    try {
      const data = await extractSnsData(pdf);
      return reply.send({ ok: true, data });
    } catch (err) {
      return reply.status(422).send({ error: "No se pudo extraer datos del PDF", detail: String(err) });
    }
  });

  // POST /verify/sns  — valida el código en la Superintendencia de Salud
  app.post<{ Body: { codigoValidacion: string; run?: string } }>("/verify/sns", async (req, reply) => {
    const { codigoValidacion, run } = req.body;
    if (!codigoValidacion) return reply.status(400).send({ error: "codigoValidacion requerido" });
    const result = await verifySns(codigoValidacion, run);
    return reply.send({ ok: result.valid, ...result });
  });

  app.get("/health", async () => ({ status: "ok", service: "dotacion-verificador" }));
}
