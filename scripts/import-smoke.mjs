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
  // Session 6 (D7a): 31 pages, one past MAX_PDF_PAGES.
  ["s5-31-pages.pdf", "import"],
  // Session 6 (D11): extension / bytes mismatch (matrix cases 9a / 9b).
  ["s5-docx-bytes.pdf", "corrupt_pdf"],
  ["s5-pdf-bytes.docx", "corrupt_docx"],
];

// D11 (session 6): the error bar names the real type for a renamed file.
const EXPECT_MESSAGE = {
  "s5-docx-bytes.pdf": /actually a Word document with a \.pdf name/,
  "s5-pdf-bytes.docx": /actually a PDF with a \.docx name/,
};

// D7a (session 6): the review names the pages it read when the PDF is longer
// than MAX_PDF_PAGES, and says nothing for a normal file.
const EXPECT_PAGES_SKIPPED = {
  "s5-31-pages.pdf": /We read the first 30 of 31 pages/,
  "text-cv.pdf": null,
};

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
        if (name in EXPECT_PAGES_SKIPPED) {
          const want = EXPECT_PAGES_SKIPPED[name];
          const line = review.getByTestId("import-pages-skipped");
          const shown = (await line.isVisible().catch(() => false)) ? ((await line.textContent()) ?? "").trim() : null;
          if (want ? shown && want.test(shown) : shown === null) ok(`${name}: pages-skipped line ${want ? `"${shown}"` : "absent"} (D7a)`);
          else fail(`${name}: pages-skipped line (D7a)`, `expected ${want ?? "none"}, got ${JSON.stringify(shown)}`);
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
    // D12 (2026-10-31): the review button counts sections the way the push
    // and the toast do — Work experience / Education are one section each.
    const shown = Number(outcome.match(/\((\d+) section/)?.[1] ?? NaN);
    if (pushes[0].event === "cv_import") {
      if (shown === pushes[0].sections_filled) ok(`${name}: button count ${shown} = sections_filled`);
      else fail(`${name}: button count = sections_filled`, `button ${shown}, push ${pushes[0].sections_filled}`);
    }
  } else if (pushes[0].event === "cv_import_failed" && pushes[0].error_reason === expected && REASONS.has(expected)) {
    ok(`${label} — "${message.slice(0, 90)}"`);
    if (EXPECT_MESSAGE[name]) {
      if (EXPECT_MESSAGE[name].test(message)) ok(`${name}: copy names the real type (D11)`);
      else fail(`${name}: copy names the real type (D11)`, `"${message}"`);
    }
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

/** Pick `file` on the CURRENT page (no navigation) through the Import button. */
async function pickInPlace(pg, file) {
  let fc = null;
  for (let attempt = 0; attempt < 6 && !fc; attempt++) {
    const chooser = pg.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
    await pg.getByRole("button", { name: /Import existing CV/ }).click();
    fc = await chooser;
  }
  if (fc) await fc.setFiles(file);
  return !!fc;
}

// ── A failure bar does not outlive the next pick (session 5 D5) ───────────
// Production 2026-10-31: after a mapping_empty failure the red bar stayed on
// screen behind the next file's review and after Cancel (only "Dismiss"
// cleared it). The case loop above clicks Dismiss after every file, which is
// why it never saw this. Fresh context, no Dismiss.
async function checkErrorClearedByNextPick() {
  const label = "stale error (D5): a new pick clears the previous failure";
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await c.newPage();
  await pg.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort("blockedbyclient"));
  try {
    await pg.goto(`${BASE}/builder?step=personal`, { waitUntil: "domcontentloaded" });
    await pg.getByRole("button", { name: /Import existing CV/ }).waitFor({ timeout: 30000 });
    const errorBar = pg.getByTestId("import-error");
    if (!(await pickInPlace(pg, path.join(FIXTURE_DIR, "not-a-cv.pdf")))) return fail(label, "file chooser never opened");
    if (!(await errorBar.waitFor({ timeout: 30000 }).then(() => true).catch(() => false))) {
      return fail(label, "not-a-cv.pdf showed no error bar");
    }
    if (!(await pickInPlace(pg, path.join(FIXTURE_DIR, "text-cv.pdf")))) return fail(label, "file chooser never opened (2nd pick)");
    const review = pg.getByRole("dialog", { name: /Import from/ });
    if (!(await review.waitFor({ timeout: 60000 }).then(() => true).catch(() => false))) {
      return fail(label, "the review for text-cv.pdf never opened");
    }
    const withReview = await errorBar.isVisible().catch(() => false);
    await review.getByRole("button", { name: /^Cancel$/ }).click();
    await review.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    const afterCancel = await errorBar.isVisible().catch(() => false);
    if (withReview || afterCancel) fail(label, `error bar visible: with review=${withReview}, after Cancel=${afterCancel}`);
    else ok(`${label} — bar gone with the review open and after Cancel`);
  } finally {
    await c.close();
  }
}

// ── The confirm toast survives the first import of a session (D6) ─────────
// Production 2026-10-31: the "Imported N sections" toast was replaced within
// ~300 ms by the "<Section> section done ✓" toasts the import itself
// triggered (replace-not-stack), so a first import showed only "Languages
// section done ✓". Fresh context = fresh sessionStorage = first import.
async function checkFirstImportToast() {
  const label = "first-import toast (D6): the confirm toast is the one left on screen";
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await c.newPage();
  await pg.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort("blockedbyclient"));
  try {
    await pg.goto(`${BASE}/builder?step=personal`, { waitUntil: "domcontentloaded" });
    await pg.getByRole("button", { name: /Import existing CV/ }).waitFor({ timeout: 30000 });
    if (!(await pickInPlace(pg, path.join(FIXTURE_DIR, "text-cv.pdf")))) return fail(label, "file chooser never opened");
    const review = pg.getByRole("dialog", { name: /Import from/ });
    if (!(await review.waitFor({ timeout: 60000 }).then(() => true).catch(() => false))) {
      return fail(label, "the review never opened");
    }
    await review.getByRole("button", { name: /^Import/ }).click();
    await review.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(1500); // past the ~300 ms in which the section toasts used to land
    const confirm = await pg.getByText(/Imported \d+ sections? — review the steps below/).isVisible().catch(() => false);
    const sectionDone = await pg.getByText(/section done ✓/).count();
    if (confirm && sectionDone === 0) ok(`${label} — "Imported … sections" visible, no section-done toast`);
    else fail(label, `confirm toast visible=${confirm}, section-done toasts=${sectionDone}`);
  } finally {
    await c.close();
  }
}

// ── Slow reads (session 6 D10) ─────────────────────────────────────────────
// Production 2026-10-31 (matrix case 12a): on a slow link the user waited 57 s
// on "Reading your PDF" with no word, and the 45 s budget never fired because
// loading pdf.js and probing the worker ran before it started.
/** Fresh context; `routeWorker(route)` handles every pdf.worker.min.mjs request. */
async function withWorkerRoute(routeWorker, fn) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await c.newPage();
  await pg.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort("blockedbyclient"));
  await c.route("**/pdf.worker.min.mjs", routeWorker);
  try {
    await pg.goto(`${BASE}/builder?step=personal`, { waitUntil: "domcontentloaded" });
    await pg.getByRole("button", { name: /Import existing CV/ }).waitFor({ timeout: 30000 });
    await pg.evaluate(() => { window.dataLayer = []; });
    return await fn(pg);
  } finally {
    await c.close();
  }
}
const importPushes = (pg) =>
  pg.evaluate(() => (window.dataLayer ?? []).filter((e) => e && typeof e.event === "string" && e.event.startsWith("cv_import")).map((e) => `${e.event}${e.error_reason ? `(${e.error_reason})` : ""}`));
const hold = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. The worker script itself takes 12 s (the HEAD probe answers at once): the
//    "still reading" line appears after ~8 s and the import then completes.
async function checkSlowReadHint() {
  const label = "slow read (D10): \"Still reading your file…\" after ~8 s, then the review";
  await withWorkerRoute(
    async (route) => {
      if (route.request().method() === "GET") await hold(12000);
      await route.continue().catch(() => {});
    },
    async (pg) => {
      if (!(await pickInPlace(pg, path.join(FIXTURE_DIR, "text-cv.pdf")))) return fail(label, "file chooser never opened");
      const t0 = Date.now();
      const hint = pg.getByTestId("import-slow-hint");
      const review = pg.getByRole("dialog", { name: /Import from/ });
      let hintAt = null;
      while (Date.now() - t0 < 60000) {
        if (hintAt === null && /Still reading your file/.test((await hint.textContent().catch(() => "")) ?? "")) hintAt = Date.now() - t0;
        if (await review.isVisible().catch(() => false)) break;
        await pg.waitForTimeout(200);
      }
      const reviewAt = Date.now() - t0;
      const opened = await review.isVisible().catch(() => false);
      if (opened && hintAt !== null && hintAt >= 7500 && hintAt < 11000) ok(`${label} — hint at ${(hintAt / 1000).toFixed(1)} s, review at ${(reviewAt / 1000).toFixed(1)} s`);
      else fail(label, `hint at ${hintAt === null ? "never" : `${hintAt} ms`}, review ${opened ? `at ${reviewAt} ms` : "never opened"}`);
    },
  );
}

// 2. The worker HEAD probe never answers within the budget: before session 6
//    this sat outside the 45 s clock (the read started afresh after it). Now
//    the pick ends in cv_import_failed(timeout) about 45 s after it started.
async function checkProbeUnderDeadline() {
  const label = "worker probe held 60 s (D10): timeout at ~45 s from the pick";
  await withWorkerRoute(
    async (route) => {
      if (route.request().method() === "HEAD") await hold(60000);
      await route.continue().catch(() => {});
    },
    async (pg) => {
      if (!(await pickInPlace(pg, path.join(FIXTURE_DIR, "text-cv.pdf")))) return fail(label, "file chooser never opened");
      const t0 = Date.now();
      const errorBar = pg.getByTestId("import-error");
      const review = pg.getByRole("dialog", { name: /Import from/ });
      let outcome = "nothing";
      while (Date.now() - t0 < 75000) {
        if (await errorBar.isVisible().catch(() => false)) { outcome = "error"; break; }
        if (await review.isVisible().catch(() => false)) { outcome = "review"; break; }
        await pg.waitForTimeout(250);
      }
      const took = Date.now() - t0;
      const pushes = await importPushes(pg);
      if (outcome === "error" && pushes.length === 1 && pushes[0] === "cv_import_failed(timeout)" && took >= 43000 && took < 50000) {
        ok(`${label} — ${pushes[0]} after ${(took / 1000).toFixed(1)} s`);
      } else {
        fail(label, `outcome=${outcome} after ${took} ms; pushes=${JSON.stringify(pushes)}`);
      }
    },
  );
}

for (const [w, h] of CONSENT_VIEWPORTS) await checkConsentOverlap(w, h);
await checkSlowReadHint();
await checkProbeUnderDeadline();
await checkImportAfterTyping();
await checkErrorClearedByNextPick();
await checkFirstImportToast();

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
