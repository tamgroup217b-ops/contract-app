// Sinh PDF từ HTML bằng Puppeteer (Chromium headless).
// Dùng chung một instance browser để tránh khởi động lại mỗi lần xuất.

import fs from "fs";
import path from "path";
import puppeteer, { type Browser } from "puppeteer";
import { getInstalledBrowsers } from "@puppeteer/browsers";

let _browser: Browser | null = null;
let _launching: Promise<Browser> | null = null;

// Các vị trí Chrome thường gặp trên Windows (Windows Server 2022) và Linux.
const COMMON_CHROME_PATHS = [
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

/**
 * Thư mục Chrome do Puppeteer tải về lúc `npm install` (xem .puppeteerrc.cjs).
 * Trên Firebase App Hosting, app chạy từ .next/standalone (cũng là cwd) và thư mục
 * này được chép vào đó nhờ outputFileTracingIncludes trong next.config.mjs.
 */
const PUPPETEER_CACHE_DIR = path.join(process.cwd(), ".cache", "puppeteer");

interface ChromeChoice {
  executablePath?: string;
  headless: true | "shell";
  source: string;
}

function existsSafe(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/** Tìm Chrome mà Puppeteer đã tải vào thư mục dự án. Ưu tiên bản Chrome đầy đủ. */
async function findDownloadedChrome(): Promise<ChromeChoice | null> {
  if (!existsSafe(PUPPETEER_CACHE_DIR)) return null;
  const installed = await getInstalledBrowsers({ cacheDir: PUPPETEER_CACHE_DIR });
  const chrome = installed.find((b) => String(b.browser) === "chrome");
  const shell = installed.find((b) => String(b.browser) === "chrome-headless-shell");
  const pick = chrome ?? shell;
  if (!pick) return null;
  // Khi chép file lúc build, quyền thực thi có thể bị mất — đặt lại cho chắc.
  try {
    fs.chmodSync(pick.executablePath, 0o755);
  } catch {
    // bỏ qua (Windows hoặc không có quyền)
  }
  return {
    executablePath: pick.executablePath,
    headless: pick === chrome ? true : "shell",
    source: `puppeteer-cache:${pick.browser}@${pick.buildId}`,
  };
}

/**
 * Chọn Chrome/Chromium để dùng, theo thứ tự:
 * 1. Biến môi trường CHROME_PATH (nếu người cấu hình chỉ định rõ).
 * 2. Chrome cài sẵn trên máy (Windows/Linux).
 * 3. Chrome Puppeteer đã tải vào .cache/puppeteer (Firebase App Hosting).
 * 4. Để Puppeteer tự tìm theo cấu hình mặc định.
 */
async function resolveChrome(): Promise<ChromeChoice> {
  const envPath = process.env.CHROME_PATH;
  if (envPath && existsSafe(envPath)) {
    return { executablePath: envPath, headless: true, source: "env:CHROME_PATH" };
  }
  // CHROME_PATH trỏ tới file không tồn tại (vd. đường dẫn Linux trên máy Windows) → bỏ qua, dò tiếp.
  const system = COMMON_CHROME_PATHS.find(existsSafe);
  if (system) return { executablePath: system, headless: true, source: "system" };
  const downloaded = await findDownloadedChrome();
  if (downloaded) return downloaded;
  return { headless: true, source: "puppeteer-default" };
}

async function launchBrowser(): Promise<Browser> {
  const chrome = await resolveChrome();
  return puppeteer.launch({
    headless: chrome.headless,
    executablePath: chrome.executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      // Tắt hinting để khoảng cách chữ giống nhau giữa Windows và Linux.
      "--font-render-hinting=none",
    ],
  });
}

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  // Nhiều request cùng lúc chỉ khởi động 1 Chromium (tránh tốn RAM gấp đôi).
  if (!_launching) {
    _launching = launchBrowser()
      .then((b) => {
        _browser = b;
        return b;
      })
      .finally(() => {
        _launching = null;
      });
  }
  return _launching;
}

/** Render HTML thành PDF buffer khổ A4. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    // Chờ font nhúng tải xong để PDF không bị render bằng font dự phòng.
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  } finally {
    await page.close();
  }
}

/** Thông tin chẩn đoán môi trường sinh PDF (dùng cho route thử nghiệm /api/poc-pdf). */
export async function getPdfDiagnostics() {
  let chrome: ChromeChoice | { error: string };
  try {
    chrome = await resolveChrome();
  } catch (e) {
    chrome = { error: e instanceof Error ? e.message : String(e) };
  }
  return {
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    cwd: process.cwd(),
    puppeteerCacheDir: PUPPETEER_CACHE_DIR,
    puppeteerCacheExists: existsSafe(PUPPETEER_CACHE_DIR),
    chrome,
    browserConnected: Boolean(_browser?.connected),
  };
}
