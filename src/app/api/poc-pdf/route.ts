// TẠM THỜI — chỉ để thử nghiệm xuất PDF trên Firebase App Hosting, dùng dữ liệu GIẢ.
// Xóa route này sau khi thử nghiệm xong.
import { execFile } from "child_process";
import fs from "fs";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { renderContractHtml } from "@/lib/contract-template";
import { htmlToPdf, getPdfDiagnostics } from "@/lib/pdf";
import type { Employee, Company } from "@/lib/types";

export const dynamic = "force-dynamic";

const employee: Employee = {
  stt: "1",
  soHopDong: "HDTV00/2026",
  hoTen: "NGUYỄN VĂN MẪU",
  soDienThoai: "0900000000",
  ngaySinh: "01/01/2000",
  cccd: "000000000000",
  ngayCap: "01/01/2021",
  noiCap: "Cục Cảnh sát QLHC về TTXH",
  diaChiThuongTru: "Số 1 Đường Mẫu, Phường Mẫu, Tỉnh Mẫu",
  diaChiHienTai: "Số 2 Đường Mẫu, Phường Mẫu, TP Hồ Chí Minh",
  coSoLamViec: "TP Hồ Chí Minh",
  noiKiHD: "TP Hồ Chí Minh",
  congTy: "CÔNG TY TNHH MẪU",
  ngayThuViec: "Ngày 01, Tháng 09, Năm 2026",
  chuKyUrl: "",
};

const company: Company = {
  tenCongTy: "CÔNG TY TNHH MẪU",
  maSoThue: "0000000000",
  nguoiDaiDien: "Trần Thị Mẫu",
  chucVu: "Giám đốc",
  soDienThoai: "0900000001",
  diaChiTruSo: "Số 3 Đường Mẫu, Phường Mẫu, TP Hồ Chí Minh, Việt Nam",
  conDauUrl: "",
};

function osName(): string | null {
  try {
    return fs.readFileSync("/etc/os-release", "utf8").match(/^PRETTY_NAME="?([^"\n]*)/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Thư viện mà trình duyệt còn thiếu trên máy chủ (theo `ldd`) — để chẩn đoán khi không khởi động được. */
async function lddReport(chrome: unknown) {
  if (process.platform !== "linux" || !chrome || typeof chrome !== "object") return null;
  const { executablePath, extraEnv } = chrome as {
    executablePath?: string;
    extraEnv?: Record<string, string>;
  };
  if (!executablePath) return null;
  try {
    const { stdout } = await promisify(execFile)("ldd", [executablePath], {
      env: { ...process.env, ...extraEnv },
    });
    return {
      missing: stdout
        .split("\n")
        .filter((line) => line.includes("not found"))
        .map((line) => line.trim()),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function fullDiagnostics() {
  const diag = await getPdfDiagnostics();
  return { ...diag, os: osName(), ldd: await lddReport(diag.chrome) };
}

// GET /api/poc-pdf         → PDF hợp đồng mẫu
// GET /api/poc-pdf?diag=1  → JSON chẩn đoán (trình duyệt nào được dùng, thời gian render)
export async function GET(req: NextRequest) {
  const wantDiag = req.nextUrl.searchParams.has("diag");
  const started = Date.now();
  try {
    const html = renderContractHtml({
      employee,
      company,
      chuKyDataUri: null,
      conDauDataUri: null,
    });
    const pdf = await htmlToPdf(html);
    const renderMs = Date.now() - started;
    if (wantDiag) {
      return NextResponse.json({
        ok: true,
        renderMs,
        pdfBytes: pdf.length,
        ...(await fullDiagnostics()),
      });
    }
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="poc-hop-dong-mau.pdf"',
        "X-Render-Ms": String(renderMs),
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        diagnostics: await fullDiagnostics(),
      },
      { status: 500 }
    );
  }
}
