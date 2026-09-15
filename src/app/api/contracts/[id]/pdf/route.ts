import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getContractById } from "@/lib/db";

// GET: tải file PDF của một hợp đồng đã lưu theo id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID không hợp lệ." }, { status: 400 });
  }
  const contract = getContractById(id);
  if (!contract) {
    return NextResponse.json({ error: "Không tìm thấy hợp đồng." }, { status: 404 });
  }
  if (!fs.existsSync(contract.pdfPath)) {
    return NextResponse.json(
      { error: "File PDF không còn tồn tại trên máy chủ." },
      { status: 404 }
    );
  }
  const pdf = fs.readFileSync(contract.pdfPath);
  const safeName = contract.soHopDong.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}.pdf"`,
    },
  });
}
