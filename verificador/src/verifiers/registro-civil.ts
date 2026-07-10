import { getBrowser } from "../lib/browser.js";
import { solveImageCaptcha } from "../lib/captcha.js";
import { writeFileSync } from "fs";

const RC_URL = "https://www.registrocivil.cl/principal/servicios-en-linea/consulta-vigencia-documento-1";

export type VerificationResult = {
  valid: boolean;
  status: "VIGENTE" | "NO_VIGENTE" | "NO_ENCONTRADO" | "ERROR";
  message: string;
  confirmedRut?: string;
  confirmedDocumentNumber?: string;
  rawResponse?: string;
};

// Parse structured result from RC response text
function parseRCResult(text: string): { rut?: string; documentNumber?: string; estado?: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: { rut?: string; documentNumber?: string; estado?: string } = {};

  for (let i = 0; i < lines.length; i++) {
    if (/^RUN$/i.test(lines[i]) && lines[i + 1]) {
      result.rut = lines[i + 1].trim();
    }
    if (/N° Documento|N° Pasaporte/i.test(lines[i]) && lines[i + 1]) {
      result.documentNumber = lines[i + 1].trim();
    }
    if (/^ESTADO$/i.test(lines[i]) && lines[i + 1]) {
      result.estado = lines[i + 1].trim();
    }
  }

  return result;
}

export async function verifyCarnet(rut: string, documentNumber: string): Promise<VerificationResult> {
  // Retry up to 3 times on CAPTCHA failure
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await verifyCarnetOnce(rut, documentNumber, attempt);
    if (result.status !== "CAPTCHA_FAIL") return result;
    console.log(`Intento ${attempt} falló por CAPTCHA incorrecto, reintentando...`);
  }
  return { valid: false, status: "ERROR", message: "CAPTCHA incorrecto 3 veces seguidas — intenta más tarde" };
}

async function verifyCarnetOnce(rut: string, documentNumber: string, attempt: number): Promise<VerificationResult & { status: any }> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(RC_URL, { waitUntil: "networkidle2", timeout: 40_000 });
    await new Promise((r) => setTimeout(r, 3000));

    const frames = page.frames();
    const iframe = frames.find((f) => f.url().includes("document-validity"));
    if (!iframe) throw new Error("No se encontró el iframe del formulario");

    // 1. Fill RUT and document number — strip dots and spaces
    const rutClean = rut.replace(/\./g, "");
    const docNumberClean = documentNumber.replace(/[\.\s]/g, "");
    await iframe.waitForSelector("#run", { timeout: 10_000 });
    await iframe.click("#run", { clickCount: 3 });
    await iframe.type("#run", rutClean, { delay: 60 });

    // 2. Open PrimeNG dropdown and pick "Cédula"
    await iframe.click(".p-dropdown");
    await iframe.waitForSelector(".p-dropdown-item", { timeout: 8_000 });

    const options = await iframe.evaluate(() =>
      Array.from(document.querySelectorAll(".p-dropdown-item")).map((el, i) => ({
        i, text: (el as HTMLElement).innerText.trim(),
      }))
    );

    const carnetIdx = options.findIndex((o) => /cédula|cedula|identidad/i.test(o.text));
    await iframe.evaluate((idx) => {
      (document.querySelectorAll(".p-dropdown-item")[idx] as HTMLElement)?.click();
    }, carnetIdx >= 0 ? carnetIdx : 0);

    await new Promise((r) => setTimeout(r, 500));

    // 3. Fill document number
    await iframe.click("#documentNumber", { clickCount: 3 });
    await iframe.type("#documentNumber", docNumberClean, { delay: 60 });

    // 4. Solve image CAPTCHA
    const captchaB64 = await iframe.evaluate(() => {
      const img = document.querySelector("img.captcha-img") as HTMLImageElement | null;
      return img ? img.src.replace(/^data:image\/[a-z]+;base64,/, "") : null;
    });
    if (!captchaB64) throw new Error("No se encontró la imagen del CAPTCHA");

    // Save CAPTCHA image to disk for debugging
    try { writeFileSync(`/tmp/captcha_attempt_${attempt}.jpg`, Buffer.from(captchaB64, "base64")); } catch {}
    console.log(`CAPTCHA imagen extraída (${captchaB64.length} chars base64), resolviendo con 2captcha...`);
    const captchaAnswer = await solveImageCaptcha(captchaB64);
    console.log("CAPTCHA resuelto:", captchaAnswer);

    const captchaInput = await iframe.$('input[name="text"]');
    if (captchaInput) {
      await captchaInput.click({ clickCount: 3 });
      await captchaInput.type(captchaAnswer, { delay: 60 });
    }

    // 5. Submit
    await iframe.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /aceptar|consultar|verificar/i.test(b.innerText)
      );
      (btn as HTMLButtonElement | null)?.click();
    });

    await new Promise((r) => setTimeout(r, 6000));

    const rawText = await iframe.evaluate(() => document.body.innerText);
    console.log(`RC response (intento ${attempt}):`, rawText.slice(0, 300));

    // Cloudflare / servidor RC caído
    if (/521|web server is not returning|Error 5\d\d/i.test(rawText)) {
      return { valid: false, status: "ERROR", message: "El sitio del Registro Civil no está disponible en este momento. Intenta más tarde." };
    }

    // CAPTCHA incorrecto — necesita reintento
    if (/código captcha incorrecto|captcha incorrecto/i.test(rawText)) {
      return { valid: false, status: "CAPTCHA_FAIL" as any, message: "CAPTCHA incorrecto" };
    }

    const parsed = parseRCResult(rawText);

    if (/vigente/i.test(rawText) && !/no vigente|no está vigente|expirado|vencido/i.test(rawText)) {
      return {
        valid: true,
        status: "VIGENTE",
        message: "Documento vigente",
        confirmedRut: parsed.rut,
        confirmedDocumentNumber: parsed.documentNumber,
        rawResponse: rawText.slice(0, 500),
      };
    } else if (/no vigente|no está vigente|expirado|vencido/i.test(rawText)) {
      return {
        valid: false,
        status: "NO_VIGENTE",
        message: "Documento no vigente o vencido",
        confirmedRut: parsed.rut,
        confirmedDocumentNumber: parsed.documentNumber,
        rawResponse: rawText.slice(0, 500),
      };
    } else if (/no encontrado|no existe|no se encontr/i.test(rawText)) {
      return { valid: false, status: "NO_ENCONTRADO", message: "Documento no encontrado en el RC", rawResponse: rawText.slice(0, 500) };
    }

    return { valid: false, status: "ERROR", message: "No se pudo interpretar la respuesta del RC", rawResponse: rawText.slice(0, 500) };
  } catch (err) {
    return { valid: false, status: "ERROR", message: err instanceof Error ? err.message : String(err) };
  } finally {
    await page.close();
  }
}
