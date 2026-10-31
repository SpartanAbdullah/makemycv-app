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
 *   MSYS_NO_PATHCONV=1 node scripts/pdf-fidelity.mjs [--skip-render] [--only=classic,onyx] [--persona=bilingual] [--gate]
 * Env: PREVIEW_BASE_URL (default http://localhost:3000), FIDELITY_OUT (default
 *      ../_cowork/pdf-fidelity-<today>), FIDELITY_TOL (luminance tolerance, 0.10).
 * Needs the repo's Playwright + the system Chrome (channel "chrome"); pdf.js is
 * served from node_modules by a tiny node:http server so no network is needed.
 *
 * --persona=bilingual renders the ONE case "bilingual" (the synthetic Arabic +
 * English overlay, lib/data/preview-profiles.ts) instead of the density trio.
 * --gate compares every cell with scripts/pdf-fidelity-baseline.json and exits 1
 * when a page count changes, text parity drops by more than 1 point or the
 * page-1 block diff rises by more than GATE_BLOCK_SLACK points — the regression
 * guard for the transcription fixes (PDF_FIDELITY.md). `npm run fidelity:pdf`.
 * Every cell also records an ATS-style extraction check: the order in which the
 * section headings come out of the pdf.js text layer against the preview's DOM
 * order, and whether the email and phone survive as one run each.
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
const PERSONA = opt("persona");
// bilingual = session-3 overlay; arabic-* = the session-4 Arabic PDF suite
// (lib/data/preview-profiles.ts getPersonaProfile).
const PERSONAS = ["bilingual", "arabic-only", "arabic-first", "arabic-name", "arabic-dense"];
if (PERSONA && !PERSONAS.includes(PERSONA)) throw new Error(`unknown --persona=${PERSONA} (one of ${PERSONAS.join(", ")})`);
const OUT_DIR = path.resolve(process.env.FIDELITY_OUT || path.join(ROOT, "..", "_cowork", `pdf-fidelity-${DAY}${PERSONA ? `-${PERSONA}` : ""}`));
const BASELINE_FILE = path.join(ROOT, "scripts", "pdf-fidelity-baseline.json");
const GATE_BLOCK_SLACK = 3; // points of page-1 block diff a cell may rise before --gate fails
const PDF_DIR = path.join(ROOT, ".fidelity-pdfs");
const PDFJS_DIR = path.join(ROOT, "node_modules", "pdfjs-dist", "build");
const TOL = Number(process.env.FIDELITY_TOL || 0.1); // 10% of full intensity
const BLOCK = 8; // px; block metric = mean-luminance drift per 8x8 cell
const A4 = { w: 794, h: 1123 }; // CSS px at 96dpi, the app-wide render size
const CASES = PERSONA
  ? [{ id: PERSONA, query: `?persona=${PERSONA}` }] // one synthetic Arabic persona, own levels
  : [
      { id: "natural", query: "" }, // persona's own density levels (one page by design)
      { id: "compact", query: "?density=1" }, // all four density controls at 1
      { id: "dense", query: "?density=5" }, // all four at 5 -> crosses a page break
    ];

// ---------- 1. PDFs: compile + run the Node renderer (same persona + density) ----------
function renderPdfs() {
  const run = (cmd, a) => {
    const env = PERSONA ? { ...process.env, FIDELITY_PERSONA: PERSONA } : process.env;
    const r = spawnSync(cmd, a, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32", env });
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
  // text layer, all pages: runs on one line are glued when their x-extents touch.
  // A glued group whose lettered items are all right-to-left is one Arabic word
  // or phrase drawn visually (pdf.js splits items at positioning adjustments),
  // so its item order is reversed back to logical order; a direction change
  // between lettered items closes the group (session 4, 2026-10-31). Latin-only
  // lines never form an rtl group, so their text is unchanged.
  let text = "";
  const lettered = (s) => /\\p{L}/u.test(s);
  for (let p = 1; p <= n; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items.filter((it) => "str" in it);
    let grp = [], grpDir = null;
    const flush = (sep) => { if (grp.length) { const l = grp.filter((it) => lettered(it.str));
      const rtl = l.length > 0 && l.every((it) => it.dir === "rtl");
      text += (rtl ? [...grp].reverse() : grp).map((it) => it.str).join(""); } grp = []; grpDir = null; text += sep; };
    items.forEach((it, i) => { const nx = items[i + 1]; const d = lettered(it.str) ? it.dir : null;
      if (grp.length && d && grpDir && d !== grpDir) flush("");
      grp.push(it); if (d) grpDir = d;
      if (it.hasEOL || !nx) flush("\\n"); else if (nx.transform[4] - (it.transform[4] + it.width) > 0.9) flush(" "); });
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

// ---------- 3b. ATS-style extraction: heading order + contact runs ----------
// Canonical section ids matched against whole lines of either text; the first
// occurrence of each gives the order a parser would see the sections in.
const SECTION_HEADINGS = [
  ["summary", /^(summary|profile|about( me)?|professional summary|profile summary|executive summary)$/i],
  ["experience", /^(experience|work experience|professional experience|employment( history)?|career history)$/i],
  ["education", /^(education|academic background)$/i],
  ["skills", /^(skills|core skills|key skills|technical skills|skills & interests|skills & expertise|core competencies|expertise)$/i],
  ["languages", /^languages$/i],
  ["certifications", /^(certifications?|certificates|certifications & training|professional development)$/i],
  ["projects", /^(projects|key projects)$/i],
];
// A line counts when it is one heading, or a run of headings — pdf.js puts the
// two column headings of a Languages | Certifications row on ONE line.
const headingsOnLine = (line) => {
  const words = line.split(" ");
  const found = [];
  for (let i = 0; i < words.length; ) {
    let hit = null;
    for (let k = Math.min(4, words.length - i); k >= 1 && !hit; k--) {
      const chunk = words.slice(i, i + k).join(" ");
      const m = SECTION_HEADINGS.find(([, re]) => re.test(chunk));
      if (m) hit = { id: m[0], k };
    }
    if (!hit) return [];
    found.push(hit.id); i += hit.k;
  }
  return found;
};
const headingOrder = (text) => {
  const seen = [];
  for (const raw of text.split("\n")) {
    const line = unsplit(raw.replace(/\s+/g, " ").trim());
    if (!line) continue;
    for (const id of headingsOnLine(line)) if (!seen.includes(id)) seen.push(id);
  }
  return seen;
};
function extractionCheck(previewText, pdfText) {
  const previewOrder = headingOrder(previewText);
  const pdfOrder = headingOrder(pdfText);
  // Only sections found on BOTH sides are compared for order; a heading the
  // regex misses on one side is reported, not counted as a reorder.
  const common = previewOrder.filter((id) => pdfOrder.includes(id));
  const pdfCommon = pdfOrder.filter((id) => common.includes(id));
  const orderMatch = common.every((id, i) => pdfCommon[i] === id);
  const squash = (t) => t.replace(/\s+/g, " ");
  const email = (previewText.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [])[0] || null;
  const phone = (previewText.match(/\+\d[\d\sX-]{6,}[\dX]/) || [])[0]?.trim() || null;
  const pdfSquashed = squash(pdfText);
  return {
    previewOrder, pdfOrder, orderMatch,
    missingHeadings: previewOrder.filter((id) => !pdfOrder.includes(id)),
    email, emailInPdf: email ? pdfSquashed.includes(email) : null,
    phone, phoneInPdf: phone ? pdfSquashed.includes(squash(phone)) : null,
  };
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
  const manifest = JSON.parse(fs.readFileSync(path.join(PDF_DIR, PERSONA ? `manifest-${PERSONA}.json` : "manifest.json"), "utf8"));
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
        r.extraction = extractionCheck(info.text, out.text);
        r.verdict = verdict(r);
        const x = r.extraction;
        const xFlag = `${x.orderMatch ? "order=" : "ORDER≠"}${x.emailInPdf === false ? " EMAIL-SPLIT" : ""}${x.phoneInPdf === false ? " PHONE-SPLIT" : ""}${x.missingHeadings.length ? ` no-heading:${x.missingHeadings.join(",")}` : ""}`;
        console.log(`${r.verdict.padEnd(9)} pages ${r.previewPages}~/${r.pdfPages}  text ${r.text.parityPct}%  px ${r.visual[0].pixelDiffPct}%  blk ${r.visual[0].blockDiffPct}%  miss ${r.text.missing.length} extra ${r.text.extra.length}  ${xFlag}`);
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
    : `| ${r.template} | ${r.case} | ${r.previewPages}~ / ${r.pdfPages} | ${r.text.parityPct}% (−${r.text.missing.length} / +${r.text.extra.length}) | ${r.visual[0].pixelDiffPct}% / ${r.visual[0].blockDiffPct}% | ${r.visual[1] ? `${r.visual[1].pixelDiffPct}% / ${r.visual[1].blockDiffPct}%` : "–"} | ${extractionCell(r.extraction)} | ${r.verdict} |`);
  const matrix = ["| Template | Case | Pages preview~ / PDF | Text parity (missing / extra words) | p1 pixel / block diff | p2 pixel / block diff | Extraction (order / contact) | Verdict |", "|---|---|---|---|---|---|---|---|", ...rows].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "matrix.md"), matrix + "\n");
  const tally = results.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
  console.log(`\n${results.length} comparisons -> ${JSON.stringify(tally)}\nwrote ${OUT_DIR}`);
  process.exitCode = tally.ERROR ? 1 : 0;
  if (flag("gate")) process.exitCode = gate(results) || process.exitCode;
}

const extractionCell = (x) => {
  if (!x) return "–";
  const parts = [x.orderMatch ? "order ok" : `ORDER pdf: ${x.pdfOrder.join(">")}`];
  if (x.missingHeadings.length) parts.push(`no heading in pdf: ${x.missingHeadings.join(",")}`);
  parts.push(x.emailInPdf === null ? "no email" : x.emailInPdf ? "email ok" : "EMAIL split");
  parts.push(x.phoneInPdf === null ? "no phone" : x.phoneInPdf ? "phone ok" : "PHONE split");
  return parts.join("; ");
};

// ---------- 5. --gate: regression guard against the committed baseline ----------
// scripts/pdf-fidelity-baseline.json holds, per cell, the PDF page count, text
// parity and page-1 block diff of the last accepted run. A fix that improves a
// cell should also lower its baseline so the number cannot drift back up.
function gate(results) {
  if (!fs.existsSync(BASELINE_FILE)) { console.error(`--gate: no baseline at ${BASELINE_FILE}`); return 1; }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")).cells;
  const failures = [];
  for (const r of results) {
    const key = `${r.template}-${r.case}`;
    const b = baseline[key];
    if (r.error) { failures.push(`${key}: render/compare error`); continue; }
    if (!b) { console.log(`--gate: ${key} has no baseline entry (new cell), skipped`); continue; }
    if (r.pdfPages !== b.pdfPages) failures.push(`${key}: PDF pages ${b.pdfPages} -> ${r.pdfPages}`);
    if (r.text.parityPct < b.parityPct - 1) failures.push(`${key}: text parity ${b.parityPct}% -> ${r.text.parityPct}%`);
    if (r.visual[0].blockDiffPct > b.blockDiffPct + GATE_BLOCK_SLACK) failures.push(`${key}: p1 block diff ${b.blockDiffPct}% -> ${r.visual[0].blockDiffPct}% (slack ${GATE_BLOCK_SLACK})`);
    // Order is gated as a regression only: a two-column layout that breaks
    // across pages legitimately emits its aside before the rest of the main
    // column (Modern at density 5), and the baseline records that.
    if (b.orderMatch && r.extraction && !r.extraction.orderMatch) failures.push(`${key}: section order in the PDF text layer no longer matches the preview`);
  }
  if (failures.length) { console.error(`\n--gate FAILED (${failures.length}):\n  ${failures.join("\n  ")}`); return 1; }
  console.log("--gate passed: no cell regressed against scripts/pdf-fidelity-baseline.json");
  return 0;
}

main().catch((err) => { console.error("fidelity harness failed:", err); process.exit(1); });
