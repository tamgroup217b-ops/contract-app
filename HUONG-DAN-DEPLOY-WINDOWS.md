# Hướng dẫn deploy lên VPS Windows Server 2022

App này chạy tốt trên Windows Server. Làm theo các bước dưới đây trên VPS (qua Remote Desktop).

---

## Bước 1 — Cài Node.js

1. Trên VPS, mở trình duyệt (Edge), vào: https://nodejs.org
2. Tải bản **LTS** (nút xanh bên trái), file `.msi`
3. Chạy file, bấm Next → Next → Install (để mặc định mọi thứ)
4. Kiểm tra: mở **PowerShell** (bấm Start, gõ "PowerShell", Enter), gõ:
   ```
   node --version
   ```
   Thấy `v20.x.x` hoặc `v22.x.x` là OK.

---

## Bước 2 — Cài Google Chrome

1. Trên VPS, mở Edge, vào: https://www.google.com/chrome
2. Tải và cài Chrome (bấm Next để mặc định)
3. App sẽ tự tìm Chrome ở `C:\Program Files\Google\Chrome\...` — không cần cấu hình gì.

---

## Bước 3 — Giải nén code

1. Copy file `contract-app.zip` (đã gửi) vào VPS — kéo thả vào cửa sổ Remote Desktop,
   hoặc copy (Ctrl+C ở máy bạn) rồi paste (Ctrl+V) vào thư mục trên VPS.
2. Giải nén ra, ví dụ vào: `C:\contract-app`
3. Kết quả: `C:\contract-app` chứa `package.json`, thư mục `src`, v.v.

---

## Bước 4 — Cài thư viện & build

1. Mở **PowerShell**
2. Di chuyển vào thư mục app:
   ```
   cd C:\contract-app
   ```
3. Cài thư viện (chạy 1 lần, mất vài phút):
   ```
   npm install
   ```

---

## Bước 4b — Đặt file cấu hình .env (QUAN TRỌNG)

App đọc cấu hình (Spreadsheet ID + JSON key) từ một file tên `.env`.
Cấu hình đã được chuẩn bị sẵn trong file **`env-cho-vps.txt`** (gửi kèm).

1. Đưa file `env-cho-vps.txt` lên VPS (cùng cách với gói code — qua Google Drive).
   LƯU Ý: file này chứa JSON key nhạy cảm — chia sẻ RIÊNG TƯ, tải xong xóa khỏi Drive.
2. Copy file đó vào thư mục `C:\contract-app`
3. **Đổi tên** file từ `env-cho-vps.txt` thành `.env`
   (trong PowerShell tại `C:\contract-app`:)
   ```
   Rename-Item env-cho-vps.txt .env
   ```
   Kiểm tra đã có file `.env`:
   ```
   Get-Content .env | Select-Object -First 4
   ```

4. Build app:
   ```
   npm run build
   ```
   Thấy "Compiled successfully" là OK.

---

## Bước 5 — Chạy thử

1. Vẫn trong PowerShell tại `C:\contract-app`, chạy:
   ```
   npm run start
   ```
2. Thấy `Ready` và `http://localhost:3000` là app đang chạy.
3. Trên VPS, mở Edge vào `http://localhost:3000` để kiểm tra.
4. App tự đọc cấu hình từ `.env` — KHÔNG có nút Cài đặt (đúng như thiết kế).
   Danh sách nhân viên sẽ hiện ngay. Thử xuất PDF một người.

Nhấn `Ctrl + C` trong PowerShell để dừng app (khi cần).

---

## Bước 6 — Chạy nền 24/7 (để app luôn bật)

Dùng **PM2** để app tự chạy nền và tự khởi động lại nếu lỗi.

1. Cài PM2:
   ```
   npm install -g pm2
   ```
2. Chạy app qua PM2:
   ```
   cd C:\contract-app
   pm2 start npm --name contract-app -- run start
   ```
3. Lưu để tự chạy lại sau khi VPS khởi động lại:
   ```
   pm2 save
   ```
   (Trên Windows, để PM2 tự chạy khi khởi động máy cần cài thêm `pm2-windows-startup`:
   ```
   npm install -g pm2-windows-startup
   pm2-startup install
   pm2 save
   ```
   )
4. Xem app đang chạy: `pm2 list` — Xem log: `pm2 logs contract-app`

---

## Bước 7 — Cho phép truy cập từ ngoài internet

1. **Mở cổng 3000 trên Windows Firewall:**
   - Mở PowerShell **với quyền Administrator** (chuột phải PowerShell → Run as administrator)
   - Chạy:
     ```
     New-NetFirewallRule -DisplayName "Contract App" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
     ```
2. **Mở cổng 3000 trên tường lửa của nhà cung cấp VPS** (nếu có — kiểm tra trong trang quản lý VPS, mục Firewall / Security Group, thêm rule cho port 3000).
3. Giờ truy cập từ máy bất kỳ: `http://<IP-của-VPS>:3000`

---

## Lưu ý bảo mật

- App KHÔNG có đăng nhập — ai có link (IP:3000) đều dùng được, xem được CCCD/địa chỉ nhân viên.
- Truy cập qua `http://IP:3000` KHÔNG mã hóa (không có ổ khóa xanh HTTPS).
- Khi có tên miền, báo lại để thêm HTTPS (miễn phí qua Let's Encrypt / Cloudflare).

---

## Cập nhật code sau này

Khi có bản code mới:
1. Dừng app: `pm2 stop contract-app`
2. Copy code mới đè lên `C:\contract-app` (giữ nguyên thư mục `data`)
3. `npm install` (nếu có thư viện mới) → `npm run build`
4. `pm2 restart contract-app`

Thư mục `data` chứa cấu hình + database + PDF — KHÔNG xóa khi cập nhật.
