import JSZip from "jszip";

// All project source files, bundled as raw text at build time so the
// player can download the complete game code from inside the game.
const sources = import.meta.glob(
  ["/src/**/*.{ts,tsx,css}", "/index.html", "/package.json", "/vite.config.ts", "/tsconfig.json"],
  { query: "?raw", import: "default", eager: true }
) as Record<string, string>;

const README = `# Iron Man MARK 51 vs Thanos  (3D Boss Fight)

เกม 3D ต่อสู้บอสด้วย React + Vite + Tailwind + Three.js
ตัวละครทั้งหมดทำจากกล่องสี่เหลี่ยม (box) ทำให้แก้ไขง่าย

## วิธีรัน
\`\`\`
npm install
npm run dev      # เปิดเล่นในโหมดพัฒนา
npm run build    # สร้างไฟล์เกมแบบไฟล์เดียวที่ dist/index.html
\`\`\`

## โครงสร้างโค้ดหลัก
- src/game/Game.ts      ลูปเกม, ฉาก, ผู้เล่น, AI ของธานอส, โปรเจกไทล์, เอฟเฟกต์
- src/game/builders.ts  สร้างโมเดล Iron Man / Thanos จากกล่อง
- src/game/nano.ts      ระบบนาโนบอท: อาวุธกลายร่างจากของเหลวโลหะ (shader) + อนุภาค
- src/game/audio.ts     เสียงเอฟเฟกต์สังเคราะห์ด้วย WebAudio
- src/App.tsx           HUD / เมนู (React)
`;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Download the full source project as a .zip (npm install && npm run dev). */
export async function downloadSourceZip() {
  const zip = new JSZip();
  const root = zip.folder("ironman-vs-thanos")!;
  for (const [path, content] of Object.entries(sources)) {
    root.file(path.replace(/^\//, ""), content);
  }
  root.file("README.md", README);
  root.file(
    ".gitignore",
    "node_modules\ndist\n"
  );
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  save(blob, "ironman-vs-thanos-source.zip");
}

/** Download the playable game as a single self-contained .html file. */
export async function downloadSingleHtml() {
  if (import.meta.env.DEV) {
    // In dev mode the page is not self-contained; give the source instead.
    await downloadSourceZip();
    return;
  }
  let html = "";
  try {
    const res = await fetch(window.location.href.split("#")[0]);
    html = await res.text();
  } catch {
    html = "<!doctype html>\n" + document.documentElement.outerHTML;
  }
  save(new Blob([html], { type: "text/html" }), "ironman-vs-thanos.html");
}
