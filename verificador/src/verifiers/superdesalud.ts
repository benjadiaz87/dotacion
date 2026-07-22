import { getBrowser } from "../lib/browser.js";

// Validación de la credencial SNS: se ingresa el código en el formulario de
// emisorcertificados.superdesalud.gob.cl y se consulta el certificado.
const SUPERDESALUD_URL = "https://emisorcertificados.superdesalud.gob.cl/ValidacionCertificados/";

export type SnsVerificationResult = {
  valid: boolean;
  status: "VALIDO" | "INVALIDO" | "NO_ENCONTRADO" | "ERROR";
  message: string;
  confirmedRut?: string;
  confirmedNombre?: string;
  rawResponse?: string;
};

function normRut(r: string): string {
  return r.replace(/[.\-\s]/g, "").toUpperCase();
}

export async function verifySns(codigoValidacion: string, runEsperado?: string): Promise<SnsVerificationResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(SUPERDESALUD_URL, { waitUntil: "networkidle2", timeout: 40_000 });

    // El input del código es name="id" (id="run"); el envío es #botonSubmit
    const input = await page.$('input[name="id"], #run');
    if (!input) {
      const raw = await page.evaluate(() => document.body.innerText);
      return { valid: false, status: "ERROR", message: "No se encontró el formulario de validación.", rawResponse: raw.slice(0, 500) };
    }
    await input.click({ clickCount: 3 });
    await input.type(codigoValidacion.trim(), { delay: 40 });

    await Promise.all([
      page.click("#botonSubmit"),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 40_000 }).catch(() => null),
    ]);
    await new Promise((r) => setTimeout(r, 1500));

    const text: string = await page.evaluate(() => document.body.innerText);

    // Estado no vigente / código inexistente
    if (/no vigente|revocad|anulad|caducad|no se encontr|no existe|inv[aá]lid|c[oó]digo incorrecto|no corresponde/i.test(text)) {
      return { valid: false, status: "NO_ENCONTRADO", message: "El certificado no está vigente o el código no corresponde.", rawResponse: text.slice(0, 900) };
    }

    // El resultado de un certificado válido dice "Estado del certificado: VIGENTE"
    const vigente = /estado del certificado:\s*vigente|certificado:\s*v[aá]lido|\bVIGENTE\b/i.test(text);
    if (!vigente) {
      return { valid: false, status: "ERROR", message: "No se pudo confirmar el estado del certificado en la Superintendencia de Salud.", rawResponse: text.slice(0, 900) };
    }

    const runMatch = text.match(/\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\b/);
    const confirmedRut = runMatch ? runMatch[1] : undefined;

    if (runEsperado && confirmedRut && normRut(confirmedRut) !== normRut(runEsperado)) {
      return {
        valid: false,
        status: "INVALIDO",
        message: `El RUN del certificado (${confirmedRut}) no coincide con el del trabajador (${runEsperado}).`,
        confirmedRut,
        rawResponse: text.slice(0, 900),
      };
    }

    return {
      valid: true,
      status: "VALIDO",
      message: "Certificado verificado en la Superintendencia de Salud.",
      confirmedRut,
      rawResponse: text.slice(0, 900),
    };
  } catch (err) {
    return { valid: false, status: "ERROR", message: "No se pudo conectar con la Superintendencia de Salud.", rawResponse: String(err).slice(0, 300) };
  } finally {
    await page.close();
  }
}
