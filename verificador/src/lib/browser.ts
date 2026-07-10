import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "puppeteer";

puppeteerExtra.use(StealthPlugin());

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  browser = await (puppeteerExtra as any).launch({
    headless: true,
    // En Docker (Railway) se usa el Chromium del sistema
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  }) as Browser;
  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
