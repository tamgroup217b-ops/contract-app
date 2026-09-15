// Sinh PDF từ HTML bằng Puppeteer (Chromium headless).
// Dùng chung một instance browser để tránh khởi động lại mỗi lần xuất.
//
// Chọn trình duyệt:
// - Máy có Chrome cài sẵn (Windows/Linux, hoặc chỉ định CHROME_PATH): dùng Chrome đó.
// - Firebase App Hosting: máy chủ tối giản, thiếu thư viện hệ thống mà Chrome thường cần
//   (vd. libgobject) → dùng @sparticuz/chromium. Bản Chromium này chỉ cần NSS/NSPR/expat;
//   các thư viện đó có sẵn trong gói và được giải nén vào /tmp ở lần xuất PDF đầu tiên.

import fs from "fs";
import path from "path";
import zlib from "zlib";
import puppeteer, { type Browser } from "puppeteer";
import { readTarFiles } from "./tar";

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
 * Thư mục Chromium nén của @sparticuz/chromium. Trên Firebase App Hosting app chạy từ
 * .next/standalone (cũng là cwd); thư mục này được chép vào đó nhờ outputFileTracingIncludes.
 */
const SPARTICUZ_BIN_DIR = path.join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin");
const CHROMIUM_LIB_DIR = "/tmp/chromium-libs";

const DEFAULT_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  // Tắt hinting để khoảng cách chữ giống nhau giữa Windows và Linux.
  "--font-render-hinting=none",
];

interface LaunchPlan {
  source: string;
  executablePath?: string;
  headless: true | "shell";
  args: string[];
  /** Biến môi trường bổ sung cho riêng tiến trình Chromium. */
  extraEnv: Record<string, string>;
}

function existsSafe(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Giải nén thư viện mà Chromium của @sparticuz cần vào /tmp (1 lần cho mỗi máy chủ):
 * NSS, NSPR, expat từ al2023.tar.br; libsqlite3 (libsoftokn3 cần) từ al2.tar.br.
 */
function extractChromiumLibs(): string {
  const doneMarker = path.join(CHROMIUM_LIB_DIR, ".extracted");
  if (existsSafe(doneMarker)) return CHROMIUM_LIB_DIR;

  fs.mkdirSync(CHROMIUM_LIB_DIR, { recursive: true });
  const sources: Array<[archive: string, wanted: (name: string) => boolean]> = [
    ["al2023.tar.br", (name) => name.startsWith("lib/")],
    ["al2.tar.br", (name) => name === "lib/libsqlite3.so.0"],
  ];
  for (const [archive, wanted] of sources) {
    const tar = zlib.brotliDecompressSync(fs.readFileSync(path.join(SPARTICUZ_BIN_DIR, archive)));
    for (const entry of readTarFiles(tar)) {
      if (wanted(entry.name)) {
        fs.writeFileSync(path.join(CHROMIUM_LIB_DIR, path.basename(entry.name)), entry.data);
      }
    }
  }
  fs.writeFileSync(doneMarker, "");
  return CHROMIUM_LIB_DIR;
}

/**
 * Chọn trình duyệt để dùng, theo thứ tự:
 * 1. Biến môi trường CHROME_PATH (nếu file tồn tại).
 * 2. Chrome cài sẵn trên máy (Windows/Linux).
 * 3. @sparticuz/chromium (Linux không có Chrome, vd. Firebase App Hosting).
 * 4. Để Puppeteer tự tìm theo cấu hình mặc định.
 */
async function resolveLaunchPlan(): Promise<LaunchPlan> {
  const envPath = process.env.CHROME_PATH;
  if (envPath && existsSafe(envPath)) {
    return { source: "env:CHROME_PATH", executablePath: envPath, headless: true, args: DEFAULT_ARGS, extraEnv: {} };
  }
  // CHROME_PATH trỏ tới file không tồn tại (vd. đường dẫn Linux trên máy Windows) → bỏ qua, dò tiếp.

  const system = COMMON_CHROME_PATHS.find(existsSafe);
  if (system) {
    return { source: "system", executablePath: system, headless: true, args: DEFAULT_ARGS, extraEnv: {} };
  }

  if (process.platform === "linux" && existsSafe(SPARTICUZ_BIN_DIR)) {
    const { default: chromium } = await import("@sparticuz/chromium");
    const executablePath = await chromium.executablePath(SPARTICUZ_BIN_DIR);
    const libDir = extractChromiumLibs();
    return {
      source: "@sparticuz/chromium",
      executablePath,
      headless: chromium.headless,
      args: chromium.args,
      extraEnv: {
        LD_LIBRARY_PATH: [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
        FONTCONFIG_PATH: process.env.FONTCONFIG_PATH ?? "/tmp/fonts",
      },
    };
  }

  return { source: "puppeteer-default", headless: true, args: DEFAULT_ARGS, extraEnv: {} };
}

async function launchBrowser(): Promise<Browser> {
  const plan = await resolveLaunchPlan();
  return puppeteer.launch({
    headless: plan.headless,
    executablePath: plan.executablePath,
    args: plan.args,
    env: { ...process.env, ...plan.extraEnv },
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

/**
 * Thông tin chẩn đoán môi trường sinh PDF (dùng cho route thử nghiệm /api/poc-pdf).
 * Chỉ trả về biến môi trường bổ sung cho Chromium — không lộ biến môi trường của app.
 */
export async function getPdfDiagnostics() {
  let chrome: Omit<LaunchPlan, "args"> | { error: string };
  try {
    const plan = await resolveLaunchPlan();
    chrome = {
      source: plan.source,
      executablePath: plan.executablePath,
      headless: plan.headless,
      extraEnv: plan.extraEnv,
    };
  } catch (e) {
    chrome = { error: e instanceof Error ? e.message : String(e) };
  }
  return {
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    cwd: process.cwd(),
    sparticuzBinDir: SPARTICUZ_BIN_DIR,
    sparticuzBinExists: existsSafe(SPARTICUZ_BIN_DIR),
    chrome,
    browserConnected: Boolean(_browser?.connected),
  };
}
