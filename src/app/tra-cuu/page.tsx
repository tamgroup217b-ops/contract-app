"use client";

// Tra cứu theo số điện thoại: xem những hợp đồng đã xuất cho người đó và thời điểm xuất.
// App không lưu file PDF — cần bản mới thì xuất lại ở trang Danh sách nhân viên.

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api-client";

interface ContractResult {
  id: string;
  soHopDong: string;
  hoTen: string;
  soDienThoai: string;
  tenCongTy: string;
  createdAt: string;
  updatedAt: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN");
}

export default function LookupPage() {
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<ContractResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await apiFetch(`/api/contracts/search?phone=${encodeURIComponent(phone)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setResults(data.contracts || []);
      else if (res.status !== 401) setError(data.error || "Tra cứu thất bại.");
    } catch {
      setError("Lỗi kết nối tới máy chủ.");
    }
    setLoading(false);
  }

  return (
    <div className="container">
      <h1>Tra cứu hợp đồng</h1>
      <p className="subtitle">
        Xem các hợp đồng đã xuất theo số điện thoại của người lao động. Cần file PDF thì vào trang
        Danh sách nhân viên và bấm Xuất PDF.
      </p>

      <form className="card filter-bar" onSubmit={search}>
        <div className="field-inline" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="phone">Số điện thoại</label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ví dụ: 0900000000"
            required
          />
        </div>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Đang tìm..." : "Tìm"}
        </button>
      </form>

      {error && <div className="notice error">{error}</div>}

      {results && results.length === 0 && (
        <div className="notice info">Không có hợp đồng nào đã xuất cho số điện thoại này.</div>
      )}

      {results && results.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Số HĐ</th>
                <th>Họ và tên</th>
                <th>Số điện thoại</th>
                <th>Công ty (Bên A)</th>
                <th>Xuất lần đầu</th>
                <th>Xuất gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {results.map((c) => (
                <tr key={c.id}>
                  <td>{c.soHopDong}</td>
                  <td>{c.hoTen}</td>
                  <td>{c.soDienThoai}</td>
                  <td>{c.tenCongTy}</td>
                  <td>{formatTime(c.createdAt)}</td>
                  <td>{formatTime(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
