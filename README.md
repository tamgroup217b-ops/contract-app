# Web App Quản lý Hợp đồng Thử việc

App nội bộ giúp HR sinh và tra cứu hợp đồng thử việc từ dữ liệu Google Sheet.

## Chức năng

1. **Đồng bộ dữ liệu** từ Google Sheet (2 tab: Nhân viên + Công ty), tự validate và cảnh báo lỗi
2. **Xuất hợp đồng PDF** — điền tự động thông tin cá nhân + công ty vào khung hợp đồng cứng, chèn ảnh chữ ký/dấu.
   Xuất từng người, hoặc "Xuất tất cả" (chạy theo lô 5 người, gộp thành 1 file ZIP). File tải thẳng về máy người dùng.
3. **Ghi nhận hợp đồng đã xuất** trong Firestore (số hợp đồng, họ tên, SĐT, công ty, thời điểm xuất).
   App **không lưu file PDF** — cần bản nào thì xuất lại từ Sheet.
4. **Tra cứu** theo số điện thoại: xem người đó đã xuất những hợp đồng nào, lần đầu và lần gần nhất khi nào
5. **Đăng nhập** bằng tài khoản Google

## Công nghệ

- **Next.js 15** (App Router) chạy trên **Firebase App Hosting** (region `asia-southeast1`)
- **Firebase Authentication** (Google) — server đổi ID token thành cookie phiên `__session`; mọi API đều kiểm tra
- **Cloud Firestore** — thông tin hợp đồng đã xuất (ID tài liệu = băm SHA-256 của số hợp đồng)
- **googleapis** — đọc Google Sheet + tải ảnh chữ ký trên Drive
- **Puppeteer** + **@sparticuz/chromium** — render HTML → PDF; font Tinos nhúng sẵn nên PDF giống nhau trên mọi máy

## Deploy

App Hosting tự build và deploy mỗi khi push lên nhánh `main` của GitHub. Cấu hình máy chủ và biến môi trường nằm trong `apphosting.yaml`.

Điều kiện để app chạy:

- Google Sheet được chia sẻ quyền **Người xem** cho tài khoản dịch vụ của backend:
  `firebase-app-hosting-compute@hop-dong-app-33aec.iam.gserviceaccount.com` (app không dùng file key)
- Project `hop-dong-app-33aec` đã bật Google Sheets API và Google Drive API
- Firebase Authentication đã bật nhà cung cấp Google; tên miền của app có trong Authorized domains

Rules chặn toàn bộ truy cập trực tiếp từ trình duyệt (app chỉ truy cập qua server):

```bash
firebase deploy --only firestore:rules,storage
```

`storage.rules` vẫn được giữ: app không còn dùng Cloud Storage, nhưng bucket cũ còn các file PDF xuất trước đây và cần được chặn.

Kiểm tra kết nối sau khi deploy: mở `/api/health` (chỉ trả trạng thái true/false, không trả dữ liệu).

## Chạy trên máy (với Firebase Emulator)

1. `npm install`
2. Chạy emulator (cần Java 21):
   ```bash
   firebase emulators:start --only auth,firestore --project demo-contract-app
   ```
   Nếu đường dẫn thư mục dự án có dấu tiếng Việt, Firestore Emulator (Java) sẽ không đọc được file rules —
   chép `firebase.json` và `firestore.rules` ra thư mục không dấu rồi chạy lệnh ở đó.
3. Tạo `.env.local` theo `.env.example`: bật các biến `*_EMULATOR_HOST`, đặt `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-contract-app`,
   và `SERVICE_ACCOUNT_JSON` là key của tài khoản dịch vụ có quyền xem Sheet
4. `npm run dev` → http://localhost:3000

## Cấu trúc thư mục

```
src/
  app/
    page.tsx                  # Danh sách nhân viên + xuất PDF
    tra-cuu/page.tsx          # Tra cứu theo SĐT
    api/
      auth/session|logout|me  # Đăng nhập / đăng xuất / người dùng hiện tại
      employees/              # Đọc + validate danh sách từ Sheet
      contracts/
        export/               # Xuất 1 hợp đồng
        export-batch/         # Xuất theo lô (tối đa 5 người/request)
        search/               # Tra cứu theo SĐT
      health/                 # Kiểm tra kết nối Sheet / Firestore / Auth
  components/AppShell.tsx     # Header + màn hình đăng nhập
  lib/
    google.ts                 # Đọc Sheet + ảnh Drive
    validation.ts             # Ghép + validate dữ liệu
    contract-template.ts      # HTML template hợp đồng
    fonts.generated.ts        # Font Tinos nhúng (sinh bởi scripts/gen-fonts.mjs)
    pdf.ts, tar.ts            # HTML → PDF (Chrome cài sẵn, hoặc @sparticuz/chromium trên Firebase)
    db.ts                     # Firestore
    session.ts                # Cookie phiên, kiểm tra đăng nhập
    firebase-admin.ts         # Firebase Admin SDK (server)
    firebase-client.ts        # Đăng nhập Google (trình duyệt)
scripts/
  gen-fonts.mjs
```

## Dữ liệu nhạy cảm

- `data/`, `.env*` và các file key JSON đã nằm trong `.gitignore` — không bao giờ commit.
- Google Sheet nguồn chứa CCCD và địa chỉ nhân viên.
