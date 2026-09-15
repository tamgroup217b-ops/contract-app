/** @type {import('next').NextConfig} */
const nextConfig = {
  // puppeteer và better-sqlite3 là native/server-only — không bundle vào client
  experimental: {
    serverComponentsExternalPackages: ["puppeteer", "better-sqlite3"],
  },
};

export default nextConfig;
