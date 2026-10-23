/**
 * Cover letter → .docx (WP-9). Same `docx` package and download pattern as
 * lib/utils/docxExport.ts. The header block (name, contact line, date) is
 * assembled HERE in the browser from the CV — contact details never went to
 * the server; only the letter body came back from it.
 */

import type { CvData } from "../types/cv";

export type CoverLetterDocxInput = {
  letter: string;
  cv: CvData;
  company: string;
  jobTitle: string;
};

export const coverLetterFileName = (cv: CvData, company: string) => {
  const name = [cv.personal.firstName, cv.personal.lastName].filter(Boolean).join(" ").trim() || "Cover-Letter";
  const co = company.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);
  return `${name.replace(/\s+/g, "-")}-Cover-Letter${co ? `-${co}` : ""}.docx`;
};

/** Split the letter into paragraphs on blank lines; single newlines stay inside a paragraph. */
export const letterParagraphs = (letter: string): string[] =>
  letter
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

export async function exportCoverLetterDocx({ letter, cv, company, jobTitle }: CoverLetterDocxInput): Promise<void> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const p = cv.personal;
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  const contact = [p.email, p.phone, p.location].map((v) => (v ?? "").trim()).filter(Boolean).join("  ·  ");
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const line = (text: string, opts: { bold?: boolean; size?: number; after?: number; color?: string } = {}) =>
    new Paragraph({
      children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 22, color: opts.color })],
      spacing: { after: opts.after ?? 60 },
    });

  const children = [
    ...(fullName ? [line(fullName, { bold: true, size: 28, after: 40 })] : []),
    ...(contact ? [line(contact, { size: 20, color: "555555", after: 240 })] : []),
    line(today, { after: 200 }),
    ...(company.trim() ? [line(company.trim(), { after: 20 })] : []),
    ...(jobTitle.trim() ? [line(`Re: ${jobTitle.trim()}`, { bold: true, after: 240 })] : []),
    ...letterParagraphs(letter).map((para) => line(para, { after: 200 })),
  ];

  const doc = new Document({
    creator: "MakeMyCV",
    title: `${fullName || "Cover letter"} — ${company.trim() || "Cover letter"}`,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = coverLetterFileName(cv, company);
  a.click();
  URL.revokeObjectURL(url);
}
