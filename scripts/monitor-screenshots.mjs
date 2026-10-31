// Screenshots for the production monitor (2026-10-31,
// .github/workflows/prod-monitor.yml). One full-page PNG per public app page,
// uploaded as a workflow artifact so a failing run shows what a visitor saw.
//
//   SMOKE_BASE=https://app.makemycv.ae SHOT_DIR=monitor-artifacts/shots node scripts/monitor-screenshots.mjs
//
// Read-only: GET navigations only, no clicks, no AI calls. Google's tags and
// Vercel Speed Insights are blocked so the visits never reach GA4. Never fails
// the job on its own (exit 0); the smokes are the checks, this is evidence.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const DIR = process.env.SHOT_DIR ?? "monitor-artifacts/shots";
fs.mkdirSync(DIR, { recursive: true });

const PAGES = ["/builder", "/resume-checker", "/jd-match", "/cover-letter", "/linkedin-message"];

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(
  /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|vercel-insights\.com/,
  (route) => route.abort("blockedbyclient"),
);
const page = await ctx.newPage();
for (const p of PAGES) {
  const name = p.replace(/^\//, "").replace(/\W+/g, "-") || "home";
  try {
    const res = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: true });
    console.log(`shot  ${p}  (${res?.status() ?? "no response"})`);
  } catch (e) {
    console.log(`miss  ${p}  ${String(e).slice(0, 160)}`);
  }
}
await browser.close();
