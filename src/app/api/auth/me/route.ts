import { NextRequest, NextResponse } from "next/server";
import { noStore, requireUser } from "@/lib/session";

// GET → người dùng đang đăng nhập (401 nếu chưa đăng nhập).
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  return noStore(NextResponse.json({ user }));
}
