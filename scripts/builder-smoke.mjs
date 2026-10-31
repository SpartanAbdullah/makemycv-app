// Builder smoke (2026-10-24, audit WP-3).
//
// Drives the real builder in a browser against a PRODUCTION build and fails
// if any single click on Continue does not advance the step, or if the PDF
// export produces nothing. It exists because the lost-first-click defect
// (audit F01: a helper line inserted on blur moved Continue out from under
// the pointer) was invisible to every unit test and to `smoke:pdf`.
//
// Usage:
//   npm run build && npx next start -p 3000      (in one terminal)
//   npm run smoke:builder                        (in another)
//   SMOKE_BASE=http://localhost:3000 node scripts/builder-smoke.mjs
//
// Deliberately NOT a `test:*` script: scripts/run-all-tests.mjs would pick it
// up and `npm test` must stay runnable without a server or a browser. Uses
// the installed Google Chrome when present (no `playwright install` needed on
// a dev machine), falling back to Playwright's bundled Chromium.

import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const failures = [];
const ok = (label) => console.log(`PASS  ${label}`);
const fail = (label, detail) => {
  failures.push(label);
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
};

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

// Click `name` ONCE, with a form field still focused (the exact condition that
// lost the click), and require the URL to change within 5 s.
async function continueOnce(page, name, expectStep) {
  await page.getByRole("button", { name }).first().click();
  try {
    await page.waitForURL(new RegExp(`step=${expectStep}`), { timeout: 5000 });
    ok(`single click "${typeof name === "string" ? name : name.source}" → ${expectStep}`);
  } catch {
    fail(`single click "${typeof name === "string" ? name : name.source}" → ${expectStep}`, `still at ${page.url()}`);
    await page.goto(`${BASE}/builder?step=${expectStep}`, { waitUntil: "domcontentloaded" });
  }
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
// window.dataLayer is per-document, and this journey reloads the page on
// purpose (persistence check). Mirror every event name into sessionStorage
// before any app script runs, so the funnel assertion at the end sees the
// whole session, not just the last document.
await ctx.addInitScript(() => {
  const arr = [];
  const orig = arr.push.bind(arr);
  arr.push = (...items) => {
    try {
      const key = "__smoke_events";
      const seen = JSON.parse(window.sessionStorage.getItem(key) || "[]");
      for (const it of items) if (it && it.event) seen.push(it.event);
      window.sessionStorage.setItem(key, JSON.stringify(seen));
    } catch {
      /* storage unavailable — the in-memory array still works */
    }
    return orig(...items);
  };
  window.dataLayer = arr;
});
const page = await ctx.newPage();
page.on("pageerror", (e) => fail("page error", String(e).slice(0, 160)));

await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);

// Export gate on an empty CV
await page.getByRole("button", { name: "Download", exact: true }).click();
const gate = page.getByRole("dialog");
if (await gate.isVisible()) ok("export gate opens on an empty CV");
else fail("export gate opens on an empty CV");
await page.keyboard.press("Escape");

// Personal — leave focus in the last field, then one click
await page.getByLabel(/First name/).fill("Smoke");
await page.getByLabel(/Last name/).fill("Test");
await page.getByLabel(/Email/).fill("smoke.test@example.com");
await continueOnce(page, "Continue →", "uaeEssentials");

// Persistence (2026-10-31): the debounced localStorage save must survive a
// reload. A CV that vanishes on refresh is the single worst builder defect
// and nothing else in the pipeline exercises it.
await page.waitForTimeout(900);
await page.goto(`${BASE}/builder?step=personal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const persistedFirst = await page.getByLabel(/First name/).inputValue().catch(() => "");
if (persistedFirst === "Smoke") ok("CV persists across a reload");
else fail("CV persists across a reload", `first name is "${persistedFirst}"`);

// Template cycling from the preview column, then the fullscreen preview —
// both must fire their funnel events (template_selected, cv_preview_viewed).
// dispatchEvent rather than click: the drawer controls sit below the fold of
// the preview column at 1440×900 and Playwright refuses to click off-screen.
await page.getByRole("button", { name: "Next template" }).first().dispatchEvent("click");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Fullscreen" }).first().dispatchEvent("click");
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.goto(`${BASE}/builder?step=uaeEssentials`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);

await page.getByLabel("Visa status").selectOption({ label: "Employment visa" });
await continueOnce(page, "Continue →", "summary");

// Summary SHORT on purpose (<30 words) so the length warning is in play
await page.getByLabel("Professional summary").fill("Operations manager with eight years in UAE logistics, leading teams and cutting costs.");
await continueOnce(page, "Continue →", "experience");

await page.getByLabel("Job title").fill("Operations Manager");
await page.getByLabel("Company").fill("Example LLC");
await page.getByLabel("Start", { exact: true }).fill("Jan 2021");
await page.locator('input[name="experience.0.isCurrent"]').check();
await page.getByLabel("Achievement 1").fill("Reduced delivery lead time by 18% across 3 warehouses.");
await continueOnce(page, /Continue to Education/, "education");

await page.getByRole("textbox", { name: "Degree / Qualification" }).fill("BBA");
await page.getByRole("textbox", { name: "School / University" }).fill("Example University");
await page.getByLabel("Start year").fill("2012");
await continueOnce(page, /Continue to Skills/, "skills");

const skillBox = page.getByLabel("Search skills, or describe what you do");
await skillBox.fill("Fleet management");
await skillBox.press("Enter");
// E7 (QA D4): Enter adds what was TYPED. Before the fix it added the first
// suggestion instead — a silent substitution of a competency claim.
{
  const typedChip = page.getByRole("button", { name: "Remove Fleet management", exact: true });
  if (await typedChip.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) {
    ok('Skills: Enter adds the typed "Fleet management" as written');
  } else {
    const chips = await page.getByRole("button", { name: /^Remove / }).allTextContents().catch(() => []);
    fail('Skills: Enter adds the typed "Fleet management" as written', `chips: ${JSON.stringify(chips)}`);
  }
}
// …and a suggestion is taken only when the arrow keys highlighted it.
{
  await skillBox.fill("excel");
  const firstOption = page.getByRole("option").first();
  const present = await firstOption.waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
  const optionName = present ? ((await firstOption.locator("span").first().textContent()) ?? "").trim() : "";
  if (!optionName) {
    console.log('INFO  Skills: no suggestion for "excel" in this build — arrow-key check skipped');
    await skillBox.fill("");
  } else {
    await skillBox.press("ArrowDown");
    const selected = await firstOption.getAttribute("aria-selected");
    await skillBox.press("Enter");
    const pickedChip = page.getByRole("button", { name: `Remove ${optionName}`, exact: true });
    const added = await pickedChip.waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
    if (selected === "true" && added) ok(`Skills: ArrowDown + Enter adds the highlighted suggestion "${optionName}"`);
    else fail(`Skills: ArrowDown + Enter adds the highlighted suggestion "${optionName}"`, `aria-selected=${selected}, chip added=${added}`);
  }
}
await continueOnce(page, "Continue →", "languages");
await continueOnce(page, "Continue →", "certifications");
await continueOnce(page, "Skip for now", "projects");
await continueOnce(page, "Skip for now", "review");

// Review: no amber warning for optional sections on a complete CV
await page.waitForTimeout(500);
const amberBox = page.locator("text=Missing sections").locator("..");
const amber = await amberBox.count();
if (amber === 0) ok("review shows no MISSING SECTIONS box for a complete CV");
else fail("review shows no MISSING SECTIONS box for a complete CV", (await amberBox.first().innerText()).replace(/\s+/g, " "));

// PDF export produces a file
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mmcv-smoke-"));
try {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Download CV as PDF" }).click(),
  ]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  const size = fs.statSync(file).size;
  if (size > 1000) ok(`PDF export (${size} bytes)`);
  else fail("PDF export", `${size} bytes`);
} catch (e) {
  fail("PDF export", String(e).slice(0, 160));
}

// DOCX export produces a file too (second export path, own renderer).
try {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Export .docx" }).click(),
  ]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  const size = fs.statSync(file).size;
  if (size > 1000 && /\.docx$/i.test(file)) ok(`DOCX export (${size} bytes)`);
  else fail("DOCX export", `${size} bytes, ${path.basename(file)}`);
} catch (e) {
  fail("DOCX export", String(e).slice(0, 160));
}

// Funnel events (2026-10-31): every push lands in window.dataLayer whether or
// not GTM is present, so the events can be asserted without a container.
// Persisted sessionStorage keys make the once-per-session events survive the
// reload above; the list below is what one complete journey must emit.
const dl = await page.evaluate(() => {
  let seen = [];
  try {
    seen = JSON.parse(window.sessionStorage.getItem("__smoke_events") || "[]");
  } catch {
    /* fall through to the live array */
  }
  return seen.concat((window.dataLayer || []).filter((e) => e && e.event).map((e) => e.event));
});
for (const name of [
  "builder_step",
  "builder_start",
  "template_selected",
  "cv_preview_viewed",
  "cv_section_completed",
  "cv_export_started",
  "cv_export",
]) {
  if (dl.includes(name)) ok(`dataLayer has ${name}`);
  else fail(`dataLayer has ${name}`, `events seen: ${[...new Set(dl)].join(", ")}`);
}

// At most two toasts visible at once
const toasts = await page.locator('[role="status"]').count();
if (toasts <= 3) ok(`toast cap (${toasts} status regions incl. support card)`);
else fail("toast cap", `${toasts} visible`);

// Accessibility: axe-core (already in node_modules) on the pages a job seeker
// actually lands on. Serious/critical violations fail the run (audit WP-7).
const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
const axePages = [
  ["/builder", "builder · personal"],
  ["/builder?step=experience", "builder · experience"],
  ["/builder?step=review", "builder · review"],
  ["/resume-checker", "checker upload"],
  ["/jd-match", "jd match"],
];
for (const [p, label] of axePages) {
  await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    // [inert] = the template-gallery thumbnails: scaled renders of the CV
      // document itself, decorative here. Their colours belong to the CV
      // templates (deliberately untouched), not to the app chrome under test.
      // .cv-print = the rendered CV document itself (live preview column,
      // JD Match preview). Its colours are a template design decision kept
      // out of a11y fixes (CLAUDE.md), the same rule as the thumbnails.
      const r = await window.axe.run({ exclude: [["[inert]"], [".cv-print"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, target: v.nodes[0]?.target?.[0] ?? "" }));
  });
  const serious = result.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length === 0) ok(`axe ${label}: no serious/critical violations (${result.length} minor)`);
  else fail(`axe ${label}`, serious.map((v) => `${v.id}[${v.impact}] ×${v.n} ${v.target}`).join("; "));
}

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nbuilder smoke: all checks passed");
