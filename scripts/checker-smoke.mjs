// Checker smoke (2026-10-31, FEATURE_BACKLOG B3).
//
// Drives /resume-checker in a real browser: uploads a PDF, and asserts that
//   1. the "What the ATS sees" panel appears after client-side extraction with
//      non-zero character/word counts and shows the text when opened;
//   2. `checker_preview_viewed` reaches window.dataLayer with surface=upload;
//   3. the ONLY request that leaves the browser is the existing
//      POST /api/resume-checker/parse with exactly { rawText, fileName } —
//      the panel adds no payload (privacy posture, CLAUDE.md);
//   4. axe-core finds no serious/critical violation with the panel open;
//   5. the extracted text is carried to the report page in sessionStorage
//      under the returned report id (same tab only).
// The parse route is intercepted and answered locally, so no ANTHROPIC_API_KEY,
// KV or network is needed; the report page itself is out of scope here.
//
// Usage:
//   npm run build && npx next start -p 3000      (or `npm run dev -p 3000`)
//   npm run smoke:pdf                            (produces .smoke-pdfs/*.pdf)
//   npm run smoke:checker
//   SMOKE_BASE=http://localhost:3100 SMOKE_PDF=path/to/cv.pdf node scripts/checker-smoke.mjs
//
// Deliberately NOT a `test:*` script (needs a server + Chrome), same as
// scripts/builder-smoke.mjs.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const failures = [];
const ok = (label) => console.log(`PASS  ${label}`);
const fail = (label, detail) => {
  failures.push(label);
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
};

function pickPdf() {
  if (process.env.SMOKE_PDF) return path.resolve(process.env.SMOKE_PDF);
  for (const dir of [".smoke-pdfs", ".fidelity-pdfs"]) {
    const full = path.join(process.cwd(), dir);
    if (!fs.existsSync(full)) continue;
    const f = fs.readdirSync(full).filter((n) => n.endsWith(".pdf")).sort()[0];
    if (f) return path.join(full, f);
  }
  return null;
}

const pdfPath = pickPdf();
if (!pdfPath) {
  console.error("No PDF to upload. Run `npm run smoke:pdf` first or set SMOKE_PDF.");
  process.exit(1);
}
console.log(`upload fixture: ${path.relative(process.cwd(), pdfPath)}`);

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Everything that leaves the page, so the "no new data leaves" assertion is
// over the whole upload, not just the one route we expect.
const outgoing = [];
page.on("request", (req) => {
  const url = new URL(req.url());
  if (url.origin !== new URL(BASE).origin || req.method() === "GET") return;
  outgoing.push({ path: url.pathname, body: req.postData() ?? "" });
});

// Hold the parse response until the upload-page assertions have run, then
// answer locally so the flow continues to the report URL.
let release;
const gate = new Promise((r) => (release = r));
const REPORT_ID = "smoke-preview-0001";
await page.route("**/api/resume-checker/parse", async (route) => {
  await gate;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ reportId: REPORT_ID }),
  });
});

await page.goto(`${BASE}/resume-checker`, { waitUntil: "domcontentloaded" });
// The file input's onChange is attached on hydration; selecting a file
// before that is silently ignored (seen against `next dev`).
await page.waitForLoadState("networkidle");
await page.locator("#resume-checker-file").setInputFiles(pdfPath);

const panel = page.getByTestId("ats-text-preview");
try {
  await panel.waitFor({ state: "visible", timeout: 30000 });
  ok("panel appears after client-side extraction");
} catch {
  fail("panel appears after client-side extraction", "not visible within 30 s");
}

const summary = (await panel.locator("p").first().textContent()) ?? "";
const m = summary.match(/([\d,]+) characters · ([\d,]+) words · ([\d,]+) lines(?: · (\d+) pages?)?/);
if (m && Number(m[2].replace(/,/g, "")) > 100) ok(`counts: ${summary.trim()}`);
else fail("counts in summary line", summary.trim());

// Opening the text fires the analytics event; the <pre> must hold the text.
await panel.getByRole("button", { name: /show text/i }).click();
const pre = panel.locator("pre");
const preText = (await pre.textContent()) ?? "";
if ((await pre.isVisible()) && preText.trim().length > 200) ok(`text shown (${preText.length} chars, monospace <pre>)`);
else fail("text shown", `visible=${await pre.isVisible()} len=${preText.length}`);

const dl = await page.evaluate(() => (window.dataLayer ?? []).map((e) => ({ event: e.event, surface: e.surface })));
if (dl.some((e) => e.event === "checker_preview_viewed" && e.surface === "upload")) ok("dataLayer has checker_preview_viewed{surface:upload}");
else fail("dataLayer has checker_preview_viewed", JSON.stringify(dl));

// axe with the panel open (builder-smoke covers the closed page).
const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
await page.addScriptTag({ path: axePath });
const violations = await page.evaluate(async () => {
  const r = await window.axe.run({ exclude: [["[inert]"], [".cv-print"]] }, { resultTypes: ["violations"] });
  return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target?.[0] ?? "" }));
});
const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
if (serious.length === 0) ok(`axe checker upload + open panel: no serious/critical (${violations.length} minor)`);
else fail("axe checker upload + open panel", serious.map((v) => `${v.id}[${v.impact}] ×${v.n} ${v.target}`).join("; "));

// Let the (mocked) server answer and follow the redirect.
release();
try {
  await page.waitForURL(new RegExp(`/resume-checker/report/${REPORT_ID}`), { timeout: 15000 });
  ok("redirects to the report URL");
} catch {
  fail("redirects to the report URL", `still at ${page.url()}`);
}

// Privacy: exactly one non-GET request, to the parse route, with the two
// known keys and nothing else.
const posts = outgoing.filter((r) => !r.path.startsWith("/_next/"));
if (posts.length === 1 && posts[0].path === "/api/resume-checker/parse") {
  const keys = Object.keys(JSON.parse(posts[0].body)).sort().join(",");
  if (keys === "fileName,rawText") ok("only POST /api/resume-checker/parse left the browser, body keys {fileName,rawText}");
  else fail("parse body keys", keys);
} else {
  fail("only the parse POST leaves the browser", JSON.stringify(posts.map((p) => p.path)));
}

const carried = await page.evaluate(() => {
  try {
    const raw = window.sessionStorage.getItem("makemycv:checkerPreview");
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { v: p.v, reportId: p.reportId, kind: p.kind, pages: p.pages, len: (p.text ?? "").length };
  } catch {
    return null;
  }
});
const expectedKind = pdfPath.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
if (carried && carried.reportId === REPORT_ID && carried.len > 200 && carried.kind === expectedKind) ok(`sessionStorage carry-over for the report page: ${JSON.stringify(carried)}`);
else fail("sessionStorage carry-over", JSON.stringify(carried));

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nchecker smoke: all checks passed");
