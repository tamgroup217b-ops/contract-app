import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { readEmployees, readCompanies } from "@/lib/google";
import { buildContractRows } from "@/lib/validation";
import { isConfigured } from "@/lib/config";
import { generateAndStore, safePdfName } from "@/lib/generate";

/**
 * POST { stts: string[] }
 * Xuất hàng loạt: sinh PDF cho các STT đủ điều kiện, gói vào 1 file ZIP.
 * Luôn GHI ĐÈ (không hỏi xác nhận từng cái) — vì đã xác nhận ở nút "Xuất tất cả".
 * Bỏ qua các dòng lỗi dữ liệu, trả về danh sách bỏ qua trong header.
 */
export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Chưa cấu hình kết nối Google Sheet." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const stts: string[] = Array.isArray(body.stts)
    ? body.stts.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];
  if (stts.length === 0) {
    return NextResponse.json({ error: "Không có nhân viên nào để xuất." }, { status: 400 });
  }

  try {
    const [employees, companies] = await Promise.all([
      readEmployees(),
      readCompanies(),
    ]);
    const rows = buildContractRows(employees, companies);
    const wanted = new Set(stts);

    // Chỉ xuất các dòng được chọn VÀ đủ điều kiện
    const target = rows.filter((r) => wanted.has(r.employee.stt) && r.canExport && r.company);
    if (target.length === 0) {
      return NextResponse.json(
        { error: "Không có nhân viên nào đủ điều kiện xuất trong lựa chọn." },
        { status: 400 }
      );
    }

    const zip = new JSZip();
    const usedNames = new Map<string, number>(); // tránh trùng tên file trong zip
    let success = 0;
    const failed: string[] = [];

    for (const row of target) {
      try {
        const { pdf } = await generateAndStore(row);
        let name = safePdfName(row.employee.soHopDong, `stt-${row.employee.stt}`);
        // Nếu trùng tên (số HĐ trống/lặp), thêm hậu tố
        const count = usedNames.get(name) ?? 0;
        usedNames.set(name, count + 1);
        if (count > 0) name = `${name}-${count + 1}`;
        zip.file(`${name}.pdf`, pdf);
        success++;
      } catch {
        failed.push(row.employee.hoTen || row.employee.stt);
      }
    }

    if (success === 0) {
      return NextResponse.json({ error: "Xuất thất bại cho tất cả nhân viên." }, { status: 500 });
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="hop-dong-${today}.zip"`,
        // Báo cho client biết kết quả để hiển thị thông báo
        "X-Export-Success": String(success),
        "X-Export-Failed": String(failed.length),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi khi xuất hàng loạt.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
