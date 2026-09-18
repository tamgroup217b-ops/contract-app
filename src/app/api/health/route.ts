import { NextResponse } from "next/server";
import { adminAuth, firestore } from "@/lib/firebase-admin";
import { checkSheetAccess } from "@/lib/google";
import { noStore } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Mã lỗi ngắn (vd. 403) để chẩn đoán — không trả nội dung lỗi có thể lộ thông tin. */
function errorCode(e: unknown): string {
  const code = (e as { code?: unknown; status?: unknown }).code ?? (e as { status?: unknown }).status;
  return code === undefined ? "error" : String(code);
}

async function probe(check: () => Promise<unknown>): Promise<{ ok: boolean; code?: string }> {
  try {
    await check();
    return { ok: true };
  } catch (e) {
    return { ok: false, code: errorCode(e) };
  }
}

/**
 * GET /api/health → app có đọc được Google Sheet, Firestore và quản trị được Firebase Auth
 * (cần để tạo/xác minh cookie phiên) không.
 * Không cần đăng nhập vì chỉ trả trạng thái, không trả dữ liệu.
 */
export async function GET() {
  const [sheets, db, auth] = await Promise.all([
    probe(checkSheetAccess),
    probe(() => firestore().collection("contracts").limit(1).get()),
    probe(() => adminAuth().listUsers(1)),
  ]);
  const ok = sheets.ok && db.ok && auth.ok;
  return noStore(NextResponse.json({ ok, sheets, firestore: db, auth }, { status: ok ? 200 : 503 }));
}
