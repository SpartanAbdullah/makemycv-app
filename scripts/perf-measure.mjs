// Runtime performance measurement (2026-10-31, session 4 priority 9).
//
// Drives a PRODUCTION build in the installed Chrome and prints medians over
// N runs for the numbers that matter to a job seeker on this app:
//   /builder cold load   — TTFB, LCP, hydration (React props attached to the
//                          first input), JS transferred, first Continue click
//   typing               — per-keystroke React work (capture→bubble on `input`)
//                          and input→paint, 50 characters into First name and
//                          into the Summary textarea
//   preview re-render    — input event → first DOM mutation inside .cv-print
//   PDF export           — Download click → PDF blob created (dense persona:
//                          the classic preview profile with experience tripled)
//   import               — text-cv.pdf → MappingReview visible; a 25 MB PDF →
//                          error bar visible (the 15 MB gate)
//   checker              — PDF chosen → POST /api/resume-checker/parse sent
//                          (the route is answered locally; no key is needed)
//   mobile               — Pixel 7 emulation + 4× CPU throttling: cold load
//                          and typing
//
// Usage:
//   npm run build && npx next start -p 3750          (one terminal)
//   npm run smoke:pdf                                (compiles the preview
//                                                     profiles into
//                                                     .pdfsmoke-test-build)
//   SMOKE_BASE=http://localhost:3750 node scripts/perf-measure.mjs
//   RUNS=3 ONLY=load,typing,preview,export,import,checker,mobile
//
// Deliberately NOT a `test:*` script: it needs a server and a browser, and it
// reports numbers rather than pass/fail. Results also land as JSON in
// .perf-results/<timestamp>.json (gitignored via /.perf-results).

import { chromium, devices } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { makeLargePdf } from "./make-import-fixtures.mjs";

const require = createRequire(import.meta.url);
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3750";
const RUNS = Number(process.env.RUNS ?? 3);
const ONLY = new Set((process.env.ONLY ?? "load,typing,preview,export,import,checker,mobile").split(","));
const SCHEMA_VERSION = 3; // lib/store/migrate.ts CURRENT_VERSION

const median = (xs) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const p95 = (xs) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] : NaN;
};
const fmt = (n, unit = "ms") => (Number.isFinite(n) ? `${Math.round(n)} ${unit}` : "n/a");

const results = {};
const record = (section, key, value) => {
  (results[section] ??= {})[key] ??= [];
  results[section][key].push(value);
};

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

/** Dense persona: the classic preview profile with its experience tripled —
 *  the same stress the `-long` pass of scripts/pdf-smoke.tsx applies. */
function densePersona() {
  const built = path.resolve(".pdfsmoke-test-build/lib/data/preview-profiles.js");
  if (!fs.existsSync(built)) {
    throw new Error("Run `npm run smoke:pdf` first — it compiles lib/data/preview-profiles.ts into .pdfsmoke-test-build/");
  }
  const { previewProfiles } = require(built);
  const base = previewProfiles.classic;
  const experience = [0, 1, 2].flatMap((n) => base.experience.map((e) => ({ ...e, id: `${e.id}-p${n}` })));
  return { ...base, experience, settings: { ...base.settings, templateId: "classic" }, version: SCHEMA_VERSION };
}

/** Instrumentation installed before any app script runs. */
const INIT_SCRIPT = () => {
  const w = window;
  w.__perf = { input: [], paint: [], preview: [], longtasks: [], pdfBlobAt: null, clickAt: null };
  // Long tasks (> 50 ms) — the debounced form→store flush, preview render and
  // score recompute land here, not in the per-keystroke handler.
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.longtasks.push({ at: e.startTime, dur: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* unsupported */
  }
  // React work per keystroke: capture on document fires before React's root
  // listener; a bubble listener on window fires after React has flushed the
  // discrete event's synchronous render.
  let t0 = 0;
  document.addEventListener("input", () => { t0 = performance.now(); }, true);
  window.addEventListener("input", () => {
    const start = t0;
    const sync = performance.now() - start;
    w.__perf.input.push(sync);
    requestAnimationFrame(() => {
      setTimeout(() => w.__perf.paint.push(performance.now() - start), 0);
    });
    w.__perf.__lastInputAt = start;
  }, false);
  // Preview: first DOM mutation inside the rendered CV after each keystroke.
  const mo = new MutationObserver(() => {
    const at = w.__perf.__lastInputAt;
    if (at && !w.__perf.__previewSeen) {
      w.__perf.__previewSeen = true;
      w.__perf.preview.push(performance.now() - at);
    }
  });
  document.addEventListener("input", () => { w.__perf.__previewSeen = false; }, true);
  const arm = () => {
    const root = document.querySelector(".cv-print");
    if (root && root !== w.__perf.__previewRoot) {
      w.__perf.__previewRoot = root;
      mo.disconnect();
      mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
    }
  };
  setInterval(arm, 250);
  // PDF export: the blob exists when the app asks for an object URL for it.
  const orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => {
    if (b && b.type === "application/pdf") w.__perf.pdfBlobAt = performance.now();
    return orig(b);
  };
};

async function loadMetrics(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const nav = performance.getEntriesByType("navigation")[0];
        let lcp = 0;
        const po = new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = e.startTime;
        });
        try {
          po.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          /* unsupported */
        }
        setTimeout(() => {
          po.disconnect();
          const res = performance.getEntriesByType("resource");
          const js = res.filter((r) => /\.js(\?|$)/.test(r.name));
          resolve({
            ttfb: nav ? nav.responseStart : NaN,
            domContentLoaded: nav ? nav.domContentLoadedEventEnd : NaN,
            lcp,
            jsTransferred: js.reduce((s, r) => s + (r.transferSize || 0), 0),
            jsDecoded: js.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
            jsCount: js.length,
            fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? NaN,
          });
        }, 1500);
      }),
  );
}

/** Time (ms since navigation start) until React has attached props to the
 *  first form control on the page (input, textarea or button) — a hydration
 *  proxy that does not depend on typing. The review step has no <input>, so
 *  the probe must accept buttons too. Gives up (NaN) after 30 s. */
async function waitHydrated(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const started = performance.now();
        const tick = () => {
          const els = document.querySelectorAll("input, textarea, button");
          for (const el of els) {
            if (Object.keys(el).some((k) => k.startsWith("__reactProps"))) {
              resolve(performance.now());
              return;
            }
          }
          if (performance.now() - started > 30000) {
            resolve(NaN);
            return;
          }
          setTimeout(tick, 10);
        };
        tick();
      }),
  );
}

async function coldLoad(browser, label, { device, cpu } = {}) {
  const ctx = await browser.newContext({
    ...(device ?? { viewport: { width: 1440, height: 900 } }),
    acceptDownloads: true,
  });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  if (cpu) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  }
  await page.goto(`${BASE}/builder`, { waitUntil: "load" });
  const hydratedAt = await waitHydrated(page);
  const m = await loadMetrics(page);
  record(label, "TTFB", m.ttfb);
  record(label, "FCP", m.fcp);
  record(label, "LCP", m.lcp);
  record(label, "DOMContentLoaded", m.domContentLoaded);
  record(label, "hydrated (React props on first input)", hydratedAt);
  record(label, "JS transferred (KB)", m.jsTransferred / 1024);
  record(label, "JS decoded (KB)", m.jsDecoded / 1024);
  record(label, "JS requests", m.jsCount);

  // First successful Continue: fill the three required fields, one click.
  const t = await page.evaluate(() => performance.now());
  await page.getByLabel(/First name/).fill("Perf");
  await page.getByLabel(/Last name/).fill("Run");
  await page.getByLabel(/Email/).fill("perf.run@example.com");
  const clickAt = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Continue →" }).first().click();
  await page.waitForURL(/step=uaeEssentials/, { timeout: 10000 }).catch(() => {});
  const navDone = await page.evaluate(() => performance.now());
  record(label, "fill 3 fields + Continue → next step", navDone - t);
  record(label, "Continue click → next step", navDone - clickAt);
  return { ctx, page };
}

async function typing(page, label, locator, text) {
  await locator.click();
  await page.waitForTimeout(700); // let any flush from the click/fill settle
  const t0 = await page.evaluate(() => {
    window.__perf.input = [];
    window.__perf.paint = [];
    window.__perf.preview = [];
    window.__perf.longtasks = [];
    return performance.now();
  });
  await page.keyboard.type(text, { delay: 40 });
  await page.waitForTimeout(700);
  const p = await page.evaluate(() => window.__perf);
  const tasks = p.longtasks.filter((t) => t.at >= t0);
  record(label, "keystroke React work (median)", median(p.input));
  record(label, "keystroke React work (p95)", p95(p.input));
  record(label, "input → paint (median)", median(p.paint));
  record(label, "input → paint (p95)", p95(p.paint));
  record(label, "input → paint (max)", Math.max(...p.paint));
  record(label, "long tasks during typing (count)", tasks.length);
  record(label, "long tasks during typing (max ms)", tasks.length ? Math.max(...tasks.map((t) => t.dur)) : 0);
  record(label, "long tasks during typing (total ms)", tasks.reduce((s, t) => s + t.dur, 0));
  record(label, "keystrokes measured", p.input.length);
  if (process.env.DUMP) {
    console.log(`  ${label} — input→paint per keystroke: ${p.paint.map((x) => Math.round(x)).join(" ")}`);
    console.log(`  ${label} — long tasks: ${tasks.map((t) => `${Math.round(t.at - t0)}+${Math.round(t.dur)}`).join(" ") || "none"}`);
  }
  return p;
}

const TEXT_50 = "Operations manager with eight years in UAE logistic"; // 50 chars

async function run() {
  const browser = await launch();
  console.log(`base ${BASE}, ${RUNS} run(s) each\n`);

  for (let i = 0; i < RUNS; i++) {
    if (ONLY.has("load") || ONLY.has("typing") || ONLY.has("preview")) {
      const { ctx, page } = await coldLoad(browser, "desktop cold load /builder");
      if (ONLY.has("typing") || ONLY.has("preview")) {
        await page.goto(`${BASE}/builder?step=personal`, { waitUntil: "load" });
        await waitHydrated(page);
        await page.waitForTimeout(600);
        const first = page.getByLabel(/First name/);
        await first.fill("");
        const p1 = await typing(page, "desktop typing — First name (preview visible)", first, TEXT_50);
        record("desktop preview re-render", "First name: input → .cv-print mutation (median)", median(p1.preview));
        record("desktop preview re-render", "First name: input → .cv-print mutation (p95)", p95(p1.preview));
        record("desktop preview re-render", "preview mutations seen", p1.preview.length);

        await page.goto(`${BASE}/builder?step=summary`, { waitUntil: "load" });
        await waitHydrated(page);
        await page.waitForTimeout(600);
        const summary = page.getByLabel("Professional summary");
        await summary.fill("");
        const p2 = await typing(page, "desktop typing — Summary textarea", summary, TEXT_50);
        record("desktop preview re-render", "Summary: input → .cv-print mutation (median)", median(p2.preview));
      }
      await ctx.close();
    }

    if (ONLY.has("export")) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
      await ctx.addInitScript(INIT_SCRIPT);
      const persona = densePersona();
      await ctx.addInitScript((data) => {
        try {
          window.localStorage.setItem("makemycv:data", JSON.stringify(data));
        } catch {
          /* quota */
        }
      }, persona);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/builder?step=review`, { waitUntil: "load" });
      await waitHydrated(page);
      await page.waitForTimeout(800);
      const sections = [persona.experience.length, persona.education.length, persona.skills.length];
      record("pdf export (dense persona)", "experience / education / skills entries", sections.join("/"));
      for (const pass of ["cold (lazy chunk not cached)", "warm"]) {
        await page.evaluate(() => { window.__perf.pdfBlobAt = null; });
        const clickAt = await page.evaluate(() => performance.now());
        const wall0 = Date.now();
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 90000 }),
          page.getByRole("button", { name: "Download CV as PDF" }).click(),
        ]);
        const wall1 = Date.now();
        const blobAt = await page.evaluate(() => window.__perf.pdfBlobAt);
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mmcv-perf-"));
        const file = path.join(tmp, download.suggestedFilename());
        await download.saveAs(file);
        const size = fs.statSync(file).size;
        fs.rmSync(tmp, { recursive: true, force: true });
        record("pdf export (dense persona)", `${pass}: click → PDF blob`, blobAt ? blobAt - clickAt : NaN);
        record("pdf export (dense persona)", `${pass}: click → download event (wall)`, wall1 - wall0);
        record("pdf export (dense persona)", `${pass}: PDF bytes (KB)`, size / 1024);
        await page.waitForTimeout(500);
      }
      await ctx.close();
    }

    if (ONLY.has("import")) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript(INIT_SCRIPT);
      const page = await ctx.newPage();
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mmcv-perf-import-"));
      const large = path.join(tmp, "large-25mb.pdf");
      fs.writeFileSync(large, makeLargePdf(25 * 1024 * 1024));
      const cases = [
        ["text-cv.pdf", path.resolve("__fixtures__/import/text-cv.pdf"), "review"],
        ["header-contact.docx", path.resolve("__fixtures__/import/header-contact.docx"), "review"],
        ["large-25mb.pdf (gate)", large, "error"],
      ];
      for (const [name, file, expect] of cases) {
        await page.goto(`${BASE}/builder?step=personal`, { waitUntil: "load" });
        await waitHydrated(page);
        await page.waitForTimeout(400);
        let fc = null;
        for (let attempt = 0; attempt < 6 && !fc; attempt++) {
          const chooser = page.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
          await page.getByRole("button", { name: /Import existing CV/ }).click();
          fc = await chooser;
        }
        if (!fc) { record("import", `${name}: chooser`, NaN); continue; }
        const t0 = Date.now();
        await fc.setFiles(file);
        const target = expect === "review"
          ? page.getByRole("dialog", { name: /Import from/ })
          : page.getByTestId("import-error");
        await target.waitFor({ state: "visible", timeout: 90000 }).catch(() => {});
        record("import", `${name}: file chosen → ${expect === "review" ? "MappingReview visible" : "error bar visible"}`, Date.now() - t0);
        if (expect === "review") {
          await target.getByRole("button", { name: /^Cancel$/ }).click().catch(() => {});
        } else {
          await page.getByRole("button", { name: /^Dismiss$/ }).click({ timeout: 1000 }).catch(() => {});
        }
      }
      fs.rmSync(tmp, { recursive: true, force: true });
      await ctx.close();
    }

    if (ONLY.has("checker")) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      // Answer the parse route locally — no key, no spend. The report page
      // itself needs KV and is out of scope here.
      await page.route("**/api/resume-checker/parse", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reportId: "perf-local" }) }),
      );
      const pdf = ["classic.pdf", "classic-long.pdf"].map((f) => path.resolve(".smoke-pdfs", f));
      for (const file of pdf) {
        if (!fs.existsSync(file)) continue;
        await page.goto(`${BASE}/resume-checker`, { waitUntil: "load" });
        await page.waitForTimeout(600);
        const req = page.waitForRequest("**/api/resume-checker/parse", { timeout: 60000 });
        const t0 = Date.now();
        await page.locator("#resume-checker-file").setInputFiles(file);
        const r = await req.catch(() => null);
        const t1 = Date.now();
        const bytes = r ? Buffer.byteLength(r.postData() ?? "") : NaN;
        record("checker", `${path.basename(file)}: file chosen → POST /parse sent (client extraction)`, r ? t1 - t0 : NaN);
        record("checker", `${path.basename(file)}: request body (KB)`, bytes / 1024);
      }
      await ctx.close();
    }

    if (ONLY.has("mobile")) {
      const { ctx, page } = await coldLoad(browser, "mobile cold load /builder (Pixel 7, 4× CPU)", {
        device: devices["Pixel 7"],
        cpu: 4,
      });
      await page.goto(`${BASE}/builder?step=personal`, { waitUntil: "load" });
      await waitHydrated(page);
      await page.waitForTimeout(600);
      const first = page.getByLabel(/First name/);
      await first.fill("");
      await typing(page, "mobile typing — First name (Pixel 7, 4× CPU)", first, TEXT_50);
      await ctx.close();
    }
    console.log(`run ${i + 1}/${RUNS} done`);
  }

  await browser.close();

  console.log("\n| section | metric | median | runs |\n|---|---|---|---|");
  for (const [section, metrics] of Object.entries(results)) {
    for (const [k, v] of Object.entries(metrics)) {
      const nums = v.filter((x) => typeof x === "number");
      const shown = nums.length
        ? fmt(median(nums), /KB/.test(k) ? "KB" : /requests|measured|seen|entries/.test(k) ? "" : "ms")
        : String(v[0]);
      console.log(`| ${section} | ${k} | ${shown} | ${v.map((x) => (typeof x === "number" ? Math.round(x) : x)).join(" / ")} |`);
    }
  }
  fs.mkdirSync(".perf-results", { recursive: true });
  const out = path.join(".perf-results", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(out, JSON.stringify({ base: BASE, runs: RUNS, results }, null, 2));
  console.log(`\nraw: ${out}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
