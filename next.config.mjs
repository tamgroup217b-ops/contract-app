/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // puppeteer, @sparticuz/chromium và better-sqlite3 là native/server-only — không bundle
    serverComponentsExternalPackages: ["puppeteer", "@sparticuz/chromium", "better-sqlite3"],
    // Chromium nén (bin/*.br) được đọc lúc chạy qua đường dẫn động → chép tường minh
    // vào bản build standalone mà Firebase App Hosting dùng để chạy app.
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    },
  },
};

export default nextConfig;
