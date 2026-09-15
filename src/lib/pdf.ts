// Sinh PDF từ HTML bằng Puppeteer (Chromium headless).
// Dùng chung một instance browser để tránh khởi động lại mỗi lần xuất.

import fs from "fs";
import puppeteer, { type Browser } from "puppeteer";

let _browser: Browser | null = null;

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
 * Đường dẫn Chrome/Chromium để dùng.
 * - Ưu tiên biến môi trường CHROME_PATH (nếu người cấu hình chỉ định rõ).
 * - Nếu không, tự dò các vị trí Chrome phổ biến (Windows/Linux).
 * - Cuối cùng để Puppeteer dùng Chromium tự tải về (executablePath mặc định).
 */
function resolveExecutablePath(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of COMMON_CHROME_PATHS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // bỏ qua, thử vị trí tiếp theo
    }
  }
  return undefined; // để Puppeteer tự tìm Chromium đã tải
}

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  return _browser;
}

/** Render HTML thành PDF buffer khổ A4. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
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
