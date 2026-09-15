// Lớp truy cập database. Dùng SQLite (better-sqlite3) cho môi trường local.
// Khi deploy production có thể thay bằng Postgres — chỉ cần thay module này,
// phần còn lại của app gọi qua các hàm export bên dưới.

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { StoredContract } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "contracts.db");

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      soHopDong TEXT NOT NULL,
      hoTen TEXT NOT NULL,
      soDienThoai TEXT NOT NULL,
      tenCongTy TEXT NOT NULL,
      pdfPath TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_phone ON contracts(soDienThoai);
    CREATE INDEX IF NOT EXISTS idx_contracts_sohd ON contracts(soHopDong);
  `);
  return _db;
}

/** Chuẩn hóa SĐT về dạng chỉ chứa số, để tra cứu nhất quán. */
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

/**
 * Lưu (hoặc ghi đè) hợp đồng theo số hợp đồng.
 * Đã chốt: xuất lại thì GHI ĐÈ bản cũ — nên nếu đã tồn tại soHopDong thì update.
 * Trả về bản ghi sau khi lưu, kèm cờ cho biết là tạo mới hay ghi đè.
 */
export function upsertContract(input: {
  soHopDong: string;
  hoTen: string;
  soDienThoai: string;
  tenCongTy: string;
  pdfPath: string;
}): { contract: StoredContract; overwritten: boolean } {
  const now = new Date().toISOString();
  const phone = normalizePhone(input.soDienThoai);
  const existing = db()
    .prepare("SELECT * FROM contracts WHERE soHopDong = ?")
    .get(input.soHopDong) as StoredContract | undefined;

  if (existing) {
    db()
      .prepare(
        `UPDATE contracts SET hoTen=?, soDienThoai=?, tenCongTy=?, pdfPath=?, updatedAt=?
         WHERE id=?`
      )
      .run(input.hoTen, phone, input.tenCongTy, input.pdfPath, now, existing.id);
    const updated = db()
      .prepare("SELECT * FROM contracts WHERE id=?")
      .get(existing.id) as StoredContract;
    return { contract: updated, overwritten: true };
  }

  const res = db()
    .prepare(
      `INSERT INTO contracts (soHopDong, hoTen, soDienThoai, tenCongTy, pdfPath, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(input.soHopDong, input.hoTen, phone, input.tenCongTy, input.pdfPath, now, now);
  const created = db()
    .prepare("SELECT * FROM contracts WHERE id=?")
    .get(res.lastInsertRowid) as StoredContract;
  return { contract: created, overwritten: false };
}

/** Tìm hợp đồng đã lưu theo số hợp đồng (để biết có ghi đè hay không). */
export function findBySoHopDong(soHopDong: string): StoredContract | undefined {
  return db()
    .prepare("SELECT * FROM contracts WHERE soHopDong = ?")
    .get(soHopDong) as StoredContract | undefined;
}

/** Tra cứu hợp đồng theo số điện thoại. */
export function searchByPhone(phone: string): StoredContract[] {
  const normalized = normalizePhone(phone);
  return db()
    .prepare("SELECT * FROM contracts WHERE soDienThoai = ? ORDER BY updatedAt DESC")
    .all(normalized) as StoredContract[];
}

/** Lấy một hợp đồng theo id. */
export function getContractById(id: number): StoredContract | undefined {
  return db()
    .prepare("SELECT * FROM contracts WHERE id = ?")
    .get(id) as StoredContract | undefined;
}

/** Danh sách toàn bộ hợp đồng đã xuất (để đối chiếu nút Tải PDF trên danh sách). */
export function listExported(): StoredContract[] {
  return db()
    .prepare("SELECT * FROM contracts ORDER BY updatedAt DESC")
    .all() as StoredContract[];
}
