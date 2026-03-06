// DOCX export — generates a Word-compatible .docx file from CvData.
// Uses the 'docx' npm package (MIT licensed).
// unspecified: styling is minimal; advanced template-matching to the visual
// CV templates would require further mapping work.

import type { CvData } from "../types/cv";

export async function exportToDocx(data: CvData): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import("docx");

  const { personal, experience, education, skills, languages, certifications, projects } = data;
  const fullName = [personal.firstName, personal.lastName].filter(Boolean).join(" ") || "Your Name";

  const makeSection = (title: string) =>
    new Paragraph({
      text: title.toUpperCase(),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 60 },
      border: {
        bottom: { color: "cccccc", size: 6, style: BorderStyle.SINGLE },
      },
    });

  const makeText = (text: string, bold = false, size = 22) =>
    new Paragraph({
      children: [new TextRun({ text, bold, size })],
      spacing: { after: 40 },
    });

  const makeBullet = (text: string) =>
    new Paragraph({
      text,
      bullet: { level: 0 },
      spacing: { after: 40 },
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: InstanceType<typeof Paragraph>[] = [];

  // Header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: fullName, bold: true, size: 36 })],
      spacing: { after: 40 },
    })
  );
  if (personal.headline) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: personal.headline, size: 24, color: "555555" })],
        spacing: { after: 40 },
      })
    );
  }
  const contactParts = [
    personal.email,
    personal.phone,
    personal.location,
    personal.linkedin,
    personal.website,
  ].filter(Boolean);
  if (contactParts.length) {
    children.push(makeText(contactParts.join("  |  "), false, 20));
  }

  // Summary
  if (personal.summary) {
    children.push(makeSection("Professional Summary"));
    children.push(makeText(personal.summary));
  }

  // Experience
  if (experience.length) {
    children.push(makeSection("Work Experience"));
    for (const exp of experience) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.role, bold: true, size: 24 }),
            new TextRun({
              text: `  ${exp.company}${exp.location ? " · " + exp.location : ""}`,
              size: 22,
              color: "555555",
            }),
          ],
          spacing: { before: 120, after: 40 },
        })
      );
      const dateRange = [exp.startDate, exp.isCurrent ? "Present" : exp.endDate]
        .filter(Boolean)
        .join(" – ");
      if (dateRange) children.push(makeText(dateRange, false, 20));
      for (const bullet of exp.bullets.filter(Boolean)) {
        children.push(makeBullet(bullet));
      }
    }
  }

  // Education
  if (education.length) {
    children.push(makeSection("Education"));
    for (const edu of education) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.school, bold: true, size: 24 }),
            new TextRun({
              text: `  ${[edu.degree, edu.field].filter(Boolean).join(", ")}`,
              size: 22,
              color: "555555",
            }),
          ],
          spacing: { before: 120, after: 40 },
        })
      );
      const dateRange = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
      if (dateRange) children.push(makeText(dateRange, false, 20));
      if (edu.notes) children.push(makeText(edu.notes));
    }
  }

  // Skills
  if (skills.length) {
    children.push(makeSection("Skills"));
    children.push(makeText(skills.map((s) => s.name).join(", ")));
  }

  // Languages
  if (languages.length) {
    children.push(makeSection("Languages"));
    children.push(makeText(languages.map((l) => l.name).join(", ")));
  }

  // Certifications
  if (certifications.length) {
    children.push(makeSection("Certifications"));
    for (const cert of certifications) {
      const line = [cert.name, cert.issuer, cert.date].filter(Boolean).join(" — ");
      children.push(makeText(line));
    }
  }

  // Projects
  if (projects.length) {
    children.push(makeSection("Projects"));
    for (const proj of projects) {
      children.push(makeText(proj.name, true));
      if (proj.link) children.push(makeText(proj.link, false, 20));
      for (const bullet of proj.bullets.filter(Boolean)) {
        children.push(makeBullet(bullet));
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fullName.replace(/\s+/g, "-")}-CV.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
