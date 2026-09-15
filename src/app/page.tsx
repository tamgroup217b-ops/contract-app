"use client";

import JSZip from "jszip";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { EXPORT_BATCH_SIZE, pdfFileName } from "@/lib/export-options";

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
}
interface BatchResult {
  stt: string;
  fileName?: string;
  pdfBase64?: string;
  name?: string;
  error?: string;
}

/** Tải file về máy (thư mục Downloads). */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function HomePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [exportedMap, setExportedMap] = useState<Record<string, string>>({}); // soHopDong -> contractId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Bộ lọc
  const [filterCompany, setFilterCompany] = useState("");
  const [filterCoSo, setFilterCoSo] = useState("");
  const [keyword, setKeyword] = useState(""); // tìm theo tên hoặc SĐT

  // Xuất tất cả: tiến độ theo lô (null = không chạy)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  async function sync() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/employees");
      const data = await res.json();
      if (!res.ok) {
        if (res.status !== 401) setError(data.error || "Không tải được dữ liệu.");
        setRows([]);
      } else {
        setRows(data.rows || []);
        // Lập map các hợp đồng đã xuất để hiện nút "Tải PDF"
        const map: Record<string, string> = {};
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
  }, []);

  async function exportPdf(row: Row, confirmOverwrite = false) {
    setExportingId(row.employee.stt);
    try {
      const res = await apiFetch("/api/contracts/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stt: row.employee.stt, confirmOverwrite }),
      });
      if (res.ok) {
        downloadBlob(await res.blob(), pdfFileName(row.employee.soHopDong, `hop-dong-${row.employee.stt}`));
        await sync();
      } else if (res.status === 409) {
        const data = await res.json();
        if (window.confirm(data.message || "Bản cũ sẽ bị thay thế. Tiếp tục?")) {
          setExportingId(null);
          await exportPdf(row, true);
          return;
        }
      } else if (res.status !== 401) {
        const err = await res.json().catch(() => ({}));
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
  const exportingAll = batchProgress !== null;

  // Xuất tất cả các dòng ĐỦ ĐIỀU KIỆN trong danh sách đã lọc → 1 file ZIP.
  // Gửi theo lô EXPORT_BATCH_SIZE người/request để mỗi request ngắn và hiện được tiến độ.
  async function exportAll() {
    const exportable = filtered.filter((r) => r.canExport);
    if (exportable.length === 0) {
      alert("Không có nhân viên nào đủ điều kiện xuất trong danh sách hiện tại.");
      return;
    }
    const overwriteCount = exportable.filter((r) => exportedMap[r.employee.soHopDong]).length;
    let confirmMsg = `Xuất hợp đồng cho ${exportable.length} nhân viên (bỏ qua ${errCount} dòng lỗi).`;
    if (overwriteCount > 0) {
      confirmMsg += `\n\nTrong đó ${overwriteCount} hợp đồng đã tồn tại — bản cũ sẽ bị thay thế.`;
    }
    confirmMsg += "\n\nTiếp tục?";
    if (!window.confirm(confirmMsg)) return;

    const zip = new JSZip();
    const usedNames = new Map<string, number>(); // tránh trùng tên file trong zip
    const failed: string[] = [];
    let success = 0;
    let sessionExpired = false;
    setBatchProgress({ done: 0, total: exportable.length });

    for (let start = 0; start < exportable.length; start += EXPORT_BATCH_SIZE) {
      const chunk = exportable.slice(start, start + EXPORT_BATCH_SIZE);
      const chunkNames = chunk.map((r) => r.employee.hoTen || r.employee.stt);
      try {
        const res = await apiFetch("/api/contracts/export-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stts: chunk.map((r) => r.employee.stt) }),
        });
        if (res.status === 401) {
          sessionExpired = true;
          break;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed.push(...chunkNames.map((n) => `${n}: ${data.error || "lỗi máy chủ"}`));
        } else {
          for (const item of (data.results || []) as BatchResult[]) {
            if (item.pdfBase64 && item.fileName) {
              const base = item.fileName.replace(/\.pdf$/i, "");
              const count = usedNames.get(base) ?? 0;
              usedNames.set(base, count + 1);
              zip.file(count > 0 ? `${base}-${count + 1}.pdf` : `${base}.pdf`, item.pdfBase64, {
                base64: true,
              });
              success++;
            } else {
              failed.push(`${item.name || item.stt}: ${item.error || "lỗi"}`);
            }
          }
        }
      } catch {
        failed.push(...chunkNames.map((n) => `${n}: lỗi kết nối`));
      }
      setBatchProgress({ done: Math.min(start + chunk.length, exportable.length), total: exportable.length });
    }

    if (success > 0) {
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `hop-dong-${new Date().toISOString().slice(0, 10)}.zip`);
    }
    setBatchProgress(null);
    if (sessionExpired) return; // AppShell đã hiện lại màn hình đăng nhập

    await sync();
    let msg = `Đã xuất ${success}/${exportable.length} hợp đồng${success > 0 ? " vào file ZIP" : ""}.`;
    if (failed.length > 0) {
      msg += `\n\nKhông xuất được ${failed.length}:\n${failed.slice(0, 10).join("\n")}`;
      if (failed.length > 10) msg += `\n… và ${failed.length - 10} dòng khác`;
    }
    alert(msg);
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
          <button
            onClick={exportAll}
            disabled={exportingAll || loading || okCount === 0}
            title={
              okCount === 0
                ? "Không có nhân viên nào đủ điều kiện xuất"
                : `Xuất ${okCount} hợp đồng đủ điều kiện${hasFilter ? " (theo bộ lọc)" : ""}`
            }
          >
            {batchProgress
              ? `Đang xuất ${batchProgress.done}/${batchProgress.total}...`
              : `📦 Xuất tất cả (${okCount})`}
          </button>
          <button className="primary" onClick={sync} disabled={loading || exportingAll}>
            {loading ? "Đang đồng bộ..." : "↻ Đồng bộ lại"}
          </button>
        </div>
      </div>

      {error && (
        <div className="notice error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {/* Bộ lọc */}
      {rows.length > 0 && (
        <div className="card filter-bar">
          <div className="field-inline">
            <label>Theo công ty</label>
            <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
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
          <strong>{filtered.length}</strong> dòng — <strong>{okCount}</strong> đủ điều kiện xuất,{" "}
          <strong>{errCount}</strong> cần kiểm tra lại.
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
                    <td>{r.company?.tenCongTy || <span className="badge err">Không khớp</span>}</td>
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
                      <div className="row-actions">
                        <button
                          className="primary"
                          disabled={!r.canExport || exportingId === r.employee.stt || exportingAll}
                          onClick={() => exportPdf(r)}
                          title={
                            contractId
                              ? "Tạo lại PDF từ dữ liệu Sheet mới nhất (ghi đè bản cũ)"
                              : "Tạo PDF từ dữ liệu Sheet"
                          }
                        >
                          {exportingId === r.employee.stt ? "Đang xuất..." : "Xuất PDF"}
                        </button>
                        {contractId && (
                          <a
                            className="btn"
                            href={`/api/contracts/${contractId}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Mở bản PDF đã lưu"
                          >
                            Tải PDF
                          </a>
                        )}
                      </div>
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
