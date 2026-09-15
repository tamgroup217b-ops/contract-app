// Chuẩn hóa và validate dữ liệu nhân viên/công ty.
// Xử lý các vấn đề dữ liệu đã thống nhất:
//  - Khớp tên công ty tự chuẩn hóa (bỏ dấu cách thừa, không phân biệt hoa/thường)
//  - CCCD phải 12 số
//  - Dòng lệch cột → không khớp được công ty → chặn xuất
//  - Thiếu trường bắt buộc → cảnh báo / chặn xuất

import type {
  Employee,
  Company,
  ContractRow,
  ValidationIssue,
} from "./types";

/** Chuẩn hóa chuỗi để so khớp: bỏ khoảng trắng đầu/cuối, gộp khoảng trắng, viết hoa. */
export function normalizeForMatch(s: string): string {
  return (s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Bỏ mọi ký tự không phải số. */
function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/**
 * Ghép danh sách nhân viên với công ty tương ứng và validate từng dòng.
 * Trả về danh sách ContractRow đã sẵn sàng hiển thị/xuất.
 */
export function buildContractRows(
  employees: Employee[],
  companies: Company[]
): ContractRow[] {
  // Lập chỉ mục công ty theo tên đã chuẩn hóa
  const companyIndex = new Map<string, Company>();
  for (const c of companies) {
    const key = normalizeForMatch(c.tenCongTy);
    if (key) companyIndex.set(key, c);
  }

  return employees.map((emp) => {
    const issues: ValidationIssue[] = [];

    // --- Khớp công ty ---
    const companyKey = normalizeForMatch(emp.congTy);
    let company: Company | null = null;
    if (!companyKey) {
      issues.push({
        level: "error",
        field: "congTy",
        message:
          "Thiếu tên công ty (có thể do dòng bị lệch cột) — không xác định được Bên A.",
      });
    } else {
      company = companyIndex.get(companyKey) ?? null;
      if (!company) {
        issues.push({
          level: "error",
          field: "congTy",
          message: `Không tìm thấy công ty "${emp.congTy}" trong tab Công ty.`,
        });
      }
    }

    // --- Các trường bắt buộc của nhân viên (Bên B) ---
    requireField(issues, "hoTen", emp.hoTen, "Họ và tên");
    requireField(issues, "soDienThoai", emp.soDienThoai, "Số điện thoại");
    requireField(issues, "soHopDong", emp.soHopDong, "Số hợp đồng");
    requireField(issues, "ngayThuViec", emp.ngayThuViec, "Ngày thử việc");
    requireField(issues, "coSoLamViec", emp.coSoLamViec, "Cơ sở làm việc");
    requireField(issues, "diaChiThuongTru", emp.diaChiThuongTru, "Địa chỉ thường trú");

    // --- CCCD: phải đúng 12 số ---
    const cccdDigits = digitsOnly(emp.cccd);
    if (!cccdDigits) {
      issues.push({ level: "error", field: "cccd", message: "Thiếu số CCCD." });
    } else if (cccdDigits.length !== 12) {
      issues.push({
        level: "warning",
        field: "cccd",
        message: `CCCD có ${cccdDigits.length} số (hợp lệ phải 12 số).`,
      });
    }

    // --- SĐT: cảnh báo nếu không phải 10 số bắt đầu bằng 0 ---
    const phoneDigits = digitsOnly(emp.soDienThoai);
    if (phoneDigits && !(phoneDigits.length === 10 && phoneDigits.startsWith("0"))) {
      issues.push({
        level: "warning",
        field: "soDienThoai",
        message: `Số điện thoại "${emp.soDienThoai}" trông không đúng định dạng (10 số, bắt đầu bằng 0).`,
      });
    }

    // --- Chữ ký: cảnh báo nếu thiếu (không chặn xuất, có thể ký tay) ---
    if (!emp.chuKyUrl) {
      issues.push({
        level: "warning",
        field: "chuKyUrl",
        message: "Thiếu ảnh chữ ký người lao động — PDF sẽ chừa trống chỗ ký.",
      });
    }

    const canExport = !issues.some((i) => i.level === "error");
    return { employee: emp, company, issues, canExport };
  });
}

function requireField(
  issues: ValidationIssue[],
  field: string,
  value: string,
  label: string
): void {
  if (!value || !value.trim()) {
    issues.push({ level: "error", field, message: `Thiếu ${label}.` });
  }
}
