// Sinh PDF cho một ContractRow và ghi nhận vào Firestore.
// Dùng chung cho xuất đơn lẻ và xuất theo lô. File PDF không được lưu lại —
// người dùng tải thẳng về máy, cần bản mới thì xuất lại từ Google Sheet.

import { fetchDriveImageAsDataUri } from "./google";
import { renderContractHtml } from "./contract-template";
import { htmlToPdf } from "./pdf";
import { upsertContract } from "./db";
import { pdfFileName } from "./export-options";
import type { ContractRow } from "./types";

export async function generateAndRecord(
  row: ContractRow
): Promise<{ pdf: Buffer; fileName: string }> {
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

  await upsertContract({
    soHopDong: row.employee.soHopDong,
    hoTen: row.employee.hoTen,
    soDienThoai: row.employee.soDienThoai,
    tenCongTy: row.company.tenCongTy,
  });

  return { pdf, fileName: pdfFileName(row.employee.soHopDong, `stt-${row.employee.stt}`) };
}
