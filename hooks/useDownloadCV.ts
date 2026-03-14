import type { CvData, PlanTier } from "../lib/types/cv";

function sanitizeName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function buildFilename(data: CvData): string {
  const first = sanitizeName(data.personal.firstName ?? "");
  const last = sanitizeName(data.personal.lastName ?? "");
  if (first || last) {
    return `CV_${[first, last].filter(Boolean).join("_")}.pdf`;
  }
  return "CV_MakeMyCV.pdf";
}

export async function downloadCV(
  data: CvData,
  plan: PlanTier = "free",
  templateId: string = "classic",
): Promise<void> {
  try {
    const { pdf } = await import("@react-pdf/renderer");
    const { CVDocument } = await import("../components/pdf/CVDocument");
    const { createElement } = await import("react");

    const doc = createElement(CVDocument, { data, plan, templateId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(doc as any).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFilename(data);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF download failed:", err);
    throw err;
  }
}
