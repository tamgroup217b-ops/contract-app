import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hợp đồng - Hồ sơ",
  description: "Xuất và tra cứu hợp đồng, hồ sơ từ Google Sheet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <header className="app-header">
          <span className="brand">📄 Hợp đồng - Hồ sơ</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
