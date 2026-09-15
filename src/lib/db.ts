// Lưu thông tin hợp đồng đã xuất trong Firestore (collection "contracts").
// ID tài liệu = băm SHA-256 của số hợp đồng: số hợp đồng có dấu "/" (vd. HDTV03/2026) mà Firestore
// không cho phép trong ID, và băm tránh việc 2 số khác nhau (HDTV02/2026, HDTV02_2026) dùng chung file.

import crypto from "crypto";
import type { DocumentData } from "firebase-admin/firestore";
import { firestore } from "./firebase-admin";
import type { StoredContract } from "./types";

const ID_PATTERN = /^[0-9a-f]{32}$/;

const contracts = () => firestore().collection("contracts");

/** ID hợp đồng theo số hợp đồng. Phải khớp scripts/migrate-sqlite-to-firebase.mjs. */
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
    storagePath: String(data.storagePath ?? ""),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
  };
}

/**
 * Lưu (hoặc ghi đè) hợp đồng theo số hợp đồng.
 * Đã chốt: xuất lại thì GHI ĐÈ bản cũ — giữ thời điểm tạo lần đầu, cập nhật thời điểm sửa.
 */
export async function upsertContract(input: {
  soHopDong: string;
  hoTen: string;
  soDienThoai: string;
  tenCongTy: string;
  storagePath: string;
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
      storagePath: input.storagePath,
      createdAt: snap.exists ? String(snap.get("createdAt")) : now,
      updatedAt: now,
    };
    tx.set(ref, data);
    return { contract: toContract(id, data), overwritten: snap.exists };
  });
}

/** Tìm hợp đồng đã lưu theo số hợp đồng (để biết có ghi đè hay không). */
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

/** Số hợp đồng của các hợp đồng đã xuất (để hiện nút "Tải PDF" trên danh sách). */
export async function listExported(): Promise<Array<{ id: string; soHopDong: string }>> {
  const snap = await contracts().select("soHopDong").get();
  return snap.docs.map((d) => ({ id: d.id, soHopDong: String(d.get("soHopDong") ?? "") }));
}
