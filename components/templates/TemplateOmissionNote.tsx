"use client";

import type { CvData } from "../../lib/types/cv";
import { getTemplateById } from "../../lib/templates";
import { describeOmittedDetails, getOmittedDetails } from "../../lib/templates/capabilities";

/**
 * One line that says which of the user's details a template leaves out
 * (product audit 2026-11, T8). Renders nothing when the template prints
 * everything the user has asked to show, so it only ever appears when there
 * is something to decide.
 *
 * `tone="dark"` is for the full-page preview's dark overlay.
 */
export const TemplateOmissionNote = ({
  templateId,
  data,
  tone = "light",
}: {
  templateId: string | undefined;
  data: Pick<CvData, "personal" | "settings">;
  tone?: "light" | "dark";
}) => {
  const sentence = describeOmittedDetails(
    getTemplateById(templateId ?? "classic").name,
    getOmittedDetails(templateId, data),
  );
  if (!sentence) return null;
  const dark = tone === "dark";
  return (
    <p
      role="status"
      data-testid="template-omission-note"
      style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontSize: 12.5,
        lineHeight: 1.45,
        padding: "8px 12px",
        borderRadius: 10,
        maxWidth: 520,
        color: dark ? "white" : "var(--ff-ink)",
        background: dark ? "rgba(255,255,255,0.12)" : "var(--severity-review-bg)",
        border: dark
          ? "1px solid rgba(255,255,255,0.28)"
          : "1px solid var(--severity-review-border)",
      }}
    >
      {sentence}
    </p>
  );
};
