// Sinh src/lib/fonts.generated.ts: nhúng font Tinos (base64) vào template hợp đồng,
// để PDF hiển thị giống nhau trên mọi máy chủ (Windows, Linux, Firebase) và đủ dấu tiếng Việt.
// Tinos có cùng kích thước chữ với Times New Roman nên bố cục trang không đổi.
// Chạy lại khi nâng cấp @fontsource/tinos:  node scripts/gen-fonts.mjs

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("@fontsource/tinos/package.json"));
const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));

const SUBSETS = ["latin", "latin-ext", "vietnamese"];
const STYLES = ["400", "400-italic", "700", "700-italic"];

const faces = [];
for (const style of STYLES) {
  const css = fs.readFileSync(path.join(pkgDir, `${style}.css`), "utf8");
  const blocks = css.matchAll(
    /\/\*\s*tinos-([a-z-]+)-\d+-(?:normal|italic)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g
  );
  for (const [, subset, body] of blocks) {
    if (!SUBSETS.includes(subset)) continue;
    const file = body.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
    if (!file) throw new Error(`Không thấy file woff2 trong ${style}.css (${subset})`);
    const base64 = fs.readFileSync(path.join(pkgDir, "files", file)).toString("base64");
    const rule = body.replace(
      /src:[^;]+;/,
      `src: url(data:font/woff2;base64,${base64}) format("woff2");`
    );
    faces.push(`@font-face {${rule}}`);
  }
}

const expected = SUBSETS.length * STYLES.length;
if (faces.length !== expected) {
  throw new Error(
    `Chỉ tìm thấy ${faces.length}/${expected} @font-face — cấu trúc @fontsource/tinos đã đổi?`
  );
}

const out = `// FILE TỰ SINH bởi scripts/gen-fonts.mjs — không sửa tay.
// Font Tinos từ ${pkg.name}@${pkg.version} (giấy phép ${pkg.license}), các bộ ký tự: ${SUBSETS.join(", ")}.
export const TINOS_FONT_FACE_CSS = ${JSON.stringify(faces.join("\n"))};
`;
const outPath = path.join(process.cwd(), "src", "lib", "fonts.generated.ts");
fs.writeFileSync(outPath, out, "utf8");
console.log(`✓ Đã sinh ${outPath} (${faces.length} @font-face, ${(out.length / 1024).toFixed(0)} KB)`);
