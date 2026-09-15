/** @type {import('next').NextConfig} */
const nextConfig = {
  // Thư viện native/chỉ chạy phía server — không bundle
  serverExternalPackages: ["puppeteer", "@sparticuz/chromium", "firebase-admin"],
  // Chromium nén (bin/*.br) được đọc lúc chạy qua đường dẫn động → chép tường minh
  // vào bản build standalone mà Firebase App Hosting dùng để chạy app.
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
