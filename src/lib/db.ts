// Lưu thông tin hợp đồng đã xuất trong Firestore (collection "contracts").
// Chỉ lưu thông tin, không lưu file PDF — cần bản nào thì xuất lại từ Google Sheet.
//
// ID tài liệu = băm SHA-256 của số hợp đồng: số hợp đồng có dấu "/" (vd. HDTV03/2026) mà Firestore
// không cho phép trong ID, và băm tránh việc 2 số khác nhau (HDTV02/2026, HDTV02_2026) trùng nhau.

import crypto from "crypto";
import type { DocumentData } from "firebase-admin/firestore";
import { firestore } from "./firebase-admin";
import type { StoredContract } from "./types";

const ID_PATTERN = /^[0-9a-f]{32}$/;

const contracts = () => firestore().collection("contracts");

/** ID hợp đồng theo số hợp đồng. */
export function contractIdFor(soHopDong: string): string {
  return crypto.createHash("sha256").update(soHopDong.trim()).digest("hex").slice(0, 32);
}

/** Chuẩn hóa SĐT về dạng chỉ chứa số, để tra cứu nhất quán. */
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

function toContract(id: string, data: DocumentData): StoredContract {
  return {
    id,
    soHopDong: String(data.soHopDong ?? ""),
    hoTen: String(data.hoTen ?? ""),
    soDienThoai: String(data.soDienThoai ?? ""),
    tenCongTy: String(data.tenCongTy ?? ""),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
  };
}

/**
 * Ghi nhận một hợp đồng vừa xuất (theo số hợp đồng).
 * Xuất lại thì ghi đè bản ghi cũ — giữ thời điểm xuất lần đầu, cập nhật thời điểm xuất gần nhất.
 */
export async function upsertContract(input: {
  soHopDong: string;
  hoTen: string;
  soDienThoai: string;
  tenCongTy: string;
}): Promise<{ contract: StoredContract; overwritten: boolean }> {
  const id = contractIdFor(input.soHopDong);
  const ref = contracts().doc(id);
  const now = new Date().toISOString();
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = {
      soHopDong: input.soHopDong,
      hoTen: input.hoTen,
      soDienThoai: normalizePhone(input.soDienThoai),
      tenCongTy: input.tenCongTy,
      createdAt: snap.exists ? String(snap.get("createdAt")) : now,
      updatedAt: now,
    };
    tx.set(ref, data);
    return { contract: toContract(id, data), overwritten: snap.exists };
  });
}

/** Tìm hợp đồng đã xuất theo số hợp đồng (để hỏi xác nhận trước khi ghi đè). */
export async function findBySoHopDong(soHopDong: string): Promise<StoredContract | undefined> {
  const snap = await contracts().doc(contractIdFor(soHopDong)).get();
  return snap.exists ? toContract(snap.id, snap.data() ?? {}) : undefined;
}

/** Lấy một hợp đồng theo id. */
export async function getContractById(id: string): Promise<StoredContract | undefined> {
  if (!ID_PATTERN.test(id)) return undefined;
  const snap = await contracts().doc(id).get();
  return snap.exists ? toContract(snap.id, snap.data() ?? {}) : undefined;
}

/** Tra cứu hợp đồng theo SĐT, mới nhất trước (sắp xếp tại chỗ để khỏi phải tạo index Firestore). */
export async function searchByPhone(phone: string): Promise<StoredContract[]> {
  const snap = await contracts().where("soDienThoai", "==", normalizePhone(phone)).get();
  return snap.docs
    .map((d) => toContract(d.id, d.data()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Số hợp đồng của các hợp đồng đã xuất (để đánh dấu dòng nào xuất lại sẽ ghi đè). */
export async function listExportedSoHopDong(): Promise<string[]> {
  const snap = await contracts().select("soHopDong").get();
  return snap.docs.map((d) => String(d.get("soHopDong") ?? "")).filter(Boolean);
}
