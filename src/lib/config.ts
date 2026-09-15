// Cấu hình app phía server, đọc từ biến môi trường:
// - Firebase App Hosting: khai báo trong apphosting.yaml.
// - Máy local: đặt trong .env.local (xem .env.example).

import type { AppConfig } from "./types";

export function getConfig(): AppConfig {
  return {
    spreadsheetId: process.env.SPREADSHEET_ID ?? "",
    employeeSheetName: process.env.EMPLOYEE_SHEET_NAME || "Nhân viên",
    companySheetName: process.env.COMPANY_SHEET_NAME || "Công ty",
  };
}

/** App đã cấu hình đủ để đọc Sheet chưa? */
export function isConfigured(config: AppConfig = getConfig()): boolean {
  return Boolean(config.spreadsheetId);
}
