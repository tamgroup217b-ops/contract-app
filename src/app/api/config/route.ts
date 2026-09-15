import { NextRequest, NextResponse } from "next/server";
import { getConfigForClient, saveConfig } from "@/lib/config";

// GET: trả về cấu hình an toàn cho client (KHÔNG kèm JSON key)
export async function GET() {
  return NextResponse.json(getConfigForClient());
}

// POST: lưu cấu hình từ màn hình Cài đặt
export async function POST(req: NextRequest) {
  // Bản online cấu hình cố định bằng biến môi trường / Secret Manager —
  // không cho ai sửa qua giao diện.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Không thể sửa cấu hình trên bản online." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (typeof body.spreadsheetId === "string")
    patch.spreadsheetId = body.spreadsheetId.trim();
  if (typeof body.employeeSheetName === "string" && body.employeeSheetName.trim())
    patch.employeeSheetName = body.employeeSheetName.trim();
  if (typeof body.companySheetName === "string" && body.companySheetName.trim())
    patch.companySheetName = body.companySheetName.trim();

  // JSON key: chỉ ghi đè khi client gửi giá trị mới không rỗng
  // (để không xóa mất key cũ khi lưu các trường khác)
  if (typeof body.serviceAccountJson === "string" && body.serviceAccountJson.trim()) {
    // Validate là JSON hợp lệ trước khi lưu
    try {
      const parsed = JSON.parse(body.serviceAccountJson);
      if (parsed.type !== "service_account" || !parsed.client_email) {
        return NextResponse.json(
          { error: "JSON không phải Service Account key hợp lệ (thiếu type/client_email)." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Service Account JSON không đúng định dạng." },
        { status: 400 }
      );
    }
    patch.serviceAccountJson = body.serviceAccountJson.trim();
  }

  if (Array.isArray(body.allowedEmails)) {
    patch.allowedEmails = body.allowedEmails
      .map((e: unknown) => String(e).trim().toLowerCase())
      .filter(Boolean);
  }

  try {
    saveConfig(patch);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được cấu hình.";
    return NextResponse.json({ error: message }, { status: 403 });
  }
  return NextResponse.json(getConfigForClient());
}
