import { getBrowser } from "../lib/browser.js";

const RC_URL = "https://www.registrocivil.cl/OficinaInternet/verificacion/verificacioncertificado.srcei";

export type AntecedentesVerificationResult = {
  valid: boolean;
  status: "VALIDO" | "INVALIDO" | "NO_ENCONTRADO" | "ERROR";
  message: string;
  confirmedFolio?: string;
  confirmedRut?: string;
  rawResponse?: string;
};

export async function verifyAntecedentes(folio: string, codigoVerificacion: string): Promise<AntecedentesVerificationResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(RC_URL, { waitUntil: "networkidle2", timeout: 40_000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Check if we landed on Cloudflare or error page
    const initialText = await page.evaluate(() => document.body.innerText);
    if (/521|522|cloudflare|web server is not returning/i.test(initialText)) {
      return { valid: false, status: "ERROR", message: "El sitio del Registro Civil no está disponible en este momento." };
    }

    // Look for folio input — may be named "folio", "numero", "nroFolio", etc.
    const folioSelector = await page.evaluate(() => {
      const candidates = ["input[name*='olio']", "input[id*='olio']", "input[name*='numero']", "input[id*='numero']", "input[type='text']"];
      for (const sel of candidates) {
        if (document.querySelector(sel)) return sel;
      }
      return null;
    });

    if (!folioSelector) {
      const rawText = await page.evaluate(() => document.body.innerText);
      return { valid: false, status: "ERROR", message: "No se encontró el formulario de verificación", rawResponse: rawText.slice(0, 500) };
    }

    // Fill folio
    await page.click(folioSelector, { clickCount: 3 });
    await page.type(folioSelector, folio.trim(), { delay: 60 });

    // Fill código verificación — second text input or specifically named
    const codigoSelector = await page.evaluate(() => {
      const candidates = ["input[name*='odigo']", "input[id*='odigo']", "input[name*='erif']", "input[id*='erif']"];
      for (const sel of candidates) {
        if (document.querySelector(sel)) return sel;
      }
      // Fallback: second text input on the page
      const inputs = Array.from(document.querySelectorAll("input[type='text']"));
      return inputs.length > 1 ? null : null; // will handle below
    });

    if (codigoSelector) {
      await page.click(codigoSelector, { clickCount: 3 });
      await page.type(codigoSelector, codigoVerificacion.trim(), { delay: 60 });
    } else {
      // Try second text input
      const filled = await page.evaluate((code) => {
        const inputs = Array.from(document.querySelectorAll("input[type='text']"));
        if (inputs.length >= 2) {
          (inputs[1] as HTMLInputElement).value = code;
          inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      }, codigoVerificacion.trim());

      if (!filled) {
        return { valid: false, status: "ERROR", message: "No se encontró el campo de código de verificación" };
      }
    }

    // Submit
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button, input[type='submit']")).find((el) =>
        /aceptar|consultar|verificar|buscar/i.test((el as HTMLElement).innerText || (el as HTMLInputElement).value)
      );
      (btn as HTMLElement | null)?.click();
    });

    await new Promise((r) => setTimeout(r, 6000));

    const rawText = await page.evaluate(() => document.body.innerText);
    console.log("RC antecedentes response:", rawText.slice(0, 400));

    if (/521|522|cloudflare|web server is not returning/i.test(rawText)) {
      return { valid: false, status: "ERROR", message: "El sitio del Registro Civil no está disponible." };
    }

    // Extract folio and RUT from response if present
    const folioMatch = rawText.match(/folio[:\s]+(\d+)/i);
    const rutMatch = rawText.match(/R\.?U\.?N\.?[:\s]+([\d.]+-[\dkK])/i);

    if (/válido|certificado válido|documento válido|vigente/i.test(rawText)) {
      return {
        valid: true,
        status: "VALIDO",
        message: "Certificado de antecedentes válido",
        confirmedFolio: folioMatch?.[1] ?? folio,
        confirmedRut: rutMatch?.[1],
        rawResponse: rawText.slice(0, 500),
      };
    }

    if (/no válido|inválido|no existe|no encontrado|no se encontró/i.test(rawText)) {
      return {
        valid: false,
        status: "NO_ENCONTRADO",
        message: "Certificado no encontrado o código incorrecto",
        rawResponse: rawText.slice(0, 500),
      };
    }

    return {
      valid: false,
      status: "ERROR",
      message: "No se pudo interpretar la respuesta del RC",
      rawResponse: rawText.slice(0, 500),
    };
  } catch (err) {
    return { valid: false, status: "ERROR", message: err instanceof Error ? err.message : String(err) };
  } finally {
    await page.close();
  }
}
