// Phiên đăng nhập: cookie "__session" (hạ tầng Firebase chỉ chuyển tiếp cookie tên này)
// chứa session cookie do Firebase Auth cấp, được xác minh ở server trong mọi API route.

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";

export const SESSION_COOKIE = "__session";
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 ngày

export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
}

/** Người dùng của request (null nếu chưa đăng nhập, phiên hết hạn hoặc đã bị thu hồi). */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const token = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: token.uid,
      email: token.email ?? null,
      name: typeof token.name === "string" ? token.name : null,
    };
  } catch {
    return null;
  }
}

/** Không cho CDN/trình duyệt lưu cache phản hồi có dữ liệu riêng tư. */
export function noStore<T extends Response>(res: T): T {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/** Trả về người dùng đang đăng nhập, hoặc phản hồi 401 để route trả về ngay. */
export async function requireUser(req: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser(req);
  if (user) return user;
  return noStore(NextResponse.json({ error: "Bạn cần đăng nhập để tiếp tục." }, { status: 401 }));
}
