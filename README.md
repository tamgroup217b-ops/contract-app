# Web App Quản lý Hợp đồng Thử việc

App nội bộ giúp HR sinh, lưu trữ và tra cứu hợp đồng thử việc từ dữ liệu Google Sheet.

## Chức năng

1. **Đồng bộ dữ liệu** từ Google Sheet (2 tab: Nhân viên + Công ty), tự validate và cảnh báo lỗi
2. **Xuất hợp đồng PDF** — điền tự động thông tin cá nhân + công ty vào khung hợp đồng cứng, chèn ảnh chữ ký/dấu
3. **Lưu trữ** hợp đồng đã xuất
4. **Tra cứu** hợp đồng theo số điện thoại
5. **Đăng nhập** giới hạn theo whitelist email (Google OAuth)

## Công nghệ

- **Next.js 14** (App Router) — frontend + API
- **googleapis** — đọc Google Sheets + tải ảnh Drive qua Service Account
- **Puppeteer** — render HTML → PDF
- **better-sqlite3** — lưu metadata hợp đồng (local); thay bằng Postgres khi deploy
- **NextAuth** — đăng nhập Google + whitelist

## Chạy local

```bash
npm install
npm run dev
# Mở http://localhost:3000
```

Mặc định `.env.local` đã đặt `AUTH_ENABLED=false` để dễ test — app không yêu cầu đăng nhập khi phát triển.

## Cấu hình (màn hình Cài đặt)

Vào `/cai-dat` và nhập:

- **Spreadsheet ID** — ID Google Sheet
- **Service Account JSON key** — nội dung file .json từ Google Cloud Console (lưu 1 lần, dùng mãi)
- **Tên tab** Nhân viên / Công ty
- **Danh sách email** được phép đăng nhập

Sau đó chia sẻ Google Sheet + thư mục ảnh chữ ký cho email của Service Account (quyền Xem).

## Cấu trúc thư mục

```
src/
  app/
    page.tsx              # Trang chủ — danh sách + xuất PDF
    tra-cuu/page.tsx      # Tra cứu theo SĐT
    cai-dat/page.tsx      # Cài đặt kết nối
    dang-nhap/page.tsx    # Đăng nhập (GĐ 4)
    api/
      config/             # đọc/ghi cấu hình
      employees/          # đọc + validate danh sách
      contracts/
        export/           # sinh + lưu PDF
        search/           # tra cứu theo SĐT
        [id]/pdf/         # tải PDF đã lưu
      auth/[...nextauth]/ # NextAuth
  lib/
    types.ts              # kiểu dữ liệu
    config.ts             # quản lý cấu hình (file /data/config.json)
    google.ts             # đọc Sheets + tải ảnh Drive
    validation.ts         # ghép + validate dữ liệu
    contract-template.ts  # HTML template hợp đồng
    pdf.ts                # Puppeteer HTML → PDF
    db.ts                 # SQLite lưu hợp đồng
    auth.ts               # cấu hình NextAuth
  middleware.ts           # chặn truy cập khi chưa đăng nhập
data/                     # (không commit) config.json, contracts.db, PDF đã xuất
```

## Dữ liệu nhạy cảm

Thư mục `data/` chứa JSON key, database và PDF (có CCCD nhân viên) — đã đưa vào `.gitignore`, không bao giờ commit.
