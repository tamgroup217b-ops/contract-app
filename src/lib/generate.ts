// Sinh + lưu PDF cho một ContractRow. Dùng chung cho xuất đơn lẻ và xuất theo lô.

import { fetchDriveImageAsDataUri } from "./google";
import { renderContractHtml } from "./contract-template";
import { htmlToPdf } from "./pdf";
import { contractIdFor, upsertContract } from "./db";
import { pdfFileName } from "./export-options";
import { contractPdfPath, savePdf } from "./storage";
import type { ContractRow } from "./types";

/**
 * Sinh PDF cho 1 dòng (đã đảm bảo canExport + có company), lưu file lên Cloud Storage
 * và thông tin lên Firestore. Ghi đè bản cũ cùng số hợp đồng.
 */
export async function generateAndStore(
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

  const storagePath = contractPdfPath(contractIdFor(row.employee.soHopDong));
  await savePdf(storagePath, pdf);
  await upsertContract({
    soHopDong: row.employee.soHopDong,
    hoTen: row.employee.hoTen,
    soDienThoai: row.employee.soDienThoai,
    tenCongTy: row.company.tenCongTy,
    storagePath,
  });

  return { pdf, fileName: pdfFileName(row.employee.soHopDong, `stt-${row.employee.stt}`) };
}
