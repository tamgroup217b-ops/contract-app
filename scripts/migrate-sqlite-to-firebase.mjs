// Chuyển hợp đồng đã xuất từ bản cũ (SQLite + thư mục PDF) lên Firestore + Cloud Storage.
//
// Dùng:
//   node scripts/migrate-sqlite-to-firebase.mjs --data "C:/Users/admin/Downloads/contract-app/data" [--dry-run]
//
// Xác thực: GOOGLE_APPLICATION_CREDENTIALS (key tài khoản dịch vụ của project Firebase),
// hoặc chạy thử với Firebase Emulator (FIRESTORE_EMULATOR_HOST, FIREBASE_STORAGE_EMULATOR_HOST).
// Chạy lại nhiều lần được: cùng số hợp đồng → ghi đè cùng tài liệu/file; bản trên Firebase mới hơn thì bỏ qua.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const args = process.argv.slice(2);
const dataIndex = args.indexOf("--data");
const dataDir = dataIndex >= 0 ? args[dataIndex + 1] : "";
const dryRun = args.includes("--dry-run");
const projectId = process.env.FIREBASE_PROJECT_ID || "hop-dong-app-33aec";
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "hop-dong-app-33aec.firebasestorage.app";

if (!dataDir) {
  console.error('Thiếu --data "<thư mục data của bản cũ>"');
  process.exit(1);
}

// Phải khớp contractIdFor / normalizePhone trong src/lib/db.ts.
const contractIdFor = (soHopDong) =>
  crypto.createHash("sha256").update(soHopDong.trim()).digest("hex").slice(0, 32);
const normalizePhone = (phone) => (phone || "").replace(/\D/g, "");

// Chép database (kèm file -wal/-shm) ra thư mục tạm: dữ liệu mới nhất nằm trong file -wal,
// và không mở trực tiếp để khỏi làm thay đổi bản sao lưu.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "contracts-db-"));
for (const suffix of ["", "-wal", "-shm"]) {
  const src = path.join(dataDir, `contracts.db${suffix}`);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmpDir, `contracts.db${suffix}`));
}
const sqlite = new DatabaseSync(path.join(tmpDir, "contracts.db"));
const rows = sqlite
  .prepare(
    "SELECT soHopDong, hoTen, soDienThoai, tenCongTy, pdfPath, createdAt, updatedAt FROM contracts ORDER BY id"
  )
  .all();
sqlite.close();
// Xóa bản sao ngay (có dữ liệu cá nhân) — kể cả khi script dừng sớm ở các bước sau.
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`Đọc được ${rows.length} hợp đồng từ ${dataDir}`);

// Kiểm tra đủ PDF và không trùng ID trước khi ghi bất cứ gì lên Firebase.
const plan = rows.map((row) => {
  // pdfPath là đường dẫn tuyệt đối trên máy cũ (Windows hoặc Linux) → chỉ lấy tên file.
  const fileName = path.basename(String(row.pdfPath).replace(/\\/g, "/"));
  const pdfFile = path.join(dataDir, "contracts", fileName);
  return { ...row, id: contractIdFor(row.soHopDong), fileName, pdfFile };
});
const missing = plan.filter((p) => !fs.existsSync(p.pdfFile)).map((p) => p.fileName);
const duplicateIds = plan.length - new Set(plan.map((p) => p.id)).size;
if (missing.length > 0 || duplicateIds > 0) {
  console.error(`Dừng: thiếu ${missing.length} file PDF, trùng ${duplicateIds} số hợp đồng.`, missing);
  process.exit(1);
}
if (dryRun) {
  console.log("Chạy thử (--dry-run): đủ file PDF, không ghi gì lên Firebase.");
  process.exit(0);
}

const app = initializeApp({ projectId, storageBucket });
const firestore = getFirestore(app);
const bucket = getStorage(app).bucket();

let migrated = 0;
let skipped = 0;
for (const p of plan) {
  const ref = firestore.collection("contracts").doc(p.id);
  const existing = await ref.get();
  if (existing.exists && String(existing.get("updatedAt")) > String(p.updatedAt)) {
    skipped++; // đã xuất lại trên bản mới → giữ bản mới
    continue;
  }
  const storagePath = `contracts/${p.id}.pdf`;
  await bucket
    .file(storagePath)
    .save(fs.readFileSync(p.pdfFile), { resumable: false, contentType: "application/pdf" });
  await ref.set({
    soHopDong: p.soHopDong,
    hoTen: p.hoTen,
    soDienThoai: normalizePhone(p.soDienThoai),
    tenCongTy: p.tenCongTy,
    storagePath,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
  migrated++;
}

const count = (await firestore.collection("contracts").count().get()).data().count;
const [files] = await bucket.getFiles({ prefix: "contracts/" });
console.log(
  `Đã chuyển ${migrated}, bỏ qua ${skipped} (bản trên Firebase mới hơn). ` +
    `Firestore hiện có ${count} hợp đồng, Storage có ${files.length} file PDF.`
);
