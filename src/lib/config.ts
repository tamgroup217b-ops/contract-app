// Quản lý cấu hình app phía server.
// Nguồn cấu hình theo thứ tự ưu tiên:
//   1. Biến môi trường (production/VPS) — CỐ ĐỊNH, không sửa qua giao diện.
//   2. File /data/config.json (khi nhập qua màn hình Cài đặt local).
// File này KHÔNG BAO GIỜ được gửi ra client (chứa JSON key nhạy cảm).

import fs from "fs";
import path from "path";
import type { AppConfig } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

const DEFAULT_CONFIG: AppConfig = {
  spreadsheetId: "",
  serviceAccountJson: "",
  allowedEmails: [],
  employeeSheetName: "Nhân viên",
  companySheetName: "Công ty",
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Cấu hình cố định từ biến môi trường (nếu có).
 * Dùng cho production/VPS: đặt trong file .env, không sửa qua giao diện.
 */
function envConfig(): Partial<AppConfig> {
  const cfg: Partial<AppConfig> = {};
  if (process.env.SPREADSHEET_ID) cfg.spreadsheetId = process.env.SPREADSHEET_ID;
  if (process.env.SERVICE_ACCOUNT_JSON)
    cfg.serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;
  if (process.env.EMPLOYEE_SHEET_NAME)
    cfg.employeeSheetName = process.env.EMPLOYEE_SHEET_NAME;
  if (process.env.COMPANY_SHEET_NAME)
    cfg.companySheetName = process.env.COMPANY_SHEET_NAME;
  return cfg;
}

/** App đang được cấu hình cố định bằng biến môi trường? */
export function isEnvManaged(): boolean {
  return Boolean(process.env.SPREADSHEET_ID && process.env.SERVICE_ACCOUNT_JSON);
}

/**
 * Đọc cấu hình hiện tại. Ưu tiên biến môi trường, sau đó tới file config.
 * Trả về mặc định nếu chưa cấu hình gì.
 */
export function getConfig(): AppConfig {
  ensureDataDir();
  let fileConfig: Partial<AppConfig> = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Partial<AppConfig>;
    } catch {
      fileConfig = {};
    }
  }
  // env đè lên file đè lên mặc định
  return { ...DEFAULT_CONFIG, ...fileConfig, ...envConfig() };
}

/** Ghi cấu hình (merge với hiện tại). Vô hiệu khi cấu hình bị khóa bằng env. */
export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  if (isEnvManaged()) {
    // Trên VPS cấu hình cố định bằng biến môi trường — không cho ghi đè qua giao diện.
    throw new Error("Cấu hình đang được khóa cố định bằng biến môi trường, không thể sửa qua giao diện.");
  }
  ensureDataDir();
  // Đọc trực tiếp file (không dùng getConfig để tránh trộn env vào bản lưu)
  let current: Partial<AppConfig> = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      current = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      current = {};
    }
  }
  const next = { ...DEFAULT_CONFIG, ...current, ...patch };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

/** App đã cấu hình đủ để kết nối Sheet chưa? */
export function isConfigured(config: AppConfig = getConfig()): boolean {
  return Boolean(config.spreadsheetId && config.serviceAccountJson);
}

/**
 * Phiên bản cấu hình an toàn để gửi ra client:
 * KHÔNG kèm JSON key, chỉ cho biết đã cấu hình hay chưa.
 */
export function getConfigForClient(config: AppConfig = getConfig()) {
  return {
    spreadsheetId: config.spreadsheetId,
    employeeSheetName: config.employeeSheetName,
    companySheetName: config.companySheetName,
    allowedEmails: config.allowedEmails,
    hasServiceAccount: Boolean(config.serviceAccountJson),
    isConfigured: isConfigured(config),
    envManaged: isEnvManaged(),
  };
}
