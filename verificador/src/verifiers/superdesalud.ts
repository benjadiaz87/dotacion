import { getBrowser } from "../lib/browser.js";

// La validación de la credencial SNS es directa: la página de validación
// recibe el código por query string y renderiza el certificado si es válido.
const SUPERDESALUD_URL = "https://emisorcertificados.superdesalud.gob.cl/ValidacionCertificados/";

export type SnsVerificationResult = {
  valid: boolean;
  status: "VALIDO" | "INVALIDO" | "NO_ENCONTRADO" | "ERROR";
  message: string;
  confirmedRut?: string;
  confirmedNombre?: string;
  rawResponse?: string;
};

// Normaliza RUT para comparar (sin puntos, guiones, mayúsculas)
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

    const url = `${SUPERDESALUD_URL}?id=${encodeURIComponent(codigoValidacion.trim())}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 40_000 });
    await new Promise((r) => setTimeout(r, 1500));

    const text: string = await page.evaluate(() => document.body.innerText);

    if (/no se encontr|no existe|inválid|invalid|código incorrecto|sin resultados/i.test(text)) {
      return { valid: false, status: "NO_ENCONTRADO", message: "El código de validación no corresponde a un certificado vigente.", rawResponse: text.slice(0, 600) };
    }

    // Un certificado válido menciona el registro de prestadores y expone el RUN
    const esCertificado = /prestadores|registro nacional|superintendencia de salud/i.test(text);
    if (!esCertificado) {
      return { valid: false, status: "ERROR", message: "No se pudo confirmar el certificado en la Superintendencia de Salud.", rawResponse: text.slice(0, 600) };
    }

    // Intentar capturar RUN y nombre confirmados desde la página
    const runMatch = text.match(/\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\b/);
    const confirmedRut = runMatch ? runMatch[1] : undefined;

    // Si tenemos un RUN esperado, debe coincidir con el del certificado oficial
    if (runEsperado && confirmedRut && normRut(confirmedRut) !== normRut(runEsperado)) {
      return {
        valid: false,
        status: "INVALIDO",
        message: `El RUN del certificado (${confirmedRut}) no coincide con el del trabajador (${runEsperado}).`,
        confirmedRut,
        rawResponse: text.slice(0, 600),
      };
    }

    return {
      valid: true,
      status: "VALIDO",
      message: "Certificado verificado en la Superintendencia de Salud.",
      confirmedRut,
      rawResponse: text.slice(0, 600),
    };
  } catch (err) {
    return { valid: false, status: "ERROR", message: "No se pudo conectar con la Superintendencia de Salud.", rawResponse: String(err).slice(0, 300) };
  } finally {
    await page.close();
  }
}
