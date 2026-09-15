// Đọc file .tar (định dạng POSIX ustar) nằm sẵn trong bộ nhớ — đủ để lấy vài thư viện
// từ gói @sparticuz/chromium mà không cần lệnh `tar` trên máy chủ.

export interface TarEntry {
  name: string;
  data: Buffer;
}

const BLOCK = 512;

function readString(header: Buffer, start: number, length: number): string {
  const raw = header.subarray(start, start + length);
  const end = raw.indexOf(0);
  return (end === -1 ? raw : raw.subarray(0, end)).toString("utf8");
}

/** Liệt kê các file thường trong archive tar (bỏ qua thư mục, symlink...). */
export function* readTarFiles(archive: Buffer): Generator<TarEntry> {
  let offset = 0;
  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    // Block toàn số 0 đánh dấu hết archive.
    if (header.every((byte) => byte === 0)) return;

    const baseName = readString(header, 0, 100);
    // Trường prefix (tên dài) chỉ có nghĩa ở định dạng POSIX ustar.
    const prefix = readString(header, 257, 6) === "ustar" ? readString(header, 345, 155) : "";
    const name = prefix ? `${prefix}/${baseName}` : baseName;
    const size = parseInt(readString(header, 124, 12).trim() || "0", 8);
    const type = readString(header, 156, 1);

    const dataStart = offset + BLOCK;
    if (type === "0" || type === "") {
      yield { name, data: archive.subarray(dataStart, dataStart + size) };
    }
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
  }
}
