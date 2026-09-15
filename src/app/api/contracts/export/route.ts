import { NextRequest, NextResponse } from "next/server";
import { isConfigured } from "@/lib/config";
import { findBySoHopDong } from "@/lib/db";
import { generateAndStore } from "@/lib/generate";
import { loadContractRows } from "@/lib/google";
import { noStore, requireUser } from "@/lib/session";

/**
 * POST { stt, confirmOverwrite? }
 * Sinh PDF cho một nhân viên theo STT, lưu file + thông tin, trả về PDF.
 * Nếu số hợp đồng đã tồn tại và chưa xác nhận ghi đè → trả 409 để trình duyệt hỏi.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  if (!isConfigured()) {
    return noStore(
      NextResponse.json({ error: "Chưa cấu hình kết nối Google Sheet (SPREADSHEET_ID)." }, { status: 500 })
    );
  }

  const body = await req.json().catch(() => ({}));
  const stt = String(body.stt ?? "").trim();
  const confirmOverwrite = Boolean(body.confirmOverwrite);
  if (!stt) {
    return noStore(NextResponse.json({ error: "Thiếu STT." }, { status: 400 }));
  }

  try {
    const rows = await loadContractRows();
    const row = rows.find((r) => r.employee.stt === stt);

    if (!row) {
      return noStore(
        NextResponse.json({ error: `Không tìm thấy nhân viên STT ${stt}.` }, { status: 404 })
      );
    }
    if (!row.canExport || !row.company) {
      return noStore(
        NextResponse.json(
          { error: "Dòng này có lỗi dữ liệu, không thể xuất. Kiểm tra lại thông tin." },
          { status: 400 }
        )
      );
    }

    // Kiểm tra ghi đè: nếu số hợp đồng đã tồn tại và chưa xác nhận
    const existing = await findBySoHopDong(row.employee.soHopDong);
    if (existing && !confirmOverwrite) {
      const updatedAt = new Date(existing.updatedAt).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      });
      return noStore(
        NextResponse.json(
          {
            needConfirm: true,
            message: `Hợp đồng số "${row.employee.soHopDong}" đã tồn tại (cập nhật lần cuối ${updatedAt}). Bản cũ sẽ bị thay thế. Bạn có muốn tiếp tục?`,
          },
          { status: 409 }
        )
      );
    }

    const { pdf, fileName } = await generateAndStore(row);

    return noStore(
      new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi khi xuất PDF.";
    return noStore(NextResponse.json({ error: message }, { status: 500 }));
  }
}
