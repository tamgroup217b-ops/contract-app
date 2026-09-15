// Sinh + lưu PDF cho một ContractRow. Dùng chung cho export đơn lẻ và export hàng loạt.

import fs from "fs";
import path from "path";
import { fetchDriveImageAsDataUri } from "./google";
import { renderContractHtml } from "./contract-template";
import { htmlToPdf } from "./pdf";
import { upsertContract } from "./db";
import type { ContractRow } from "./types";

export const CONTRACTS_DIR = path.join(process.cwd(), "data", "contracts");

/** Tên file an toàn theo số hợp đồng. */
export function safePdfName(soHopDong: string, fallback: string): string {
  return soHopDong.replace(/[^a-zA-Z0-9_-]/g, "_") || fallback;
}

/**
 * Sinh PDF cho 1 row (đã đảm bảo canExport + có company), lưu file + metadata.
 * Trả về { pdf, safeName }. Ghi đè file cũ theo số hợp đồng.
 */
export async function generateAndStore(
  row: ContractRow
): Promise<{ pdf: Buffer; safeName: string }> {
  if (!row.company) {
    throw new Error(`Nhân viên ${row.employee.hoTen} chưa khớp công ty.`);
  }

  // Tải ảnh chữ ký/dấu (không chặn nếu thiếu — PDF chừa trống)
  const [chuKyDataUri, conDauDataUri] = await Promise.all([
    row.employee.chuKyUrl
      ? fetchDriveImageAsDataUri(row.employee.chuKyUrl)
      : Promise.resolve(null),
    row.company.conDauUrl
      ? fetchDriveImageAsDataUri(row.company.conDauUrl)
      : Promise.resolve(null),
  ]);

  const html = renderContractHtml({
    employee: row.employee,
    company: row.company,
    chuKyDataUri,
    conDauDataUri,
  });
  const pdf = await htmlToPdf(html);

  if (!fs.existsSync(CONTRACTS_DIR)) fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
  const safeName = safePdfName(row.employee.soHopDong, `stt-${row.employee.stt}`);
  const pdfPath = path.join(CONTRACTS_DIR, `${safeName}.pdf`);
  fs.writeFileSync(pdfPath, pdf);

  upsertContract({
    soHopDong: row.employee.soHopDong,
    hoTen: row.employee.hoTen,
    soDienThoai: row.employee.soDienThoai,
    tenCongTy: row.company.tenCongTy,
    pdfPath,
  });

  return { pdf, safeName };
}
