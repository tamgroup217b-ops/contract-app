// Đọc Google Sheets và tải ảnh chữ ký từ Google Drive. Toàn bộ module này chỉ chạy phía server.
//
// Xác thực:
// - Có SERVICE_ACCOUNT_JSON (máy local): dùng JSON key đó.
// - Không có (Firebase App Hosting): Application Default Credentials — tài khoản dịch vụ của backend
//   (firebase-app-hosting-compute@…), đã được chia sẻ quyền xem Sheet.

import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import { getConfig } from "./config";
import { buildContractRows } from "./validation";
import type { Employee, Company, ContractRow } from "./types";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

let _auth: GoogleAuth | null = null;

/** GoogleAuth dùng chung (giữ token giữa các request). */
function getAuth(): GoogleAuth {
  if (_auth) return _auth;
  const json = process.env.SERVICE_ACCOUNT_JSON;
  let credentials;
  if (json) {
    try {
      credentials = JSON.parse(json);
    } catch {
      throw new Error("SERVICE_ACCOUNT_JSON không phải JSON hợp lệ.");
    }
  }
  _auth = new GoogleAuth({ credentials, scopes: SCOPES });
  return _auth;
}

/** Lấy giá trị ô theo chỉ số cột, an toàn khi thiếu cột. */
function cell(row: string[], idx: number): string {
  return (row[idx] ?? "").toString().trim();
}

/**
 * Tab Nhân viên. Cấu trúc cột (theo demo hiện tại):
 * 0:STT 1:Số hợp đồng 2:Họ và tên 3:SĐT 4:Ngày sinh 5:CCCD 6:Ngày cấp
 * 7:Nơi cấp 8:Địa chỉ thường trú 9:Địa chỉ hiện tại 10:Cơ sở làm việc
 * 11:Nơi kí HD 12:Công ty 13:Ngày thử việc 14:Chữ ký
 */
function parseEmployees(rows: string[][]): Employee[] {
  if (rows.length < 2) return [];
  // Bỏ hàng tiêu đề
  return rows
    .slice(1)
    .filter((r) => r.some((c) => (c ?? "").toString().trim() !== ""))
    .map((r) => ({
      stt: cell(r, 0),
      soHopDong: cell(r, 1),
      hoTen: cell(r, 2),
      soDienThoai: cell(r, 3),
      ngaySinh: cell(r, 4),
      cccd: cell(r, 5),
      ngayCap: cell(r, 6),
      noiCap: cell(r, 7),
      diaChiThuongTru: cell(r, 8),
      diaChiHienTai: cell(r, 9),
      coSoLamViec: cell(r, 10),
      noiKiHD: cell(r, 11),
      congTy: cell(r, 12),
      ngayThuViec: cell(r, 13),
      chuKyUrl: cell(r, 14),
    }));
}

/**
 * Tab Công ty. Cấu trúc cột:
 * 0:Tên công ty 1:Mã số thuế 2:Người đại diện 3:Chức vụ 4:SĐT
 * 5:Địa chỉ trụ sở chính 6:(link chữ ký/dấu)
 */
function parseCompanies(rows: string[][]): Company[] {
  if (rows.length < 2) return [];
  return rows
    .slice(1)
    .filter((r) => cell(r, 0) !== "")
    .map((r) => ({
      tenCongTy: cell(r, 0),
      maSoThue: cell(r, 1),
      nguoiDaiDien: cell(r, 2),
      chucVu: cell(r, 3),
      soDienThoai: cell(r, 4),
      diaChiTruSo: cell(r, 5),
      conDauUrl: cell(r, 6),
    }));
}

/** Đọc cả 2 tab trong 1 request (tiết kiệm hạn mức Sheets API: 60 lượt đọc/phút mỗi tài khoản). */
export async function readSheetData(): Promise<{ employees: Employee[]; companies: Company[] }> {
  const { spreadsheetId, employeeSheetName, companySheetName } = getConfig();
  if (!spreadsheetId) {
    throw new Error("Chưa cấu hình Google Sheet (SPREADSHEET_ID).");
  }
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`'${employeeSheetName}'`, `'${companySheetName}'`],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const [employeeRows, companyRows] = (res.data.valueRanges ?? []).map(
    (range) => (range.values as string[][] | null | undefined) ?? []
  );
  return {
    employees: parseEmployees(employeeRows ?? []),
    companies: parseCompanies(companyRows ?? []),
  };
}

/** Kiểm tra quyền đọc Sheet mà không lấy dữ liệu (chỉ lấy ID) — dùng cho /api/health. */
export async function checkSheetAccess(): Promise<void> {
  const { spreadsheetId } = getConfig();
  if (!spreadsheetId) {
    throw new Error("Chưa cấu hình Google Sheet (SPREADSHEET_ID).");
  }
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  await sheets.spreadsheets.get({ spreadsheetId, fields: "spreadsheetId" });
}

/** Đọc Sheet, ghép nhân viên với công ty và validate — dữ liệu cho danh sách và cho việc xuất. */
export async function loadContractRows(): Promise<ContractRow[]> {
  const { employees, companies } = await readSheetData();
  return buildContractRows(employees, companies);
}

/** Trích fileId từ nhiều dạng link Google Drive khác nhau. */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  // .../file/d/<id>/view   hoặc   ?id=<id>   hoặc   /d/<id>
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Tải ảnh từ Drive theo link, trả về data URI (base64) để nhúng thẳng vào HTML.
 * Trả về null nếu không tải được (để PDF chừa trống thay vì vỡ).
 */
export async function fetchDriveImageAsDataUri(url: string): Promise<string | null> {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;
  try {
    const drive = google.drive({ version: "v3", auth: getAuth() });
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    const meta = await drive.files.get({ fileId, fields: "mimeType" });
    const mime = (meta.data.mimeType as string) || "image/png";
    const base64 = Buffer.from(res.data as ArrayBuffer).toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}
