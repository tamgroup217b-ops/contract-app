// Hằng số và tiện ích dùng chung giữa trình duyệt và server khi xuất hợp đồng.

/**
 * Số người tối đa mỗi request khi "Xuất tất cả". Trình duyệt chia thành nhiều lô để mỗi request ngắn
 * và mỗi lô chỉ đọc Google Sheet 1 lần (hạn mức Sheets API: 60 lượt đọc/phút).
 */
export const EXPORT_BATCH_SIZE = 5;

/** Tên file PDF tải về theo số hợp đồng (chỉ để đặt tên file, không dùng làm khóa lưu trữ). */
export function pdfFileName(soHopDong: string, fallback: string): string {
  return `${soHopDong.replace(/[^a-zA-Z0-9_-]/g, "_") || fallback}.pdf`;
}
