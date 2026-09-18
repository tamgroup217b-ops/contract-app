import { NextRequest, NextResponse } from "next/server";
import { isConfigured } from "@/lib/config";
import { listExportedSoHopDong } from "@/lib/db";
import { loadContractRows } from "@/lib/google";
import { noStore, requireUser } from "@/lib/session";

// Route này phải luôn đọc Google Sheet mới nhất, không được Next.js cache.
export const dynamic = "force-dynamic";

// GET: đọc 2 tab, ghép + validate, trả về danh sách ContractRow kèm số hợp đồng đã xuất
// (để biết dòng nào xuất lại sẽ ghi đè). Đây là bước "đồng bộ khi mở app".
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  if (!isConfigured()) {
    return noStore(
      NextResponse.json({ error: "Chưa cấu hình kết nối Google Sheet (SPREADSHEET_ID)." }, { status: 500 })
    );
  }
  try {
    const [rows, exported] = await Promise.all([loadContractRows(), listExportedSoHopDong()]);
    return noStore(NextResponse.json({ rows, exported }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi đọc Sheet.";
    return noStore(NextResponse.json({ error: message }, { status: 500 }));
  }
}
