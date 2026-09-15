"use client";

import { useEffect, useMemo, useState } from "react";

interface Issue {
  level: "error" | "warning";
  field: string;
  message: string;
}
interface Row {
  employee: {
    stt: string;
    soHopDong: string;
    hoTen: string;
    soDienThoai: string;
    congTy: string;
    coSoLamViec: string;
  };
  company: { tenCongTy: string } | null;
  issues: Issue[];
  canExport: boolean;
  exported?: { id: number } | null; // hợp đồng đã xuất (nếu có) — điền sau khi hợp nhất
}

interface ClientConfig {
  spreadsheetId: string;
  employeeSheetName: string;
  companySheetName: string;
  hasServiceAccount: boolean;
  isConfigured: boolean;
  envManaged: boolean;
}

export default function HomePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [exportedMap, setExportedMap] = useState<Record<string, number>>({}); // soHopDong -> contractId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Bộ lọc
  const [filterCompany, setFilterCompany] = useState("");
  const [filterCoSo, setFilterCoSo] = useState("");
  const [keyword, setKeyword] = useState(""); // tìm theo tên hoặc SĐT

  // Panel cài đặt
  const [showSettings, setShowSettings] = useState(false);
  // Nút Cài đặt chỉ hiện khi app KHÔNG bị khóa cấu hình bằng biến môi trường.
  // Trên VPS (có env) → ẩn nút; local → hiện để nhập cấu hình.
  const [showSettingsButton, setShowSettingsButton] = useState(false);

  // Xuất tất cả
  const [exportingAll, setExportingAll] = useState(false);

  async function sync() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không tải được dữ liệu.");
        setRows([]);
      } else {
        setRows(data.rows || []);
        // Lập map các hợp đồng đã xuất để hiện nút "Tải PDF"
        const map: Record<string, number> = {};
        for (const c of data.exported || []) map[c.soHopDong] = c.id;
        setExportedMap(map);
      }
    } catch {
      setError("Lỗi kết nối tới máy chủ.");
    }
    setLoading(false);
  }

  useEffect(() => {
    sync();
    // Hỏi server: cấu hình có bị khóa bằng biến môi trường không?
    // Nếu KHÔNG bị khóa (local) → hiện nút Cài đặt.
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => setShowSettingsButton(!cfg.envManaged))
      .catch(() => setShowSettingsButton(false));
  }, []);

  async function exportPdf(row: Row, confirmOverwrite = false) {
    setExportingId(row.employee.stt);
    try {
      const res = await fetch("/api/contracts/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stt: row.employee.stt, confirmOverwrite }),
      });
      if (res.ok) {
        const blob = await res.blob();
        // Tải file PDF về máy (thư mục Downloads)
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${row.employee.soHopDong || "hop-dong-" + row.employee.stt}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        await sync();
      } else if (res.status === 409) {
        const data = await res.json();
        if (window.confirm(data.message || "Bản cũ sẽ bị thay thế. Tiếp tục?")) {
          setExportingId(null);
          await exportPdf(row, true);
          return;
        }
      } else {
        const err = await res.json();
        alert(err.error || "Xuất PDF thất bại.");
      }
    } catch {
      alert("Lỗi khi xuất PDF.");
    }
    setExportingId(null);
  }

  // Danh sách công ty & cơ sở làm việc (unique) để đổ vào dropdown lọc
  const companyOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const name = r.company?.tenCongTy || r.employee.congTy;
      if (name) s.add(name);
    }
    return Array.from(s).sort();
  }, [rows]);

  const coSoOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.employee.coSoLamViec) s.add(r.employee.coSoLamViec);
    return Array.from(s).sort();
  }, [rows]);

  // Áp bộ lọc
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter((r) => {
      const companyName = r.company?.tenCongTy || r.employee.congTy || "";
      if (filterCompany && companyName !== filterCompany) return false;
      if (filterCoSo && r.employee.coSoLamViec !== filterCoSo) return false;
      if (kw) {
        const hay = `${r.employee.hoTen} ${r.employee.soDienThoai}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [rows, filterCompany, filterCoSo, keyword]);

  const okCount = filtered.filter((r) => r.canExport).length;
  const errCount = filtered.length - okCount;
  const hasFilter = filterCompany || filterCoSo || keyword;

  // Xuất tất cả các dòng ĐỦ ĐIỀU KIỆN trong danh sách đã lọc → 1 file ZIP
  async function exportAll() {
    const exportable = filtered.filter((r) => r.canExport);
    if (exportable.length === 0) {
      alert("Không có nhân viên nào đủ điều kiện xuất trong danh sách hiện tại.");
      return;
    }
    const overwriteCount = exportable.filter(
      (r) => exportedMap[r.employee.soHopDong]
    ).length;
    let confirmMsg = `Xuất hợp đồng cho ${exportable.length} nhân viên (bỏ qua ${errCount} dòng lỗi).`;
    if (overwriteCount > 0) {
      confirmMsg += `\n\nTrong đó ${overwriteCount} hợp đồng đã tồn tại — bản cũ sẽ bị thay thế.`;
    }
    confirmMsg += "\n\nTiếp tục?";
    if (!window.confirm(confirmMsg)) return;

    setExportingAll(true);
    try {
      const res = await fetch("/api/contracts/export-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stts: exportable.map((r) => r.employee.stt) }),
      });
      if (res.ok) {
        const success = res.headers.get("X-Export-Success");
        const failed = res.headers.get("X-Export-Failed");
        const blob = await res.blob();
        // Tải file ZIP về máy
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hop-dong-${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        await sync();
        alert(
          `Đã xuất ${success} hợp đồng vào file ZIP.` +
            (Number(failed) > 0 ? ` (${failed} lỗi bị bỏ qua)` : "")
        );
      } else {
        const err = await res.json();
        alert(err.error || "Xuất tất cả thất bại.");
      }
    } catch {
      alert("Lỗi khi xuất tất cả.");
    }
    setExportingAll(false);
  }

  return (
    <div className="container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1>Danh sách nhân viên</h1>
        </div>
        <div className="row-actions">
          {showSettingsButton && (
            <button onClick={() => setShowSettings((v) => !v)}>
              ⚙️ Cài đặt
            </button>
          )}
          <button
            onClick={exportAll}
            disabled={exportingAll || loading || okCount === 0}
            title={
              okCount === 0
                ? "Không có nhân viên nào đủ điều kiện xuất"
                : `Xuất ${okCount} hợp đồng đủ điều kiện${hasFilter ? " (theo bộ lọc)" : ""}`
            }
          >
            {exportingAll ? "Đang xuất..." : `📦 Xuất tất cả (${okCount})`}
          </button>
          <button className="primary" onClick={sync} disabled={loading}>
            {loading ? "Đang đồng bộ..." : "↻ Đồng bộ lại"}
          </button>
        </div>
      </div>

      {showSettings && <SettingsPanel onSaved={sync} />}

      {error && (
        <div className="notice error" style={{ marginTop: 16 }}>
          {error}{" "}
          {error.includes("Cài đặt") && (
            <button className="link-btn" onClick={() => setShowSettings(true)}>
              → Mở Cài đặt
            </button>
          )}
        </div>
      )}

      {/* Bộ lọc */}
      {rows.length > 0 && (
        <div className="card filter-bar">
          <div className="field-inline">
            <label>Theo công ty</label>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
            >
              <option value="">Tất cả công ty</option>
              {companyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field-inline">
            <label>Theo cơ sở làm việc</label>
            <select value={filterCoSo} onChange={(e) => setFilterCoSo(e.target.value)}>
              <option value="">Tất cả cơ sở</option>
              {coSoOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field-inline" style={{ flex: 1, minWidth: 200 }}>
            <label>Tìm theo tên / SĐT</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Nhập tên hoặc số điện thoại..."
            />
          </div>
          {hasFilter && (
            <button
              className="clear-filter"
              onClick={() => {
                setFilterCompany("");
                setFilterCoSo("");
                setKeyword("");
              }}
            >
              Xóa lọc
            </button>
          )}
        </div>
      )}

      {!error && !loading && rows.length > 0 && (
        <div className="notice info">
          {hasFilter ? "Kết quả lọc: " : "Tổng "}
          <strong>{filtered.length}</strong> dòng — <strong>{okCount}</strong> đủ điều
          kiện xuất, <strong>{errCount}</strong> cần kiểm tra lại.
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="notice info">Không có dữ liệu nhân viên nào.</div>
      )}

      {rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Số HĐ</th>
                <th>Họ và tên</th>
                <th>Số điện thoại</th>
                <th>Công ty (Bên A)</th>
                <th>Cơ sở làm việc</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const contractId = exportedMap[r.employee.soHopDong];
                return (
                  <tr key={r.employee.stt}>
                    <td>{r.employee.stt}</td>
                    <td>{r.employee.soHopDong || "—"}</td>
                    <td>{r.employee.hoTen || "—"}</td>
                    <td>{r.employee.soDienThoai || "—"}</td>
                    <td>
                      {r.company?.tenCongTy || (
                        <span className="badge err">Không khớp</span>
                      )}
                    </td>
                    <td>{r.employee.coSoLamViec || "—"}</td>
                    <td>
                      {r.canExport ? (
                        r.issues.length === 0 ? (
                          <span className="badge ok">Đủ thông tin</span>
                        ) : (
                          <span className="badge warn">Có cảnh báo</span>
                        )
                      ) : (
                        <span className="badge err">Lỗi dữ liệu</span>
                      )}
                      {r.issues.length > 0 && (
                        <ul className="issue-list">
                          {r.issues.map((i, idx) => (
                            <li key={idx} className={i.level}>
                              {i.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      <button
                        className="primary"
                        disabled={!r.canExport || exportingId === r.employee.stt}
                        onClick={() => exportPdf(r)}
                        title={
                          contractId
                            ? "Tạo lại PDF từ dữ liệu Sheet mới nhất (ghi đè bản cũ)"
                            : "Tạo PDF từ dữ liệu Sheet"
                        }
                      >
                        {exportingId === r.employee.stt ? "Đang xuất..." : "Xuất PDF"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "#6b7280" }}>
                    Không có nhân viên nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Panel Cài đặt (gộp vào trang, mở/đóng) ---------- */

function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [cfg, setCfg] = useState<ClientConfig | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [employeeSheetName, setEmployeeSheetName] = useState("Nhân viên");
  const [companySheetName, setCompanySheetName] = useState("Công ty");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/config");
    const data: ClientConfig = await res.json();
    setCfg(data);
    setSpreadsheetId(data.spreadsheetId);
    setEmployeeSheetName(data.employeeSheetName);
    setCompanySheetName(data.companySheetName);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spreadsheetId,
        employeeSheetName,
        companySheetName,
        serviceAccountJson,
      }),
    });
    if (res.ok) {
      setServiceAccountJson("");
      setMsg({ type: "success", text: "Đã lưu cấu hình." });
      await load();
      onSaved();
    } else {
      const err = await res.json();
      setMsg({ type: "error", text: err.error || "Lưu thất bại." });
    }
    setSaving(false);
  }

  return (
    <div className="card settings-panel">
      <h2>Cài đặt kết nối Google Sheet</h2>
      {cfg && (
        <div className={`notice ${cfg.isConfigured ? "success" : "info"}`}>
          {cfg.isConfigured
            ? "✅ Đã cấu hình kết nối Google Sheet."
            : "⚠️ Chưa cấu hình đủ — cần Spreadsheet ID và Service Account JSON."}
        </div>
      )}
      {msg && <div className={`notice ${msg.type}`}>{msg.text}</div>}

      <div className="field">
        <label>Spreadsheet ID</label>
        <input
          type="text"
          value={spreadsheetId}
          onChange={(e) => setSpreadsheetId(e.target.value)}
          placeholder="Chuỗi ID trong link Google Sheet (giữa /d/ và /edit)"
        />
      </div>

      <div className="field">
        <label>Service Account JSON key</label>
        <textarea
          value={serviceAccountJson}
          onChange={(e) => setServiceAccountJson(e.target.value)}
          placeholder={
            cfg?.hasServiceAccount
              ? "•••• Đã có key. Để trống nếu không đổi."
              : 'Dán toàn bộ nội dung file .json'
          }
        />
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Tên tab Nhân viên</label>
          <input
            type="text"
            value={employeeSheetName}
            onChange={(e) => setEmployeeSheetName(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Tên tab Công ty</label>
          <input
            type="text"
            value={companySheetName}
            onChange={(e) => setCompanySheetName(e.target.value)}
          />
        </div>
      </div>

      <button className="primary" onClick={save} disabled={saving}>
        {saving ? "Đang lưu..." : "Lưu cấu hình"}
      </button>
    </div>
  );
}
