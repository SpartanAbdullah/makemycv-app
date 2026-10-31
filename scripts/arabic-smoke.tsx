/**
 * Arabic PDF smoke — the render half (session 4, 2026-10-31).
 *
 * Renders every registered template with the four synthetic Arabic personas
 * (lib/data/preview-profiles.ts ARABIC_PERSONA_IDS: arabic-only,
 * arabic-first, arabic-name, arabic-dense) with the real faces embedded, and
 * writes .arabic-smoke/<template>-<persona>.pdf plus a manifest that lists,
 * per file, the Arabic words the text layer must contain and the page count
 * the dense persona must reach. scripts/arabic-smoke-check.mjs (chained in
 * `npm run smoke:arabic`) extracts and rasterises each file with pdf.js.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import ReactPDF from "@react-pdf/renderer";
import { CVDocument } from "../components/pdf/CVDocument";
import { ARABIC_PERSONA_IDS, getPersonaProfile } from "../lib/data/preview-profiles";
import { containsArabic } from "../lib/pdf/arabicText";
import { registerPdfFontsFromDir, warmPdfFonts } from "../lib/pdf/fonts";
import { templates } from "../lib/templates";
import type { CvData } from "../lib/types/cv";

/**
 * The Arabic words every template prints: name, headline, summary, roles,
 * companies, bullets, schools and degrees. Skills, languages, certificates
 * and projects are left out because sidebar layouts cap or drop them.
 */
function expectedArabicWords(data: CvData): string[] {
  const strings = [
    data.personal.firstName,
    data.personal.lastName,
    data.personal.headline,
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
        words: expectedArabicWords(data),
        minPages: persona === "arabic-dense" ? 2 : 1,
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
