/**
 * Preview-vs-PDF fidelity: the PDF half.
 *
 * Renders every registered template with the SAME persona and the SAME
 * density transformation the chrome-less /preview/<id>?density=N route
 * applies (app/preview/[templateId]/page.tsx), so scripts/pdf-fidelity.mjs
 * can put the live preview and the download side by side with identical
 * input. Compiled and run by that script; not part of `npm test`.
 *
 * Output: .fidelity-pdfs/<templateId>-<case>.pdf + manifest.json (manifest-<persona>.json for a persona run; build
 * output — add .fidelity-pdfs/ and .pdf-fidelity-build/ to .gitignore).
 *
 * Cases (see CASES below): "natural" = the persona's own levels, "compact" =
 * ?density=1, "dense" = ?density=5. With FIDELITY_PERSONA=bilingual (set by
 * `pdf-fidelity.mjs --persona=bilingual`) the one case "bilingual" renders the
 * SYNTHETIC Arabic + English overlay at the persona's own levels instead. The persona photo is the route's
 * /preview-photo.jpg, which react-pdf in Node cannot fetch, so it is inlined
 * as a data URI from public/.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import ReactPDF from "@react-pdf/renderer";
import { CVDocument } from "../components/pdf/CVDocument";
import {
  getPersonaProfile,
  getPreviewProfile,
  previewPhotoSrc,
} from "../lib/data/preview-profiles";
import { registerPdfFontsFromDir, warmPdfFonts } from "../lib/pdf/fonts";
import { templates } from "../lib/templates";
import type { CvData } from "../lib/types/cv";

// FIDELITY_PERSONA=bilingual | arabic-only | arabic-first | arabic-name |
// arabic-dense (set by `pdf-fidelity.mjs --persona=…`) renders that ONE
// synthetic Arabic persona at its own levels instead of the density trio.
const PERSONA = process.env.FIDELITY_PERSONA || "";
export const CASES: Array<{ id: string; density?: number }> = PERSONA
  ? [{ id: PERSONA }]
  : [
      { id: "natural" },
      { id: "compact", density: 1 },
      { id: "dense", density: 5 },
    ];

function withDensity(profile: CvData, level?: number): CvData {
  if (!level) return profile;
  return {
    ...profile,
    settings: {
      ...profile.settings,
      pageMargins: level,
      fontSize: level,
      lineHeight: level,
      sectionSpacing: level,
    },
  };
}

async function main() {
  const root = process.cwd();
  const outDir = join(root, ".fidelity-pdfs");
  mkdirSync(outDir, { recursive: true });
  const fontsReady = registerPdfFontsFromDir(join(root, "public", "fonts", "pdf"));
  console.log(fontsReady ? "fonts: embedded from public/fonts/pdf" : "fonts: Helvetica fallback");
  // Same glyph-cache warm-up as the download (lib/pdf/fonts.ts); the Arabic
  // face is only needed for the persona runs.
  await warmPdfFonts(Boolean(PERSONA));
  const photoUri =
    "data:image/jpeg;base64," +
    readFileSync(join(root, "public", previewPhotoSrc.replace(/^\//, ""))).toString("base64");

  const manifest: Array<{ template: string; case: string; file: string; density: number | null }> = [];
  for (const t of templates) {
    const profile = PERSONA ? getPersonaProfile(t.id, PERSONA) : getPreviewProfile(t.id);
    if (!profile) throw new Error(`unknown FIDELITY_PERSONA=${PERSONA}`);
    for (const c of CASES) {
      const base = withDensity(profile, c.density);
      const data: CvData =
        base.personal.photo === previewPhotoSrc
          ? { ...base, personal: { ...base.personal, photo: photoUri } }
          : base;
      const file = join(outDir, `${t.id}-${c.id}.pdf`);
      const doc = createElement(CVDocument, { data, plan: "pro", templateId: t.id });
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ReactPDF.renderToFile(doc as any, file);
        manifest.push({ template: t.id, case: c.id, file, density: c.density ?? null });
        console.log(`rendered ${file}`);
      } catch (err) {
        console.error(`FAILED ${t.id}-${c.id}: ${(err as Error).message}`);
      }
    }
  }
  // One manifest per persona so a --skip-render run of either set stays intact.
  writeFileSync(join(outDir, PERSONA ? `manifest-${PERSONA}.json` : "manifest.json"), JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error("fidelity render failed:", err);
  process.exit(1);
});
