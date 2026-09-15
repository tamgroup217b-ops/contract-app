// Không để Puppeteer tải Chrome khi cài đặt:
// - Máy local dùng Chrome cài sẵn.
// - Firebase App Hosting dùng @sparticuz/chromium (Chrome thường thiếu thư viện hệ thống ở đó).
// Xem src/lib/pdf.ts.

/** @type {import("puppeteer").Configuration} */
module.exports = {
  skipDownload: true,
};
