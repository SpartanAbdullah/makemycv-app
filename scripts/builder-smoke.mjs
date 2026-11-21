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
// Monitor mode (SMOKE_BLOCK_ANALYTICS=1, set by .github/workflows/prod-monitor.yml
// when this runs against production): Google's tags and Vercel Speed Insights
// never leave the browser, so a synthetic journey cannot reach GA4. The
// dataLayer assertions below still pass — pushes land in window.dataLayer
// whether or not GTM loads. Unset (the default), nothing changes locally.
if (process.env.SMOKE_BLOCK_ANALYTICS === "1") {
  await ctx.route(
    /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|vercel-insights\.com/,
    (route) => route.abort("blockedbyclient"),
  );
}
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
  // Audit 2026-11 E4: one naming rule for every export.
  if (path.basename(file) === "CV_Smoke_Test.pdf") ok("PDF is named CV_Smoke_Test.pdf");
  else fail("PDF is named CV_Smoke_Test.pdf", path.basename(file));
} catch (e) {
  fail("PDF export", String(e).slice(0, 160));
}

// Audit 2026-11 Q12 (owner decision 2026-11-21): the FIRST export's card
// offers the next step — match the CV to a job, write the cover letter — and
// asks for nothing. This is the first export of a fresh browser context.
{
  const row = page.locator("[data-download-support-card] [data-next-step-row]");
  const shown = await row.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
  const links = shown ? await row.getByRole("link").allTextContents() : [];
  if (shown && links.includes("Match this CV to the job ad") && links.includes("Write the cover letter")) {
    ok("first export: the card shows the next step (JD Match, cover letter)");
  } else {
    fail("first export: the card shows the next step", `shown=${shown}, links=${JSON.stringify(links)}`);
  }
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
  if (path.basename(file) === "CV_Smoke_Test.docx") ok("Word file is named CV_Smoke_Test.docx");
  else fail("Word file is named CV_Smoke_Test.docx", path.basename(file));
} catch (e) {
  fail("DOCX export", String(e).slice(0, 160));
}

// …and the second export moves on: the next-step row gives way to an ask
// (email or stars where switched on, the follow row otherwise).
{
  await page.waitForTimeout(400);
  const card = page.locator("[data-download-support-card]");
  const cardShown = await card.isVisible().catch(() => false);
  const nextRows = await card.locator("[data-next-step-row]").count();
  if (cardShown && nextRows === 0) ok("second export: the card moves on from the next-step row");
  else fail("second export: the card moves on from the next-step row", `card=${cardShown}, next rows=${nextRows}`);
}

// Audit 2026-11 E1: "Download PDF" inside the template preview must export the
// template being PREVIEWED. It used to export the one selected before, because
// the download read the CV from a render that predated the template change.
// The file itself does not say which layout drew it, so the check reads the
// template the export reported — the same value the renderer was handed.
try {
  const before = await page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem("makemycv:data") || "{}").settings?.templateId ?? "classic";
    } catch {
      return "classic";
    }
  });
  const [wantId, wantName] = before === "ats-clean" ? ["classic", "Classic"] : ["ats-clean", "ATS Clean"];
  await page.getByRole("button", { name: `Open ${wantName} full preview` }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Download PDF", exact: true }).click(),
  ]);
  await download.saveAs(path.join(tmp, `preview-${download.suggestedFilename()}`));
  const exported = await page.evaluate(() => {
    const evs = (window.dataLayer || []).filter((e) => e && e.event === "cv_export");
    return evs.length ? evs[evs.length - 1].template : null;
  });
  if (exported === wantId) ok(`preview "Download PDF" exports the previewed template (${wantId}; ${before} was selected)`);
  else fail('preview "Download PDF" exports the previewed template', `previewed ${wantId}, exported ${exported}, ${before} was selected`);
} catch (e) {
  fail('preview "Download PDF" exports the previewed template', String(e).slice(0, 160));
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

// ── Audit 2026-11, batch B ────────────────────────────────────────────────
const storedTemplate = () =>
  page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem("makemycv:data") || "{}").settings?.templateId ?? "classic";
    } catch {
      return "classic";
    }
  });

// Q3/Q4: the marketing site's "Use this template" links arrive as
// /?template=<id>. The root redirect must keep the query, the builder must
// select the template and then drop the parameter (so a reload or a later
// template change is not overridden by a stale URL).
try {
  // A date of birth first, so the notice below has something to report.
  await page.goto(`${BASE}/builder?step=uaeEssentials`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const dob = page.getByLabel("Date of birth");
  if (!(await dob.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /Extras/ }).first().click();
  }
  await dob.fill("12/03/1994");
  await page.getByLabel("Visa status").focus();
  await page.waitForTimeout(1200); // debounced form → store → localStorage

  await page.goto(`${BASE}/?template=harvard&step=review`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const u = new URL(page.url());
  const tpl = await storedTemplate();
  if (u.pathname === "/builder" && !u.searchParams.has("template") && u.searchParams.get("step") === "review" && tpl === "harvard") {
    ok("/?template=harvard&step=review → builder, Harvard selected, parameter dropped, step kept");
  } else {
    fail("template deep link", `url=${page.url()}, stored template=${tpl}`);
  }

  // Q11: Harvard prints neither a photo nor a date of birth — say so, once,
  // where the template is chosen. And it prints black only, so the colour
  // swatches give way to one line.
  const note = page.getByTestId("template-omission-note");
  const noteText = (await note.first().textContent().catch(() => "")) ?? "";
  if (/Harvard template does not print your date of birth/.test(noteText)) ok("Review names what Harvard leaves out (date of birth)");
  else fail("Review names what Harvard leaves out", `note: "${noteText}"`);
  if (await page.getByTestId("colours-fixed-note").isVisible().catch(() => false)) ok("Design panel explains Harvard's fixed colours instead of dead swatches");
  else fail("Design panel explains Harvard's fixed colours");

  await page.goto(`${BASE}/builder?template=executive&step=review`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const quiet =
    (await page.getByTestId("template-omission-note").count()) === 0 &&
    (await page.getByTestId("colours-fixed-note").count()) === 0;
  if ((await storedTemplate()) === "executive" && quiet) ok("Executive prints everything: no notice, colour swatches back");
  else fail("Executive prints everything", `stored=${await storedTemplate()}, quiet=${quiet}`);

  // An id that is not a template changes nothing and still leaves the URL clean.
  await page.goto(`${BASE}/builder?template=not-a-template&step=review`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  if ((await storedTemplate()) === "executive" && !new URL(page.url()).searchParams.has("template")) ok("an unknown ?template= is ignored and dropped");
  else fail("an unknown ?template= is ignored and dropped", `stored=${await storedTemplate()}, url=${page.url()}`);

  await page.goto(`${BASE}/builder?template=classic&step=review`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  if (await page.getByTestId("colours-fixed-note").isVisible().catch(() => false)) ok("Classic: colour control replaced by the fixed-colours line");
  else fail("Classic: colour control replaced by the fixed-colours line");
} catch (e) {
  fail("template deep link / template notices", String(e).slice(0, 200));
}

// Q4: "Already have a CV? Upload it" on the site lands on /builder?import=1 —
// the import button takes focus, says what to do, and the parameter goes.
try {
  await page.goto(`${BASE}/builder?import=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const focused = await page.evaluate(() => (document.activeElement?.textContent ?? "").replace(/\s+/g, " ").trim());
  const clean = !new URL(page.url()).searchParams.has("import");
  if (/Choose your CV file to import/.test(focused) && clean) ok("?import=1 puts the keyboard on the import button and drops the parameter");
  else fail("?import=1 invites the import", `focused="${focused.slice(0, 60)}", url=${page.url()}`);
} catch (e) {
  fail("?import=1 invites the import", String(e).slice(0, 200));
}

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

// Q15 / O7: "Start a new CV". Last on purpose — it clears the CV this run
// built. The dialog must open with the keyboard on Cancel, offer the backup
// first, and leave nothing of the old CV behind.
try {
  await page.goto(`${BASE}/builder?step=review`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.getByTestId("start-over").click();
  const dialog = page.getByRole("dialog", { name: "Start a new CV?" });
  await dialog.waitFor({ timeout: 4000 });
  const focused = await page.evaluate(() => (document.activeElement?.textContent ?? "").trim());
  if (focused === "Cancel") ok("Start over: the dialog opens with the keyboard on Cancel");
  else fail("Start over: the dialog opens with the keyboard on Cancel", `focus on "${focused}"`);

  const [backup] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    dialog.getByRole("button", { name: "Download a backup first" }).click(),
  ]);
  const backupFile = path.join(tmp, backup.suggestedFilename());
  await backup.saveAs(backupFile);
  const backupText = fs.readFileSync(backupFile, "utf8");
  if (path.basename(backupFile) === "CV_Smoke_Test.json" && backupText.includes("Smoke")) ok("Start over: the backup downloads first (CV_Smoke_Test.json)");
  else fail("Start over: the backup downloads first", path.basename(backupFile));

  await dialog.getByRole("button", { name: "Clear this CV and start new" }).click();
  await page.waitForURL(/step=personal/, { timeout: 5000 });
  await page.waitForTimeout(1200);
  const firstName = await page.getByLabel(/First name/).inputValue().catch(() => "?");
  const stored = await page.evaluate(() => window.localStorage.getItem("makemycv:data") ?? "");
  if (firstName === "" && !stored.includes("Smoke") && !stored.includes("smoke.test@example.com")) {
    ok("Start over: the builder and the browser's saved copy are both empty");
  } else {
    fail("Start over clears the CV", `first name "${firstName}", stored copy still has it: ${stored.includes("Smoke")}`);
  }
} catch (e) {
  fail("Start over", String(e).slice(0, 200));
}

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nbuilder smoke: all checks passed");
