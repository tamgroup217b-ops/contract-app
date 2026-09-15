// Lưu/đọc file PDF hợp đồng trên Cloud Storage for Firebase.

import { bucket } from "./firebase-admin";

/** Đường dẫn file theo ID hợp đồng (ID đã băm nên không có ký tự đặc biệt, không trùng). */
export function contractPdfPath(contractId: string): string {
  return `contracts/${contractId}.pdf`;
}

export async function savePdf(path: string, pdf: Buffer): Promise<void> {
  await bucket().file(path).save(pdf, { resumable: false, contentType: "application/pdf" });
}

export async function readPdf(path: string): Promise<Buffer> {
  const [data] = await bucket().file(path).download();
  return data;
}
