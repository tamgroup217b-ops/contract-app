import { NextRequest, NextResponse } from "next/server";
import { isConfigured } from "@/lib/config";
import { EXPORT_BATCH_SIZE } from "@/lib/export-options";
import { generateAndStore } from "@/lib/generate";
import { loadContractRows } from "@/lib/google";
import { noStore, requireUser } from "@/lib/session";

interface BatchResult {
  stt: string;
  fileName?: string;
  pdfBase64?: string;
  name?: string;
  error?: string;
}

/**
 * POST { stts: string[] } — tối đa EXPORT_BATCH_SIZE người mỗi lần.
 * Sinh PDF cho từng người, luôn GHI ĐÈ (đã xác nhận ở nút "Xuất tất cả").
 * Trả { results } để trình duyệt gộp các lô thành 1 file ZIP.
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
  const stts: string[] = Array.isArray(body.stts)
    ? Array.from(new Set(body.stts.map((s: unknown) => String(s).trim()).filter(Boolean)))
    : [];
  if (stts.length === 0) {
    return noStore(NextResponse.json({ error: "Không có nhân viên nào để xuất." }, { status: 400 }));
  }
  if (stts.length > EXPORT_BATCH_SIZE) {
    return noStore(
      NextResponse.json({ error: `Mỗi lần chỉ xuất tối đa ${EXPORT_BATCH_SIZE} người.` }, { status: 400 })
    );
  }

  try {
    // Đọc Sheet 1 lần cho cả lô.
    const rows = await loadContractRows();
    const results: BatchResult[] = [];

    for (const stt of stts) {
      const row = rows.find((r) => r.employee.stt === stt);
      if (!row) {
        results.push({ stt, name: stt, error: "Không còn trong Google Sheet." });
        continue;
      }
      if (!row.canExport || !row.company) {
        results.push({ stt, name: row.employee.hoTen || stt, error: "Dữ liệu chưa đủ điều kiện xuất." });
        continue;
      }
      try {
        const { pdf, fileName } = await generateAndStore(row);
        results.push({ stt, fileName, pdfBase64: pdf.toString("base64") });
      } catch (e) {
        results.push({
          stt,
          name: row.employee.hoTen || stt,
          error: e instanceof Error ? e.message : "Xuất PDF thất bại.",
        });
      }
    }

    return noStore(NextResponse.json({ results }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi khi xuất hàng loạt.";
    return noStore(NextResponse.json({ error: message }, { status: 500 }));
  }
}
