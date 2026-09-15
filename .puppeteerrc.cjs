// Puppeteer tải Chrome vào thư mục dự án (thay vì ~/.cache của máy build)
// để Firebase App Hosting chép được Chrome vào bản build chạy thật
// (xem outputFileTracingIncludes trong next.config.mjs và src/lib/pdf.ts).
const { join } = require("path");

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
  // Chỉ cần Chrome đầy đủ (headless: true) — bỏ bản headless-shell để bản build nhẹ hơn.
  skipChromeHeadlessShellDownload: true,
};
