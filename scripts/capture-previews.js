/**
 * Template-preview capture pipeline.
 *
 * Screenshots the chrome-less /preview/<templateId> route (real templates,
 * realistic UAE dummy data from lib/data/preview-profiles.ts) as crisp A4
 * PNGs for the marketing site.
 *
 * Usage:
 *   node scripts/capture-previews.js [baseUrl]
 *   PREVIEW_BASE_URL=http://localhost:3210 npm run capture:previews
 *
 * Output: artifacts/template-previews/<id>-preview.png (1588×2246 @2x).
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// All registered template ids — the ONE place this script lists them.
// Keep in sync with the registry (lib/templates/index.tsx `templates`) and
// the profile map (lib/data/preview-profiles.ts `previewProfiles`); this is a
// plain-Node script, so it can't import those TypeScript modules directly.
const TEMPLATE_IDS = [
  "classic",
  "modern",
  "executive",
  "ats-clean",
  "exec-split",
  "corp-sidebar",
  "onyx",
  "sandstone",
  "professional",
  "professional-photo",
];
const BASE_URL = (
  process.env.PREVIEW_BASE_URL ||
  process.argv[2] ||
  "http://localhost:3000"
).replace(/\/+$/, "");
const OUT_DIR = path.join(__dirname, "..", "artifacts", "template-previews");

// A4 at 96dpi — must match the app-wide render width (794×1123).
const VIEWPORT = { width: 794, height: 1123 };
const MIN_BYTES = 30 * 1024; // sanity floor: a real render is well above 30KB

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Capturing ${TEMPLATE_IDS.length} template previews from ${BASE_URL}`);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2, // retina-crisp PNGs
    });
    const page = await context.newPage();

    for (const id of TEMPLATE_IDS) {
      const url = `${BASE_URL}/preview/${id}`;
      const outPath = path.join(OUT_DIR, `${id}-preview.png`);
      process.stdout.write(`  ${id.padEnd(12)} ${url} ... `);

      await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForSelector('[data-preview-ready="true"]', { timeout: 15_000 });
      // Dev-mode only: hide the Next.js dev-tools badge (<nextjs-portal>),
      // which would otherwise be burned into the bottom-left of the PNG.
      await page.addStyleTag({
        content: "nextjs-portal{display:none!important}",
      });
      // Web fonts (next/font) must be painted before we screenshot.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400); // small settle for layout/emoji glyphs

      await page.screenshot({ path: outPath, fullPage: false });

      const { size } = fs.statSync(outPath);
      if (size < MIN_BYTES) {
        throw new Error(
          `${outPath} is only ${size} bytes (<${MIN_BYTES}) — render likely failed`,
        );
      }
      console.log(`ok (${(size / 1024).toFixed(0)} KB)`);
    }
  } finally {
    await browser.close();
  }

  console.log(`Done. PNGs in ${OUT_DIR}`);
}

main().catch((error) => {
  console.error("\nCapture failed:", error);
  process.exit(1);
});
