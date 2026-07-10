import { Solver } from "2captcha-ts";

let solver: Solver | null = null;

function getSolver(): Solver {
  if (!solver) {
    const key = process.env.TWOCAPTCHA_KEY;
    if (!key) throw new Error("TWOCAPTCHA_KEY no configurada");
    solver = new Solver(key);
  }
  return solver;
}

export async function solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string> {
  const result = await getSolver().recaptcha({ googlekey: siteKey, pageurl: pageUrl });
  return result.data;
}

// Solve image CAPTCHA — base64 string without the data:image/... prefix
export async function solveImageCaptcha(base64: string): Promise<string> {
  const result = await getSolver().imageCaptcha({
    body: base64,
    numeric: 0,
    min_len: 4,
    max_len: 8,
    lang: "es",
    caseSensitive: true,
  });
  return result.data;
}
