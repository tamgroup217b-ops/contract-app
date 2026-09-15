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

/** Cấu hình app, nhập qua màn hình Cài đặt, lưu phía server */
export interface AppConfig {
  spreadsheetId: string; // ID Google Sheet
  serviceAccountJson: string; // nội dung file JSON key (chuỗi thô)
  allowedEmails: string[]; // whitelist email được phép đăng nhập
  employeeSheetName: string; // tên tab nhân viên (mặc định "Nhân viên")
  companySheetName: string; // tên tab công ty (mặc định "Công ty")
}

/** Metadata một hợp đồng đã xuất, lưu trong DB */
export interface StoredContract {
  id: number;
  soHopDong: string;
  hoTen: string;
  soDienThoai: string;
  tenCongTy: string;
  pdfPath: string; // đường dẫn file PDF trên server
  createdAt: string;
  updatedAt: string;
}
