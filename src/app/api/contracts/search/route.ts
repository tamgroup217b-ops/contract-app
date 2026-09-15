import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, searchByPhone } from "@/lib/db";
import { noStore, requireUser } from "@/lib/session";

// GET /api/contracts/search?phone=0900000000 → các hợp đồng đã xuất của số điện thoại này.
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const phone = normalizePhone(req.nextUrl.searchParams.get("phone") ?? "");
  if (phone.length < 9) {
    return noStore(
      NextResponse.json({ error: "Nhập số điện thoại hợp lệ (ít nhất 9 chữ số)." }, { status: 400 })
    );
  }

  try {
    const contracts = await searchByPhone(phone);
    return noStore(
      NextResponse.json({
        contracts: contracts.map((c) => ({
          id: c.id,
          soHopDong: c.soHopDong,
          hoTen: c.hoTen,
          soDienThoai: c.soDienThoai,
          tenCongTy: c.tenCongTy,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi khi tra cứu.";
    return noStore(NextResponse.json({ error: message }, { status: 500 }));
  }
}
