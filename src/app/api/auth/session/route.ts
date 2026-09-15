import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE, SESSION_DURATION_MS, noStore } from "@/lib/session";

// Chỉ nhận ID token của lần đăng nhập vừa xảy ra — hạn chế dùng lại token cũ bị lộ.
const MAX_AUTH_AGE_SECONDS = 5 * 60;

/**
 * POST { idToken } → xác minh ID token Firebase và đặt cookie phiên.
 * Ai có tài khoản Google đều đăng nhập được (theo yêu cầu của chủ app).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) {
    return noStore(NextResponse.json({ error: "Thiếu thông tin đăng nhập." }, { status: 400 }));
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.firebase.sign_in_provider !== "google.com") {
      return noStore(
        NextResponse.json({ error: "Chỉ hỗ trợ đăng nhập bằng tài khoản Google." }, { status: 403 })
      );
    }
    if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
      return noStore(
        NextResponse.json({ error: "Phiên đăng nhập đã cũ, vui lòng đăng nhập lại." }, { status: 401 })
      );
    }

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    const res = NextResponse.json({ email: decoded.email ?? null });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return noStore(res);
  } catch {
    return noStore(
      NextResponse.json({ error: "Đăng nhập không hợp lệ, vui lòng thử lại." }, { status: 401 })
    );
  }
}
