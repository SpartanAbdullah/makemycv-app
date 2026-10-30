#!/usr/bin/env node
/**
 * Preview-vs-PDF fidelity harness (2026-10-31).
 *
 * For every registered template x content case it
 *   1. screenshots the chrome-less live preview (/preview/<id>?density=N) at the
 *      CV's natural A4 width, un-clipped so page 2 overflow is visible;
 *   2. rasterises the matching react-pdf output (.fidelity-pdfs/<id>-<case>.pdf,
 *      rendered by scripts/pdf-fidelity-render.tsx from the SAME persona + density)
 *      with pdf.js in the same browser at the same pixel width;
 *   3. compares text (preview innerText vs pdf.js text layer), page count and a
 *      per-pixel luminance diff computed on canvases in the browser.
 * Writes <out>/<template>-<case>.png (preview | pdf | diff), results.json, matrix.md.
 *
 * Run (Git Bash, production server already on :3000):
 *   MSYS_NO_PATHCONV=1 node scripts/pdf-fidelity.mjs [--skip-render] [--only=classic,onyx]
 * Env: PREVIEW_BASE_URL (default http://localhost:3000), FIDELITY_OUT (default
 *      ../_cowork/pdf-fidelity-<today>), FIDELITY_TOL (luminance tolerance, 0.10).
 * Needs the repo's Playwright + the system Chrome (channel "chrome"); pdf.js is
 * served from node_modules by a tiny node:http server so no network is needed.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const BASE_URL = (process.env.PREVIEW_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const DAY = new Date().toLocaleDateString("sv"); // local YYYY-MM-DD
const OUT_DIR = path.resolve(process.env.FIDELITY_OUT || path.join(ROOT, "..", "_cowork", `pdf-fidelity-${DAY}`));
const PDF_DIR = path.join(ROOT, ".fidelity-pdfs");
const PDFJS_DIR = path.join(ROOT, "node_modules", "pdfjs-dist", "build");
const TOL = Number(process.env.FIDELITY_TOL || 0.1); // 10% of full intensity
const BLOCK = 8; // px; block metric = mean-luminance drift per 8x8 cell
const A4 = { w: 794, h: 1123 }; // CSS px at 96dpi, the app-wide render size
const CASES = [
  { id: "natural", query: "" }, // persona's own density levels (one page by design)
  { id: "compact", query: "?density=1" }, // all four density controls at 1
  { id: "dense", query: "?density=5" }, // all four at 5 -> crosses a page break
];

// ---------- 1. PDFs: compile + run the Node renderer (same persona + density) ----------
function renderPdfs() {
  const run = (cmd, a) => {
    const r = spawnSync(cmd, a, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
    if (r.status !== 0) throw new Error(`${cmd} ${a.join(" ")} exited ${r.status}`);
  };
  run("npx", ["tsc", "scripts/pdf-fidelity-render.tsx", "--outDir", ".pdf-fidelity-build", "--module", "commonjs",
    "--target", "es2020", "--esModuleInterop", "--skipLibCheck", "--jsx", "react-jsx"]);
  run("node", [".pdf-fidelity-build/scripts/pdf-fidelity-render.js"]);
}

// ---------- 2. static server: pdf.js + PDFs + the compare page ----------
const COMPARE_HTML = `<!doctype html><meta charset="utf-8"><title>fidelity</title>
<script type="module">
import * as pdfjs from "/pdfjs/pdf.min.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); return [c, x]; };
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
window.compare = async ({ png, pdfUrl, W, H, tol, block }) => {
  const img = await loadImg("data:image/png;base64," + png);
  const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
  const n = doc.numPages, thr = tol * 255;
  // text layer, all pages: runs on one line are glued when their x-extents touch
  let text = "";
  for (let p = 1; p <= n; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items.filter((it) => "str" in it);
    items.forEach((it, i) => { const nx = items[i + 1]; text += it.str;
      if (it.hasEOL || !nx) text += "\\n"; else text += nx.transform[4] - (it.transform[4] + it.width) > 0.9 ? " " : ""; });
    text += "\\n";
  }
  const previewPages = Math.max(1, Math.ceil((img.height - 2) / H));
  const count = Math.min(2, Math.max(n, previewPages));
  const gap = 20, labelH = 24;
  const [comp, cx] = mk(W * 3 + gap * 2, (H + labelH) * count + gap * (count - 1));
  cx.fillStyle = "#f1f5f9"; cx.fillRect(0, 0, comp.width, comp.height);
  const pages = [];
  for (let p = 1; p <= count; p++) {
    const [pa, ax] = mk(W, H); ax.drawImage(img, 0, (p - 1) * H, W, H, 0, 0, W, H);
    const [pb, bx] = mk(W, H);
    if (p <= n) { const page = await doc.getPage(p); const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: W / vp0.width }); await page.render({ canvasContext: bx, viewport: vp }).promise; }
    const A = ax.getImageData(0, 0, W, H).data, B = bx.getImageData(0, 0, W, H).data;
    const [pd, dx] = mk(W, H); const D = dx.getImageData(0, 0, W, H); const d = D.data;
    let diff = 0, inkA = 0, inkB = 0;
    const la = new Float32Array(W * H), lb = new Float32Array(W * H);
    for (let i = 0, q = 0; i < A.length; i += 4, q++) {
      la[q] = lum(A, i); lb[q] = lum(B, i);
      if (la[q] < 200) inkA++; if (lb[q] < 200) inkB++;
      const g = 215 + Math.round((la[q] / 255) * 40); // faint preview ghost
      d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255;
      if (Math.abs(la[q] - lb[q]) > thr) { diff++;
        if (la[q] < lb[q]) { d[i] = 220; d[i + 1] = 38; d[i + 2] = 38; } else { d[i] = 37; d[i + 1] = 99; d[i + 2] = 235; } }
    }
    dx.putImageData(D, 0, 0);
    let blocks = 0, blockDiff = 0;
    for (let y = 0; y < H; y += block) for (let x = 0; x < W; x += block) {
      let sa = 0, sb = 0, k = 0;
      for (let yy = y; yy < Math.min(H, y + block); yy++) for (let xx = x; xx < Math.min(W, x + block); xx++) { sa += la[yy * W + xx]; sb += lb[yy * W + xx]; k++; }
      blocks++; if (Math.abs(sa - sb) / k > thr) blockDiff++;
    }
    const top = (p - 1) * (H + labelH + gap);
    cx.fillStyle = "#0f172a"; cx.font = "bold 14px sans-serif";
    [["PREVIEW (live template)", 0], ["PDF (react-pdf via pdf.js)", W + gap], ["DIFF  red = preview-only ink, blue = pdf-only ink", 2 * (W + gap)]]
      .forEach(([t, x]) => cx.fillText(\`page \${p} — \${t}\`, x + 6, top + 17));
    [pa, pb, pd].forEach((c, i) => cx.drawImage(c, i * (W + gap), top + labelH));
    pages.push({ page: p, pixelDiffPct: +((diff / (W * H)) * 100).toFixed(2), blockDiffPct: +((blockDiff / blocks) * 100).toFixed(2),
      inkPreviewPct: +((inkA / (W * H)) * 100).toFixed(2), inkPdfPct: +((inkB / (W * H)) * 100).toFixed(2), pdfHasPage: p <= n });
  }
  return { pdfPages: n, previewPages, previewHeightPx: img.height, text, pages, composite: comp.toDataURL("image/png").split(",")[1] };
};
window.__ready = true;
</script>`;

function startServer() {
  const types = { ".mjs": "text/javascript", ".js": "text/javascript", ".pdf": "application/pdf", ".html": "text/html" };
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let file;
    if (url === "/compare") { res.writeHead(200, { "content-type": "text/html" }); return res.end(COMPARE_HTML); }
    if (url.startsWith("/pdfjs/")) file = path.join(PDFJS_DIR, path.basename(url));
    else if (url.startsWith("/pdfs/")) file = path.join(PDF_DIR, path.basename(url));
    if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, origin: `http://127.0.0.1:${srv.address().port}` })));
}

// ---------- 3. text parity ----------
const unsplit = (s) => { let prev; do { prev = s; s = s.replace(/\b(\p{L}) (?=\p{L}\b)/gu, "$1"); } while (s !== prev); return s; }; // "E X P E R I E N C E"
const tokenize = (s) => unsplit(s.normalize("NFKC").toLowerCase().replace(/[’'`]/g, "")).split(/[^\p{L}\p{N}+#]+/u).filter(Boolean);
function textParity(previewText, pdfText) {
  const prevTokens = tokenize(previewText);
  const prevSet = new Set(prevTokens);
  // react-pdf hyphenates at line ends: re-join "a-\nb" only when the preview has the joined word
  const dehyph = pdfText.replace(/(\S+)-\n(\S+)/g, (m, a, b) => (prevSet.has(tokenize(a + b)[0]) ? a + b : m));
  const pdfTokens = tokenize(dehyph);
  const count = (arr) => arr.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map());
  const pa = count(prevTokens), pb = count(pdfTokens);
  const missing = [], extra = [];
  for (const [t, c] of pa) for (let i = (pb.get(t) || 0); i < c; i++) missing.push(t);
  for (const [t, c] of pb) for (let i = (pa.get(t) || 0); i < c; i++) extra.push(t);
  const total = prevTokens.length + pdfTokens.length;
  return { previewWords: prevTokens.length, pdfWords: pdfTokens.length, missing, extra,
    parityPct: total ? +((1 - (missing.length + extra.length) / total) * 100).toFixed(1) : 100 };
}

function verdict(r) {
  if (r.error) return "ERROR";
  const p1 = r.visual[0];
  const pagesOk = r.previewPages === r.pdfPages;
  if (r.text.parityPct >= 98 && pagesOk && p1.blockDiffPct <= 8) return "ok";
  if (r.text.parityPct >= 95 && Math.abs(r.previewPages - r.pdfPages) <= 1 && p1.blockDiffPct <= 15) return "check";
  return "mismatch";
}

// ---------- 4. main loop ----------
async function main() {
  if (!flag("skip-render")) renderPdfs();
  const manifest = JSON.parse(fs.readFileSync(path.join(PDF_DIR, "manifest.json"), "utf8"));
  const only = opt("only")?.split(",");
  const templateIds = [...new Set(manifest.map((m) => m.template))].filter((t) => !only || only.includes(t));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { srv, origin } = await startServer();
  const browser = await chromium.launch({ channel: "chrome" });
  const results = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: A4.w, height: A4.h }, deviceScaleFactor: 1, bypassCSP: true });
    await ctx.route(/va\.vercel-scripts\.com/, (r) => r.abort());
    const prev = await ctx.newPage();
    const cmp = await ctx.newPage();
    await cmp.goto(`${origin}/compare`);
    await cmp.waitForFunction(() => window.__ready === true, null, { timeout: 15_000 });
    for (const id of templateIds) for (const c of CASES) {
      const key = `${id}-${c.id}`;
      const pdfFile = path.join(PDF_DIR, `${key}.pdf`);
      const r = { template: id, case: c.id, previewUrl: `${BASE_URL}/preview/${id}${c.query}`, pdf: pdfFile, png: path.join(OUT_DIR, `${key}.png`) };
      process.stdout.write(`${key.padEnd(28)} `);
      try {
        if (!fs.existsSync(pdfFile)) throw new Error("PDF missing (renderer failed for this case)");
        await prev.goto(r.previewUrl, { waitUntil: "networkidle", timeout: 60_000 });
        await prev.waitForSelector('[data-preview-ready="true"]', { timeout: 15_000 });
        // un-clip the A4 frame so the overflow (what the PDF puts on page 2) is visible
        await prev.addStyleTag({ content: "html,body{overflow:visible!important}[data-preview-ready]{height:auto!important;overflow:visible!important}nextjs-portal{display:none!important}" });
        await prev.evaluate(async () => { await document.fonts.ready;
          await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))); });
        await prev.waitForTimeout(300);
        const info = await prev.evaluate(() => { const w = document.querySelector('[data-preview-ready]');
          return { text: w.innerText, rootHeight: Math.round(w.firstElementChild?.getBoundingClientRect().height ?? w.scrollHeight), root: w.firstElementChild?.className?.slice(0, 60) }; });
        const png = (await prev.screenshot({ fullPage: true })).toString("base64");
        const out = await cmp.evaluate((a) => window.compare(a), { png, pdfUrl: `${origin}/pdfs/${key}.pdf`, W: A4.w, H: A4.h, tol: TOL, block: BLOCK });
        fs.writeFileSync(r.png, Buffer.from(out.composite, "base64"));
        r.previewRootHeightPx = info.rootHeight;
        r.previewPages = Math.max(1, Math.ceil((info.rootHeight - 2) / A4.h)); // continuous flow / A4; heuristic, not a real paginator
        r.pdfPages = out.pdfPages;
        r.text = textParity(info.text, out.text);
        r.visual = out.pages;
        r.verdict = verdict(r);
        console.log(`${r.verdict.padEnd(9)} pages ${r.previewPages}~/${r.pdfPages}  text ${r.text.parityPct}%  px ${r.visual[0].pixelDiffPct}%  blk ${r.visual[0].blockDiffPct}%  miss ${r.text.missing.length} extra ${r.text.extra.length}`);
      } catch (err) {
        r.error = String(err.message || err).split("\n")[0]; r.verdict = "ERROR";
        console.log(`ERROR     ${r.error}`);
      }
      results.push(r);
    }
  } finally {
    await browser.close(); srv.close();
  }
  const meta = { date: new Date().toISOString(), baseUrl: BASE_URL, tolerance: TOL, block: BLOCK, a4: A4, cases: CASES, pdfjs: JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/pdfjs-dist/package.json"))).version };
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify({ meta, results }, null, 2));
  const rows = results.map((r) => r.error
    ? `| ${r.template} | ${r.case} | – | – | – | – | ERROR: ${r.error} |`
    : `| ${r.template} | ${r.case} | ${r.previewPages}~ / ${r.pdfPages} | ${r.text.parityPct}% (−${r.text.missing.length} / +${r.text.extra.length}) | ${r.visual[0].pixelDiffPct}% / ${r.visual[0].blockDiffPct}% | ${r.visual[1] ? `${r.visual[1].pixelDiffPct}% / ${r.visual[1].blockDiffPct}%` : "–"} | ${r.verdict} |`);
  const matrix = ["| Template | Case | Pages preview~ / PDF | Text parity (missing / extra words) | p1 pixel / block diff | p2 pixel / block diff | Verdict |", "|---|---|---|---|---|---|---|", ...rows].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "matrix.md"), matrix + "\n");
  const tally = results.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
  console.log(`\n${results.length} comparisons -> ${JSON.stringify(tally)}\nwrote ${OUT_DIR}`);
  process.exitCode = tally.ERROR ? 1 : 0;
}

main().catch((err) => { console.error("fidelity harness failed:", err); process.exit(1); });
