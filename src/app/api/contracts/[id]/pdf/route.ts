import { NextRequest, NextResponse } from "next/server";
import { getContractById } from "@/lib/db";
import { pdfFileName } from "@/lib/export-options";
import { noStore, requireUser } from "@/lib/session";
import { readPdf } from "@/lib/storage";

// GET: xem/tải file PDF của một hợp đồng đã lưu theo id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  try {
    const contract = await getContractById(id);
    if (!contract) {
      return noStore(NextResponse.json({ error: "Không tìm thấy hợp đồng." }, { status: 404 }));
    }
    const pdf = await readPdf(contract.storagePath);
    return noStore(
      new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${pdfFileName(contract.soHopDong, id)}"`,
        },
      })
    );
  } catch (e) {
    const notFound = (e as { code?: number }).code === 404;
    return noStore(
      NextResponse.json(
        { error: notFound ? "File PDF không còn trên kho lưu trữ." : "Không đọc được file PDF." },
        { status: notFound ? 404 : 500 }
      )
    );
  }
}
