// Test nhanh: sinh 1 PDF từ dữ liệu demo để kiểm tra template + Puppeteer + font tiếng Việt.
// Chạy: node scripts/test-pdf.mjs
// KHÔNG cần Google Sheet — dùng dữ liệu cứng.

import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

// Dữ liệu GIẢ (không dùng dữ liệu thật trong code — repo được đưa lên GitHub)
const e = {
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
  ngayThuViec: "Ngày 01, Tháng 09, Năm 2026",
};
const c = {
  tenCongTy: "CÔNG TY TNHH MẪU",
  maSoThue: "0000000000",
  nguoiDaiDien: "Trần Thị Mẫu",
  chucVu: "Giám đốc",
  soDienThoai: "0900000001",
  diaChiTruSo: "Số 3 Đường Mẫu, Phường Mẫu, TP Hồ Chí Minh, Việt Nam",
};

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fill(v, mw = 120) {
  v = (v || "").trim();
  return v ? `<span class="filled">${esc(v)}</span>` : `<span class="blank" style="min-width:${mw}px"></span>`;
}

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"/>
<style>
@page{size:A4;margin:18mm 20mm}
body{font-family:"DejaVu Serif","Noto Serif",serif;font-size:13pt;line-height:1.45;color:#000}
.center{text-align:center}.bold{font-weight:bold}
h1{font-size:15pt}p{margin:4pt 0;text-align:justify}
.filled{font-weight:bold}.blank{display:inline-block;border-bottom:1px dotted #000;min-width:120px}
.indent{padding-left:12pt}
</style></head><body>
<div class="center bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
<div class="center bold">Độc lập – Tự do – Hạnh phúc</div>
<div class="center">-----o0o-----</div>
<h1 class="center">HỢP ĐỒNG THỬ VIỆC</h1>
<p class="center">Số: ${fill(e.soHopDong, 80)}</p>
<p>Hôm nay, ${fill(e.ngayThuViec, 160)} tại ${fill(e.noiKiHD, 160)}.</p>
<p class="bold">BÊN A: ${fill(c.tenCongTy, 220)}</p>
<p class="indent">Mã số thuế: ${fill(c.maSoThue)}</p>
<p class="indent">Người đại diện: ${fill(c.nguoiDaiDien, 200)} — Chức vụ: ${fill(c.chucVu)}</p>
<p class="bold">BÊN B:</p>
<p class="indent">Ông/Bà: ${fill(e.hoTen, 220)}</p>
<p class="indent">Email: ${fill("", 200)}</p>
<p class="indent">Số CCCD: ${fill(e.cccd, 160)} — Cấp ngày: ${fill(e.ngayCap)}</p>
<p class="indent">Địa chỉ thường trú: ${fill(e.diaChiThuongTru, 300)}</p>
<p>- Địa điểm làm việc tại: ${fill(e.coSoLamViec, 300)}</p>
<p>Mức lương thử việc: 6.000.000 VNĐ/tháng (Sáu triệu Việt Nam đồng chẵn).</p>
</body></html>`;

const outDir = path.join(process.cwd(), "data");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "test-output.pdf");

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.pdf({ path: outPath, format: "A4", printBackground: true, preferCSSPageSize: true });
await browser.close();

const size = fs.statSync(outPath).size;
console.log(`✓ Sinh PDF thành công: ${outPath} (${(size / 1024).toFixed(1)} KB)`);
