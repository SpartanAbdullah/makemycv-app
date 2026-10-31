/**
 * Arabic PDF smoke — the render half (session 4, 2026-10-31).
 *
 * Renders every registered template with the synthetic Arabic personas
 * (lib/data/preview-profiles.ts ARABIC_PERSONA_IDS: arabic-only,
 * arabic-first, arabic-name, arabic-dense, and since session 6 arabic-dense2,
 * arabic-midline, urdu-name) with the real faces embedded, and
 * writes .arabic-smoke/<template>-<persona>.pdf plus a manifest that lists,
 * per file, the Arabic words the text layer must contain, the WHOLE Arabic
 * lines it must reproduce in reading order (session 6, E8.7) and the page
 * count the dense personas must reach. scripts/arabic-smoke-check.mjs (chained in
 * `npm run smoke:arabic`) extracts and rasterises each file with pdf.js.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import ReactPDF from "@react-pdf/renderer";
import { CVDocument } from "../components/pdf/CVDocument";
import { ARABIC_PERSONA_IDS, getPersonaProfile } from "../lib/data/preview-profiles";
import { containsArabic, firstStrongDirection } from "../lib/pdf/arabicText";
import { registerPdfFontsFromDir, warmPdfFonts } from "../lib/pdf/fonts";
import { templates } from "../lib/templates";
import type { CvData } from "../lib/types/cv";

/**
 * The Arabic words every template prints: name, headline, summary, roles,
 * companies, bullets, schools and degrees. Skills, languages, certificates
 * and projects are left out because sidebar layouts cap or drop them.
 */
/** Harvard prints no headline (live template and PDF alike). */
const NO_HEADLINE = new Set(["harvard"]);

function expectedArabicWords(data: CvData, templateId: string): string[] {
  const strings = [
    data.personal.firstName,
    data.personal.lastName,
    NO_HEADLINE.has(templateId) ? "" : data.personal.headline,
    data.personal.summary,
    ...data.experience.flatMap((e) => [e.role, e.company, ...e.bullets]),
    ...data.education.flatMap((e) => [e.school, e.degree]),
  ];
  const words = new Set<string>();
  for (const s of strings) {
    for (const w of s.split(/[\s،؛؟.,:;()|·—–]+/)) {
      const clean = w.replace(/[ً-ْٰ]/g, "");
      if (clean.length >= 2 && containsArabic(clean)) words.add(clean);
    }
  }
  return [...words];
}

/**
 * Arabic-first strings that must come back from the text layer WHOLE and in
 * reading order after NFKC (session 6, E8.7): name, headline, roles,
 * companies, bullets, schools, degrees. Session 5 found bullets that kept
 * every word but lost their order (or lost words split across text-show
 * operators); a word list cannot see that, a whole-line comparison can.
 * Latin-first strings are left to the Latin smoke.
 */
function expectedArabicLines(data: CvData, templateId: string): string[] {
  const strings = [
    `${data.personal.firstName} ${data.personal.lastName}`,
    NO_HEADLINE.has(templateId) ? "" : data.personal.headline,
    ...data.experience.flatMap((e) => [e.role, e.company, ...e.bullets]),
    ...data.education.flatMap((e) => [e.school, e.degree]),
  ];
  return [...new Set(strings.map((s) => s.trim()).filter((s) => s && firstStrongDirection(s) === "rtl"))];
}

/** Every string in the CV, for the text-layer junk check. */
function allText(data: CvData): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(data);
  return out.join("\n");
}

async function main() {
  const outDir = join(process.cwd(), ".arabic-smoke");
  mkdirSync(outDir, { recursive: true });
  const fontsReady = registerPdfFontsFromDir(join(process.cwd(), "public", "fonts", "pdf"));
  if (!fontsReady) throw new Error("fonts: registration failed — the Arabic smoke needs the embedded faces");
  await warmPdfFonts(true);
  const manifest: Array<{
    template: string;
    persona: string;
    file: string;
    words: string[];
    lines: string[];
    minPages: number;
    inputText: string;
  }> = [];
  for (const persona of ARABIC_PERSONA_IDS) {
    for (const t of templates) {
      const data = getPersonaProfile(t.id, persona);
      if (!data) throw new Error(`no persona ${persona}`);
      const file = join(outDir, `${t.id}-${persona}.pdf`);
      const doc = createElement(CVDocument, { data, plan: "pro", templateId: t.id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ReactPDF.renderToFile(doc as any, file);
      manifest.push({
        template: t.id,
        persona,
        file,
        words: expectedArabicWords(data, t.id),
        lines: expectedArabicLines(data, t.id),
        minPages: persona === "arabic-dense" || persona === "arabic-dense2" ? 2 : 1,
        inputText: allText(data),
      });
      console.log(`rendered ${file}`);
    }
  }
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error("arabic smoke render failed:", err);
  process.exit(1);
});
