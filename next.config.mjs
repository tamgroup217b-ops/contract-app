/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // puppeteer và better-sqlite3 là native/server-only — không bundle vào client
    serverComponentsExternalPackages: ["puppeteer", "@puppeteer/browsers", "better-sqlite3"],
    // Chép Chrome do Puppeteer tải về (.cache/puppeteer, xem .puppeteerrc.cjs)
    // vào bản build standalone mà Firebase App Hosting dùng để chạy app.
    outputFileTracingIncludes: {
      "/api/**/*": ["./.cache/puppeteer/**/*"],
    },
  },
};

export default nextConfig;
