// CV-import smoke (2026-10-31, import-failure investigation).
//
// Pushes every synthetic document in __fixtures__/import/ (plus a 25 MB PDF
// built in a temp dir) through the REAL builder import — the picker, the
// adapters, MappingReview — in a browser, and prints one row per file:
// what the user saw, and which `cv_import` / `cv_import_failed` push reached
// window.dataLayer with which `error_reason`. Then two network scenarios for
// the pdf.js worker: local worker unreachable (must fall back to the CDN copy
// and import) and everything unreachable (must report worker_load_failed).
// Fails when a file produced no push at all, more than one, or a
// `cv_import_failed` with a reason outside the closed taxonomy
// (lib/importers/importErrors.ts).
//
// Usage:
//   npm run build && npx next start -p 3500        (or `next dev -p 3300`)
//   SMOKE_BASE=http://localhost:3500 npm run smoke:import
//
// Deliberately NOT a `test:*` script (needs a server and a browser) — same
// rule as builder-smoke.mjs. Uses the installed Chrome when present.

import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FIXTURE_DIR, makeLargePdf } from "./make-import-fixtures.mjs";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

// Mirrors IMPORT_ERROR_REASONS in lib/importers/importErrors.ts (file-import
// subset). Kept as a literal so the smoke can run against an older build.
const REASONS = new Set([
  "unsupported_type", "empty_file", "too_large", "encrypted_pdf", "no_text_layer",
  "empty_text", "corrupt_pdf", "corrupt_docx", "worker_load_failed", "timeout",
  "parse_exception", "mapping_empty",
]);

const failures = [];
const ok = (label) => console.log(`PASS  ${label}`);
const fail = (label, detail) => {
  failures.push(label);
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
};

// Expected outcome per fixture: "import" (review opens with ≥1 section and
// confirming pushes cv_import) or a failure reason.
const CASES = [
  ["text-cv.pdf", "import"],
  ["plain-helvetica-cv.pdf", "import"],
  ["header-contact.docx", "import"],
  ["two-column-table.docx", "import"],
  ["rtl-mixed.docx", "import"],
  ["scanned-cv.pdf", "no_text_layer"],
  ["encrypted-cv.pdf", "encrypted_pdf"],
  ["legacy-doc-renamed.docx", "unsupported_type"],
  ["empty.pdf", "empty_file"],
  ["photo-of-cv.jpg", "unsupported_type"],
  // Arabic-only text: the heuristic parser is English-centric, but the Latin
  // email line still maps the Personal section, so the review opens with
  // what WAS found (1 section) rather than a failure. Honest partial import.
  ["arabic-only.pdf", "import"],
  ["not-a-cv.pdf", "mapping_empty"],
  ["large-25mb.pdf", "too_large"],
  // Session 5 production-matrix shapes (2026-10-31): wrapped bullets, Word
  // header + table, Arabic headings, our own Arabic export round-tripped.
  ["s5-long-wrapped.pdf", "import"],
  ["s5-header-table.docx", "import"],
  ["s5-arabic-majority.pdf", "import"],
  ["arabic-export-classic.pdf", "import"],
];

// Experience cards the review must show (D1, 2026-10-31). Both files hold two
// roles whose dates sit on the line under the title; until the fix the review
// showed four cards and this smoke still passed, because it only checked that
// a review opened and one push fired.
const EXPECT_ROLES = {
  "text-cv.pdf": 2,
  "two-column-table.docx": 2,
  "s5-long-wrapped.pdf": 3,
  "s5-header-table.docx": 3,
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mmcv-import-smoke-"));
const largePath = path.join(tmp, "large-25mb.pdf");
fs.writeFileSync(largePath, makeLargePdf(25 * 1024 * 1024));

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`      pageerror: ${e.message.slice(0, 160)}`));
// The consent banner only mounts when the build has NEXT_PUBLIC_GTM_ID; keep
// Google's script off the wire so the smoke stays local when it does.
await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort("blockedbyclient"));

const rows = [];

/** Pick `file` through the real Import button; record what happened. */
async function runCase(name, file, expected) {
  await page.goto(`${BASE}/builder?step=personal`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Import existing CV/ }).waitFor({ timeout: 30000 });
  await page.evaluate(() => { window.dataLayer = []; });

  // The picker is a detached <input> created on click; before hydration the
  // button has no handler yet (seen against `next dev`), so retry the click
  // until the chooser actually opens.
  let fc = null;
  for (let attempt = 0; attempt < 6 && !fc; attempt++) {
    const chooser = page.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
    await page.getByRole("button", { name: /Import existing CV/ }).click();
    fc = await chooser;
  }
  if (!fc) {
    fail(`${name} → ${expected}`, "file chooser never opened");
    rows.push({ name, expected, outcome: "no chooser", message: "", pushes: [] });
    return;
  }
  await fc.setFiles(file);

  const review = page.getByRole("dialog", { name: /Import from/ });
  // BuilderShell's error bar carries data-testid="import-error" (2026-10-31).
  const errorBar = page.getByTestId("import-error");

  let outcome = "nothing happened";
  let message = "";
  const started = Date.now();
  while (Date.now() - started < 90000) {
    if (await review.isVisible().catch(() => false)) {
      const btn = review.getByRole("button", { name: /^Import/ });
      const label = (await btn.textContent())?.trim() ?? "";
      if (await btn.isDisabled()) {
        outcome = "review:empty";
        message = (await review.locator("p").nth(1).textContent())?.trim() ?? "";
        await review.getByRole("button", { name: /^Cancel$/ }).click();
      } else {
        outcome = `review:${label.replace(/^Import\s*/, "")}`;
        if (EXPECT_ROLES[name] !== undefined) {
          const text = (await review.textContent()) ?? "";
          const roles = Number(text.match(/Work experience \((\d+)\)/)?.[1] ?? 0);
          if (roles === EXPECT_ROLES[name]) ok(`${name}: review shows ${roles} experience cards`);
          else fail(`${name}: review shows ${EXPECT_ROLES[name]} experience cards`, `got ${roles}`);
        }
        await btn.click();
        await page.getByText(/Imported \d+ section|Merged \d+ section/).waitFor({ timeout: 10000 }).catch(() => {});
      }
      break;
    }
    if (await errorBar.isVisible().catch(() => false)) {
      outcome = "error";
      message = (await errorBar.textContent())?.trim() ?? "";
      break;
    }
    await page.waitForTimeout(250);
  }

  const pushes = await page.evaluate(() =>
    (window.dataLayer ?? [])
      .filter((e) => e && typeof e.event === "string" && e.event.startsWith("cv_import"))
      .map((e) => ({ event: e.event, file_type: e.file_type, error_reason: e.error_reason, sections_filled: e.sections_filled })),
  );
  rows.push({ name, expected, outcome, message, pushes });

  const label = `${name} → ${expected}`;
  const summary = pushes.map((p) => `${p.event}${p.error_reason ? `(${p.error_reason})` : ""}${p.file_type ? `[${p.file_type}]` : ""}`).join(", ") || "no push";
  if (pushes.length !== 1) {
    fail(label, `${pushes.length} cv_import* pushes (${summary}); outcome=${outcome}`);
  } else if (expected === "import") {
    if (pushes[0].event === "cv_import" && outcome.startsWith("review:") && outcome !== "review:empty") ok(`${label} — ${outcome}`);
    else fail(label, `outcome=${outcome}; ${summary}`);
  } else if (pushes[0].event === "cv_import_failed" && pushes[0].error_reason === expected && REASONS.has(expected)) {
    ok(`${label} — "${message.slice(0, 90)}"`);
  } else {
    fail(label, `outcome=${outcome}; ${summary}; message="${message.slice(0, 90)}"`);
  }
  // Dismiss any error bar so it cannot be mistaken for the next case's.
  await page.getByRole("button", { name: /^Dismiss$/ }).click({ timeout: 1000 }).catch(() => {});
}

for (const [name, expected] of CASES) {
  await runCase(name, name === "large-25mb.pdf" ? largePath : path.join(FIXTURE_DIR, name), expected);
}

// ── Consent banner vs the Import button (backlog E9) ───────────────────────
// Found on production 2026-10-31: the cookie banner (z-index 1000, fixed at
// the bottom) covered MappingReview's Import button at 1440×900 and at
// 1366×768 until the visitor answered it (1920×1080 was clear). Each size
// gets a FRESH context with NO mmcv_consent cookie, opens the review for
// text-cv.pdf and asks the browser what actually sits at the button's
// centre. The banner only renders when the build has NEXT_PUBLIC_GTM_ID;
// without it the hit test still runs but cannot exercise the overlap, and
// the run says so.
const CONSENT_VIEWPORTS = [
  [1366, 768],
  [1440, 900],
];

/** Open the builder, pick `file` through the real Import button and wait for
 *  the review dialog. Returns the dialog locator, or null. */
async function openReview(pg, file) {
  await pg.goto(`${BASE}/builder?step=personal`, { waitUntil: "domcontentloaded" });
  await pg.getByRole("button", { name: /Import existing CV/ }).waitFor({ timeout: 30000 });
  let fc = null;
  for (let attempt = 0; attempt < 6 && !fc; attempt++) {
    const chooser = pg.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
    await pg.getByRole("button", { name: /Import existing CV/ }).click();
    fc = await chooser;
  }
  if (!fc) return null;
  await fc.setFiles(file);
  const review = pg.getByRole("dialog", { name: /Import from/ });
  return (await review.waitFor({ timeout: 60000 }).then(() => true).catch(() => false)) ? review : null;
}

let bannerEverSeen = false;
async function checkConsentOverlap(width, height) {
  const label = `consent-overlap ${width}×${height}`;
  const c = await browser.newContext({ viewport: { width, height } });
  const pg = await c.newPage();
  await pg.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort("blockedbyclient"));
  try {
    if ((await c.cookies()).some((k) => k.name === "mmcv_consent")) {
      fail(label, "fresh context already carries mmcv_consent");
      return;
    }
    const banner = pg.getByRole("region", { name: "Cookie settings" });
    await pg.goto(`${BASE}/builder?step=personal`, { waitUntil: "domcontentloaded" });
    await pg.getByRole("button", { name: /Import existing CV/ }).waitFor({ timeout: 30000 });
    // Client-only render; give hydration a beat before concluding it is absent.
    await pg.waitForTimeout(800);
    const bannerUp = await banner.isVisible().catch(() => false);
    bannerEverSeen ||= bannerUp;
    // openReview() navigates again; the banner stays up (no cookie was set).
    const review = await openReview(pg, path.join(FIXTURE_DIR, "text-cv.pdf"));
    if (!review) {
      fail(label, "the import review never opened");
      return;
    }
    const btn = review.getByRole("button", { name: /^Import/ });
    const box = await btn.boundingBox();
    if (!box) {
      fail(label, "Import button has no box");
      return;
    }
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    const hit = await pg.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px, py);
        const button = el?.closest("button");
        return {
          isImport: !!button && /^Import/.test(button.textContent?.trim() ?? ""),
          under: el ? `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[aria-label=${el.getAttribute("aria-label")}]` : ""}` : "null",
          inBanner: !!el?.closest('[role="region"][aria-label="Cookie settings"]'),
        };
      },
      [x, y],
    );
    const where = `button centre (${Math.round(x)}, ${Math.round(y)})`;
    if (!hit.isImport) {
      fail(label, `${where} is ${hit.under}${hit.inBanner ? " (inside the cookie banner)" : ""}`);
      return;
    }
    // The banner must come back once the dialog closes — it yields, it is not dismissed.
    await review.getByRole("button", { name: /^Cancel$/ }).click();
    const back = bannerUp ? await banner.isVisible({ timeout: 3000 }).catch(() => false) : null;
    if (bannerUp && !back) {
      fail(label, "the banner did not return after the dialog closed");
      return;
    }
    ok(`${label}: Import button is the element at its own centre — ${where}; banner ${bannerUp ? "was up, hidden while the dialog was open, back after Cancel" : "not rendered by this build (no NEXT_PUBLIC_GTM_ID)"}`);
  } finally {
    await c.close();
  }
}

// ── Import after typing on the Personal step (production QA P1) ───────────
// 2026-10-31: typing on the Personal step, then importing, left the form on
// the typed values while the store and preview showed the import; the next
// keystroke wrote the stale name / email back over the import and it
// survived a reload. The step now re-syncs whenever the store changes from
// outside the form. Fresh context; reads the persisted CV, not the DOM.
async function checkImportAfterTyping() {
  const label = "import after typing (P1): imported personal fields survive the next keystroke";
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await c.newPage();
  await pg.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort("blockedbyclient"));
  try {
    await pg.goto(`${BASE}/builder?step=personal`, { waitUntil: "domcontentloaded" });
    await pg.getByLabel(/First name/).waitFor({ timeout: 30000 });
    await pg.getByLabel(/First name/).fill("Placeholder");
    await pg.waitForTimeout(900); // form debounce (250 ms) + storage debounce (500 ms)

    // Same page, no navigation: openReview() would reload, so pick in place.
    let fc = null;
    for (let attempt = 0; attempt < 6 && !fc; attempt++) {
      const chooser = pg.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
      await pg.getByRole("button", { name: /Import existing CV/ }).click();
      fc = await chooser;
    }
    if (!fc) {
      fail(label, "file chooser never opened");
      return;
    }
    await fc.setFiles(path.join(FIXTURE_DIR, "text-cv.pdf"));
    const review = pg.getByRole("dialog", { name: /Import from/ });
    if (!(await review.waitFor({ timeout: 60000 }).then(() => true).catch(() => false))) {
      fail(label, "the import review never opened");
      return;
    }
    await review.getByRole("radio", { name: /Replace current CV/ }).check().catch(() => {});
    await review.getByRole("button", { name: /^Import/ }).click();
    await review.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});

    const formFirst = await pg.getByLabel(/First name/).inputValue().catch(() => "");
    if (formFirst === "Layla") ok("import after typing (P1): the form shows the imported first name");
    else fail("import after typing (P1): the form shows the imported first name", `First name field is "${formFirst}"`);

    // One keystroke in another field, then let both debounces run.
    const phone = pg.getByLabel(/^Phone/);
    await phone.click();
    await phone.press("End");
    await phone.pressSequentially("1");
    await pg.waitForTimeout(1200);

    const stored = await pg.evaluate(() => {
      try {
        const raw = JSON.parse(window.localStorage.getItem("makemycv:data") ?? "null");
        const p = raw?.personal ?? raw?.data?.personal ?? {};
        return { firstName: p.firstName ?? "", lastName: p.lastName ?? "", email: p.email ?? "", phone: p.phone ?? "" };
      } catch {
        return null;
      }
    });
    if (
      stored &&
      stored.firstName === "Layla" &&
      stored.lastName === "Haddad" &&
      stored.email === "layla.haddad@example.com" &&
      stored.phone.endsWith("1")
    ) {
      ok(`${label} — stored ${JSON.stringify(stored)}`);
    } else {
      fail(label, `stored ${JSON.stringify(stored)}`);
    }
  } finally {
    await c.close();
  }
}

for (const [w, h] of CONSENT_VIEWPORTS) await checkConsentOverlap(w, h);
await checkImportAfterTyping();

// ── pdf.js worker network scenarios ────────────────────────────────────────
// The worker choice is cached per page lifetime and runCase() navigates, so
// each scenario starts from a fresh document.
const textPdf = path.join(FIXTURE_DIR, "text-cv.pdf");

// 1. Self-hosted worker unreachable → the CDN copy must be used (an import).
//    Needs internet; when cdnjs itself cannot be reached from this machine
//    the scenario is reported as inconclusive, not failed.
await page.route("**/pdf.worker.min.mjs", (route) =>
  route.request().url().startsWith(BASE) ? route.abort("failed") : route.continue(),
);
{
  const before = failures.length;
  await runCase("worker-local-404 (text-cv.pdf)", textPdf, "import");
  const row = rows[rows.length - 1];
  if (failures.length > before && row.pushes[0]?.error_reason === "worker_load_failed") {
    failures.pop();
    console.log("INFO  worker-local-404: CDN copy unreachable from this machine — inconclusive, not failed");
  }
}
await page.unroute("**/pdf.worker.min.mjs");

// 2. Nothing reachable → one cv_import_failed with worker_load_failed.
await page.route("**/pdf.worker.min.mjs", (route) => route.abort("failed"));
await runCase("worker-offline (text-cv.pdf)", textPdf, "worker_load_failed");
await page.unroute("**/pdf.worker.min.mjs");

console.log("\nMATRIX");
for (const r of rows) {
  console.log(
    `  ${r.name.padEnd(30)} expect=${r.expected.padEnd(18)} outcome=${r.outcome.padEnd(22)} pushes=${JSON.stringify(r.pushes)}` +
      (r.message ? `\n  ${"".padEnd(30)} message="${r.message}"` : ""),
  );
}

if (!bannerEverSeen) console.log("INFO  consent-overlap: the banner was never visible in this run — the hit tests passed, but to exercise the overlap build with NEXT_PUBLIC_GTM_ID set (e.g. GTM-SMOKE01)");

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures.length ? `\nimport-smoke: ${failures.length} FAILED` : "\nimport-smoke: all cases passed");
process.exit(failures.length ? 1 : 0);
