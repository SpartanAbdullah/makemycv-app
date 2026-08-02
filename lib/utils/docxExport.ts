// DOCX export — generates a Word-compatible .docx file from CvData.
// Uses the 'docx' npm package (MIT licensed).
// unspecified: styling is minimal; advanced template-matching to the visual
// CV templates would require further mapping work.

import type { CvData } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { formatDateRange, normalizeHref } from "./format";
import { meaningfulProjects } from "./projects";
import { meaningfulExperience } from "./experience";
import { meaningfulEducation } from "./education";

export async function exportToDocx(data: CvData): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ExternalHyperlink } =
    await import("docx");

  const { personal, skills, languages, certifications } = data;
  // Drop blank shells so the DOCX never emits a ghost section heading
  // (see lib/utils/{projects,experience,education}.ts).
  const projects = meaningfulProjects(data.projects);
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
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
  // Contact line — email/phone/linkedin/website become real hyperlinks; the
  // "Hyperlink" character style is registered by docx's default styles.
  const makeLink = (text: string, link: string) =>
    new ExternalHyperlink({
      children: [new TextRun({ text, style: "Hyperlink", size: 20 })],
      link,
    });
  const contactChildren: (
    | InstanceType<typeof TextRun>
    | InstanceType<typeof ExternalHyperlink>
  )[] = [];
  const addContact = (
    part: InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>
  ) => {
    if (contactChildren.length) {
      contactChildren.push(new TextRun({ text: "  |  ", size: 20 }));
    }
    contactChildren.push(part);
  };
  if (personal.email) addContact(makeLink(personal.email, `mailto:${personal.email}`));
  if (personal.phone) addContact(makeLink(personal.phone, `tel:${personal.phone}`));
  if (personal.location) addContact(new TextRun({ text: personal.location, size: 20 }));
  const linkedinHref = normalizeHref(personal.linkedin);
  if (personal.linkedin && linkedinHref) addContact(makeLink(personal.linkedin, linkedinHref));
  const websiteHref = normalizeHref(personal.website);
  if (personal.website && websiteHref) addContact(makeLink(personal.website, websiteHref));
  if (contactChildren.length) {
    children.push(new Paragraph({ children: contactChildren, spacing: { after: 40 } }));
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
      const dateRange = formatDateRange(exp.startDate, exp.endDate, exp.isCurrent);
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
      const dateRange = formatDateRange(edu.startDate, edu.endDate);
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
    for (const lang of languages) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: lang.name, bold: true, size: 22 }),
            ...(lang.level
              ? [new TextRun({ text: ` — ${formatLanguageLevel(lang.level)}`, size: 22 })]
              : []),
          ],
          spacing: { after: 40 },
        })
      );
    }
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
      const projHref = normalizeHref(proj.link);
      if (proj.link && projHref) {
        children.push(
          new Paragraph({
            children: [makeLink(proj.link, projHref)],
            spacing: { after: 40 },
          })
        );
      }
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
