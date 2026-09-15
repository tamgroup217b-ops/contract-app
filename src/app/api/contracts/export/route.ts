import { NextRequest, NextResponse } from "next/server";
import { readEmployees, readCompanies } from "@/lib/google";
import { buildContractRows } from "@/lib/validation";
import { findBySoHopDong } from "@/lib/db";
import { isConfigured } from "@/lib/config";
import { generateAndStore } from "@/lib/generate";

/**
 * POST { stt, confirmOverwrite? }
 * Sinh PDF cho một nhân viên theo STT, lưu file + metadata, trả về PDF.
 * Nếu số hợp đồng đã tồn tại và chưa xác nhận ghi đè → trả 409 để client hỏi.
 */
export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Chưa cấu hình kết nối Google Sheet." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const stt = String(body.stt ?? "").trim();
  const confirmOverwrite = Boolean(body.confirmOverwrite);
  if (!stt) {
    return NextResponse.json({ error: "Thiếu STT." }, { status: 400 });
  }

  try {
    const [employees, companies] = await Promise.all([
      readEmployees(),
      readCompanies(),
    ]);
    const rows = buildContractRows(employees, companies);
    const row = rows.find((r) => r.employee.stt === stt);

    if (!row) {
      return NextResponse.json({ error: `Không tìm thấy nhân viên STT ${stt}.` }, { status: 404 });
    }
    if (!row.canExport || !row.company) {
      return NextResponse.json(
        { error: "Dòng này có lỗi dữ liệu, không thể xuất. Kiểm tra lại thông tin." },
        { status: 400 }
      );
    }

    // Kiểm tra ghi đè: nếu số hợp đồng đã tồn tại và chưa xác nhận
    const existing = findBySoHopDong(row.employee.soHopDong);
    if (existing && !confirmOverwrite) {
      return NextResponse.json(
        {
          needConfirm: true,
          message: `Hợp đồng số "${row.employee.soHopDong}" đã tồn tại (cập nhật lần cuối ${new Date(
            existing.updatedAt
          ).toLocaleString("vi-VN")}). Bản cũ sẽ bị thay thế. Bạn có muốn tiếp tục?`,
        },
        { status: 409 }
      );
    }

    const { pdf, safeName } = await generateAndStore(row);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi khi xuất PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
