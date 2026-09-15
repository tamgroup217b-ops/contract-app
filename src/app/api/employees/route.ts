import { NextResponse } from "next/server";
import { readEmployees, readCompanies } from "@/lib/google";
import { buildContractRows } from "@/lib/validation";
import { isConfigured } from "@/lib/config";
import { listExported } from "@/lib/db";

// Route này phải luôn đọc Google Sheet mới nhất, không được Next.js cache tĩnh lúc build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: đọc 2 tab, ghép + validate, trả về danh sách ContractRow.
// Kèm danh sách hợp đồng đã xuất (để hiện nút "Tải PDF").
// Đây là bước "đồng bộ khi mở app".
export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Chưa cấu hình kết nối Google Sheet. Vào Cài đặt để cấu hình." },
      { status: 400 }
    );
  }
  try {
    const [employees, companies] = await Promise.all([
      readEmployees(),
      readCompanies(),
    ]);
    const rows = buildContractRows(employees, companies);
    const exported = listExported().map((c) => ({
      id: c.id,
      soHopDong: c.soHopDong,
    }));
    return NextResponse.json({ rows, companyCount: companies.length, exported });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Lỗi không xác định khi đọc Sheet.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
