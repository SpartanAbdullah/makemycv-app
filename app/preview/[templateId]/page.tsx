import type { Metadata } from "next";
import { getPersonaProfile, getPreviewProfile } from "@/lib/data/preview-profiles";
import { getTemplateById } from "@/lib/templates";

/**
 * Chrome-less template preview used by the marketing screenshot pipeline
 * (scripts/capture-previews.js). Renders one real template at A4 CSS size
 * (794×1123) with a static UAE dummy profile — no nav, no builder chrome,
 * no store/localStorage access (pure props). Unknown ids fall back to the
 * classic template via getTemplateById, and get the classic profile
 * re-pointed at the resolved template.
 *
 * The app is globally noindexed; this reiterates it locally and the route
 * is additionally disallowed in app/robots.ts.
 */
export const metadata: Metadata = {
  title: "Template Preview",
  robots: { index: false, follow: false },
};

export default async function TemplatePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ photo?: string; density?: string; persona?: string }>;
}) {
  const { templateId } = await params;
  const { photo, density, persona } = await searchParams;
  const template = getTemplateById(templateId);
  // ?persona=bilingual | arabic-only | arabic-first | arabic-name | arabic-dense
  //   | arabic-dense2 | arabic-midline | urdu-name (session 6)
  // swaps in a SYNTHETIC Arabic persona — review tooling for the PDF-fidelity
  // harness and the Arabic smoke (scripts/pdf-fidelity.mjs --persona=…,
  // npm run smoke:arabic), never a marketing capture. Unknown ids fall back
  // to the template's own persona.
  const profile =
    (persona && getPersonaProfile(template.id, persona)) || getPreviewProfile(template.id);
  // ?photo=0 renders the same template without its photo — the marketing
  // site shows both variants so users can compare with/without.
  const withPhoto =
    photo === "0"
      ? {
          ...profile,
          personal: { ...profile.personal, photo: undefined, showPhoto: false },
        }
      : profile;
  // ?density=1..5 sets all four density controls to that level — review
  // tooling for template captures at the extremes (default: the persona's
  // own levels).
  const level = density ? Number(density) : NaN;
  const data =
    Number.isInteger(level) && level >= 1 && level <= 5
      ? {
          ...withPhoto,
          settings: {
            ...withPhoto.settings,
            pageMargins: level,
            fontSize: level,
            lineHeight: level,
            sectionSpacing: level,
          },
        }
      : withPhoto;

  return (
    <>
      {/* Capture hygiene: white page, no scrollbars nudging the 794px frame. */}
      <style>{"html,body{background:#ffffff;overflow:hidden;margin:0}"}</style>
      <div
        data-preview-ready="true"
        style={{
          width: 794,
          height: 1123,
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        <template.Render data={data} plan="pro" />
      </div>
    </>
  );
}
