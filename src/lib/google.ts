// Kết nối Google qua Service Account (Kiểu A đã chốt).
// Dùng JSON key lưu trong config để đọc Sheets và tải ảnh từ Drive.
// Toàn bộ module này chỉ chạy phía server.

import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import { getConfig } from "./config";
import type { Employee, Company } from "./types";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

/** Tạo GoogleAuth từ JSON key trong config. Ném lỗi rõ ràng nếu chưa cấu hình. */
function getAuth(): GoogleAuth {
  const { serviceAccountJson } = getConfig();
  if (!serviceAccountJson) {
    throw new Error("Chưa cấu hình Service Account JSON trong phần Cài đặt.");
  }
  let credentials;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("Service Account JSON không hợp lệ (không phải JSON đúng định dạng).");
  }
  return new GoogleAuth({ credentials, scopes: SCOPES });
}

/** Đọc toàn bộ giá trị của một tab. Trả về mảng 2 chiều (hàng × cột). */
async function readSheetValues(tabName: string): Promise<string[][]> {
  const { spreadsheetId } = getConfig();
  if (!spreadsheetId) {
    throw new Error("Chưa cấu hình Spreadsheet ID trong phần Cài đặt.");
  }
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (res.data.values as string[][]) ?? [];
}

/** Lấy giá trị ô theo chỉ số cột, an toàn khi thiếu cột. */
function cell(row: string[], idx: number): string {
  return (row[idx] ?? "").toString().trim();
}

/**
 * Đọc tab Nhân viên. Cấu trúc cột (theo demo hiện tại):
 * 0:STT 1:Số hợp đồng 2:Họ và tên 3:SĐT 4:Ngày sinh 5:CCCD 6:Ngày cấp
 * 7:Nơi cấp 8:Địa chỉ thường trú 9:Địa chỉ hiện tại 10:Cơ sở làm việc
 * 11:Nơi kí HD 12:Công ty 13:Ngày thử việc 14:Chữ ký
 */
export async function readEmployees(): Promise<Employee[]> {
  const { employeeSheetName } = getConfig();
  const rows = await readSheetValues(employeeSheetName);
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
 * Đọc tab Công ty. Cấu trúc cột:
 * 0:Tên công ty 1:Mã số thuế 2:Người đại diện 3:Chức vụ 4:SĐT
 * 5:Địa chỉ trụ sở chính 6:(link chữ ký/dấu)
 */
export async function readCompanies(): Promise<Company[]> {
  const { companySheetName } = getConfig();
  const rows = await readSheetValues(companySheetName);
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
    const auth = getAuth();
    const drive = google.drive({ version: "v3", auth });
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
