// Kiểu dữ liệu dùng chung toàn app

/** Một nhân viên đọc từ tab "Nhân viên" của Google Sheet */
export interface Employee {
  stt: string;
  soHopDong: string; // Số hợp đồng — HR tự điền tay
  hoTen: string;
  soDienThoai: string;
  ngaySinh: string;
  cccd: string;
  ngayCap: string;
  noiCap: string;
  diaChiThuongTru: string;
  diaChiHienTai: string;
  coSoLamViec: string;
  noiKiHD: string;
  congTy: string; // tên công ty — dùng để khớp sang tab Công ty
  ngayThuViec: string;
  chuKyUrl: string; // link Drive tới ảnh chữ ký PNG
}

/** Một công ty đọc từ tab "Công ty" của Google Sheet */
export interface Company {
  tenCongTy: string;
  maSoThue: string;
  nguoiDaiDien: string;
  chucVu: string;
  soDienThoai: string;
  diaChiTruSo: string;
  conDauUrl: string; // link Drive tới ảnh chữ ký/dấu người đại diện
}

/** Mức độ nghiêm trọng của một lỗi validate */
export type IssueLevel = "error" | "warning";

/** Một lỗi/cảnh báo phát hiện khi validate một dòng */
export interface ValidationIssue {
  level: IssueLevel;
  field: string;
  message: string;
}

/** Một dòng nhân viên đã ghép công ty + kết quả validate, sẵn sàng để hiển thị/xuất */
export interface ContractRow {
  employee: Employee;
  company: Company | null; // null nếu không khớp được công ty
  issues: ValidationIssue[];
  canExport: boolean; // true nếu không có issue level "error"
}

/** Cấu hình app, đọc từ biến môi trường phía server */
export interface AppConfig {
  spreadsheetId: string; // ID Google Sheet
  employeeSheetName: string; // tên tab nhân viên (mặc định "Nhân viên")
  companySheetName: string; // tên tab công ty (mặc định "Công ty")
}

/**
 * Thông tin một hợp đồng đã xuất, lưu trong Firestore.
 * App không lưu file PDF — mỗi lần cần là xuất lại từ Google Sheet.
 */
export interface StoredContract {
  id: string; // băm từ số hợp đồng (xem contractIdFor trong db.ts)
  soHopDong: string;
  hoTen: string;
  soDienThoai: string;
  tenCongTy: string;
  createdAt: string;
  updatedAt: string;
}
