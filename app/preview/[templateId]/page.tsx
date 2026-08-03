import type { Metadata } from "next";
import { getPreviewProfile } from "@/lib/data/preview-profiles";
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
  searchParams: Promise<{ photo?: string }>;
}) {
  const { templateId } = await params;
  const { photo } = await searchParams;
  const template = getTemplateById(templateId);
  const profile = getPreviewProfile(template.id);
  // ?photo=0 renders the same template without its photo — the marketing
  // site shows both variants so users can compare with/without.
  const data =
    photo === "0"
      ? {
          ...profile,
          personal: { ...profile.personal, photo: undefined, showPhoto: false },
        }
      : profile;

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
