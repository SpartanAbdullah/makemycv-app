// Synthetic CV-import fixtures (2026-10-31, import-failure investigation).
//
// Writes the committed fixture set under __fixtures__/import/. Every document
// is generated here from invented text — never a real CV — so the folder is
// safe to commit and the parser never sees anyone's details.
//
//   node scripts/make-import-fixtures.mjs          regenerate everything
//
// Chrome (via Playwright, system channel) prints the two text PDFs because
// that is how a large share of real CVs are produced (Google Docs / browser
// "Save as PDF"), and because it is the only dependency-free way here to get
// shaped Arabic into a PDF text layer. The scanned, encrypted and oversized
// PDFs are hand-written below (a PDF is just numbered objects + an xref
// table), the DOCX files come from the `docx` package already in
// dependencies, and the "legacy .doc renamed .docx" file is an OLE2 header
// followed by filler.
//
// scripts/import-fixtures.test.mjs reads this folder; it also imports
// `makeLargePdf` to build the 25 MB case in a temp dir instead of committing
// it.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
} from "docx";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURE_DIR = path.join(root, "__fixtures__", "import");

/* ── Invented CV content ───────────────────────────────────────────────── */

const CV = {
  name: "Layla Haddad",
  headline: "Procurement Specialist",
  email: "layla.haddad@example.com",
  phone: "+971 55 987 6543",
  location: "Abu Dhabi, UAE",
  linkedin: "linkedin.com/in/laylahaddad-example",
  summary:
    "Procurement specialist with 7 years across FM and construction supply chains in the UAE. Cut vendor lead times by 22% and ran tenders worth AED 40M a year.",
  experience: [
    {
      role: "Senior Procurement Specialist",
      company: "Falcon Facilities Management",
      dates: "Mar 2021 - Present",
      location: "Abu Dhabi",
      bullets: [
        "Ran 60+ tenders a year for MEP and soft-services contracts worth AED 40M.",
        "Cut average vendor lead time from 18 to 14 days by consolidating the approved supplier list.",
        "Negotiated framework agreements that saved 9% against the prior year's spend.",
      ],
    },
    {
      role: "Procurement Officer",
      company: "Oasis Build Contracting",
      dates: "Jun 2017 - Feb 2021",
      location: "Dubai",
      bullets: [
        "Sourced materials for 12 residential projects on schedule and within budget.",
        "Introduced a three-quote rule that reduced single-source purchases by 35%.",
      ],
    },
  ],
  education: [
    {
      degree: "BSc Supply Chain Management",
      school: "University of Sharjah",
      dates: "2013 - 2017",
    },
  ],
  skills: [
    "Tendering",
    "Vendor Management",
    "SAP Ariba",
    "Contract Negotiation",
    "Cost Analysis",
    "Oracle Fusion",
  ],
  languages: ["English - Fluent", "Arabic - Native"],
  certifications: ["CIPS Level 4 Diploma (2020)"],
  uae: {
    visa: "Visa Status: Employment visa (transferable)",
    notice: "Notice Period: 30 days",
    nationality: "Nationality: Jordanian",
    licence: "Driving Licence: UAE, valid",
  },
};

// Arabic-only CV (the Procurement CV, translated loosely; content invented).
const CV_AR = {
  name: "ليلى حداد",
  headline: "أخصائية مشتريات",
  contact: "أبوظبي، الإمارات · layla.haddad@example.com · +971 55 987 6543",
  sections: [
    [
      "الملخص",
      [
        "أخصائية مشتريات بخبرة سبع سنوات في سلاسل التوريد لإدارة المرافق والمقاولات في الإمارات. خفّضت مدة التوريد بنسبة 22% وأدرت مناقصات بقيمة 40 مليون درهم سنوياً.",
      ],
    ],
    [
      "الخبرة المهنية",
      [
        "أخصائية مشتريات أولى — فالكون لإدارة المرافق، أبوظبي (مارس 2021 - حتى الآن)",
        "إدارة أكثر من 60 مناقصة سنوياً لعقود الأعمال الكهروميكانيكية والخدمات.",
        "تقليص مدة التوريد من 18 إلى 14 يوماً عبر توحيد قائمة الموردين المعتمدين.",
        "مسؤولة مشتريات — واحة البناء للمقاولات، دبي (يونيو 2017 - فبراير 2021)",
        "توفير المواد لاثني عشر مشروعاً سكنياً ضمن الجدول والميزانية.",
      ],
    ],
    ["التعليم", ["بكالوريوس إدارة سلاسل التوريد — جامعة الشارقة (2013 - 2017)"]],
    [
      "المهارات",
      ["المناقصات، إدارة الموردين، SAP Ariba، التفاوض على العقود، تحليل التكاليف"],
    ],
    ["اللغات", ["العربية - اللغة الأم، الإنجليزية - بطلاقة"]],
  ],
};

// A page of generic prose (a mis-picked meeting note), well over the 200-char
// text-layer threshold.
const NOT_A_CV_LINES = wrap(
  "Notes from the weekly planning call. The team agreed to move the review of the supplier shortlist to the following week so that the two remaining quotations can be compared on the same basis. Facilities will circulate the updated floor plan once the landlord confirms the handover window, and the training room booking stays provisional until the headcount is known. Nothing further was raised and the call closed early.",
  95,
);

/* ── HTML renderings for Chrome ────────────────────────────────────────── */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function englishHtml() {
  const exp = CV.experience
    .map(
      (e) => `
      <h3>${esc(e.role)}</h3>
      <p class="meta">${esc(e.company)} · ${esc(e.location)} · ${esc(e.dates)}</p>
      <ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; line-height: 1.4; margin: 0; }
    h1 { font-size: 22pt; margin: 0 0 2pt; }
    h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #999; margin: 14pt 0 6pt; padding-bottom: 2pt; }
    h3 { font-size: 11.5pt; margin: 8pt 0 0; }
    p { margin: 2pt 0; } .meta { color: #444; } ul { margin: 4pt 0 0 14pt; padding: 0; }
  </style></head><body>
  <h1>${esc(CV.name)}</h1>
  <p><strong>${esc(CV.headline)}</strong></p>
  <p>${esc(CV.email)} · ${esc(CV.phone)} · ${esc(CV.location)} · ${esc(CV.linkedin)}</p>
  <p>${esc(CV.uae.visa)} · ${esc(CV.uae.notice)} · ${esc(CV.uae.nationality)}</p>
  <h2>Summary</h2><p>${esc(CV.summary)}</p>
  <h2>Experience</h2>${exp}
  <h2>Education</h2>${CV.education.map((e) => `<p><strong>${esc(e.degree)}</strong>, ${esc(e.school)} (${esc(e.dates)})</p>`).join("")}
  <h2>Skills</h2><p>${CV.skills.map(esc).join(" · ")}</p>
  <h2>Certifications</h2><p>${CV.certifications.map(esc).join("; ")}</p>
  <h2>Languages</h2><p>${CV.languages.map(esc).join(" · ")}</p>
  </body></html>`;
}

function arabicHtml() {
  const body = CV_AR.sections
    .map(
      ([h, lines]) =>
        `<h2>${esc(h)}</h2>${lines.map((l) => `<p>${esc(l)}</p>`).join("")}`,
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 12pt; color: #111; line-height: 1.7; margin: 0; }
    h1 { font-size: 24pt; margin: 0 0 4pt; }
    h2 { font-size: 13pt; border-bottom: 1px solid #999; margin: 14pt 0 6pt; padding-bottom: 2pt; }
    p { margin: 3pt 0; }
  </style></head><body>
  <h1>${esc(CV_AR.name)}</h1><p><strong>${esc(CV_AR.headline)}</strong></p><p>${esc(CV_AR.contact)}</p>
  ${body}</body></html>`;
}

/* ── Minimal PDF writer ────────────────────────────────────────────────── */

const latin1 = (s) => Buffer.from(s, "latin1");

/** Assemble numbered objects (1-based, bodies as Buffers) into a PDF. */
function assemblePdf(objects, trailerExtra = "") {
  const parts = [latin1("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = [];
  let pos = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(pos);
    const chunk = Buffer.concat([latin1(`${i + 1} 0 obj\n`), body, latin1("\nendobj\n")]);
    parts.push(chunk);
    pos += chunk.length;
  });
  const xrefPos = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra} >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  parts.push(latin1(xref));
  return Buffer.concat(parts);
}

const pdfString = (s) =>
  "(" + s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";

/** Content stream: one line of Helvetica per entry, top-down from y=770. */
function textContent(lines, size = 11, leading = 15) {
  let out = `BT /F1 ${size} Tf 56 780 Td ${leading} TL\n`;
  for (const line of lines) {
    // Helvetica/WinAnsi: anything outside Latin-1 becomes '?', which is fine
    // for these English fixtures.
    const safe = line.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
    out += `${pdfString(safe)} Tj T*\n`;
  }
  out += "ET";
  return latin1(out);
}

function cvLines() {
  const lines = [
    CV.name,
    CV.headline,
    `${CV.email} | ${CV.phone} | ${CV.location}`,
    CV.linkedin,
    `${CV.uae.visa} | ${CV.uae.notice}`,
    `${CV.uae.nationality} | ${CV.uae.licence}`,
    "",
    "SUMMARY",
    ...wrap(CV.summary, 95),
    "",
    "EXPERIENCE",
  ];
  for (const e of CV.experience) {
    lines.push(`${e.role} - ${e.company}`, `${e.location} | ${e.dates}`);
    for (const b of e.bullets) lines.push(...wrap("- " + b, 95));
    lines.push("");
  }
  lines.push("EDUCATION");
  for (const e of CV.education) lines.push(`${e.degree}, ${e.school} (${e.dates})`);
  lines.push("", "SKILLS", CV.skills.join(", "), "", "CERTIFICATIONS", ...CV.certifications);
  lines.push("", "LANGUAGES", CV.languages.join(" | "));
  return lines;
}

function wrap(text, width) {
  const words = text.split(" ");
  const out = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      out.push(cur.trim());
      cur = w;
    } else cur = cur + " " + w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function stream(dict, data) {
  return Buffer.concat([latin1(`<< ${dict} /Length ${data.length} >>\nstream\n`), data, latin1("\nendstream")]);
}

/** Plain single-page Helvetica PDF (used as the base of the encrypted one). */
function simpleTextPdfObjects(content) {
  return [
    latin1("<< /Type /Catalog /Pages 2 0 R >>"),
    latin1("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    latin1("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"),
    stream("", content),
    latin1("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
  ];
}

/** Image-only page: a JPEG XObject scaled to A4 — what a phone scan or a
 *  "print to image" export produces. No text operators at all. */
function imageOnlyPdf(jpeg, width, height) {
  const content = latin1(`q 595 0 0 842 0 0 cm /Im1 Do Q`);
  return assemblePdf([
    latin1("<< /Type /Catalog /Pages 2 0 R >>"),
    latin1("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    latin1("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>"),
    stream("", content),
    stream(
      `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      jpeg,
    ),
  ]);
}

/* ── Standard security handler, R2 / 40-bit RC4 ────────────────────────── */

const PAD = Buffer.from(
  "28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A",
  "hex",
);
const md5 = (...bufs) => crypto.createHash("md5").update(Buffer.concat(bufs)).digest();
const padPw = (pw) => Buffer.concat([Buffer.from(pw, "latin1"), PAD]).subarray(0, 32);

function rc4(key, data) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    out[k] = data[k] ^ S[(S[i] + S[j]) & 0xff];
  }
  return out;
}

/** Encrypt a simple text PDF so that opening it needs `userPw`. Algorithms
 *  3.1–3.5 of the PDF 1.7 reference (R2, V1, 40-bit). */
function encryptedTextPdf(content, userPw, ownerPw) {
  const id0 = crypto.createHash("md5").update("makemycv-fixture-encrypted").digest();
  const P = -1; // all permissions; irrelevant for the open check
  const O = rc4(md5(padPw(ownerPw)).subarray(0, 5), padPw(userPw));
  const pBytes = Buffer.alloc(4);
  pBytes.writeInt32LE(P);
  const key = md5(padPw(userPw), O, pBytes, id0).subarray(0, 5);
  const U = rc4(key, PAD);
  const objKey = (num, gen) => {
    const extra = Buffer.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, gen & 0xff, (gen >> 8) & 0xff]);
    return md5(key, extra).subarray(0, 10);
  };
  const hex = (b) => "<" + b.toString("hex") + ">";
  const objects = simpleTextPdfObjects(content);
  // Object 4 is the only stream; encrypt it with its object key.
  objects[3] = stream("", rc4(objKey(4, 0), content));
  objects.push(
    latin1(`<< /Filter /Standard /V 1 /R 2 /Length 40 /P ${P} /O ${hex(O)} /U ${hex(U)} >>`),
  );
  return assemblePdf(objects, `/Encrypt ${objects.length} 0 R /ID [${hex(id0)} ${hex(id0)}]`);
}

/** A valid-looking PDF padded past `bytes` with comment lines — the size gate
 *  must refuse it before any parser runs, so the content is irrelevant. */
export function makeLargePdf(bytes) {
  const base = assemblePdf(simpleTextPdfObjects(textContent(cvLines())));
  const filler = Buffer.alloc(Math.max(0, bytes - base.length), 0x20);
  // A comment line of spaces: still a syntactically harmless PDF tail.
  filler[0] = 0x25; // '%'
  return Buffer.concat([base, filler]);
}

/* ── DOCX fixtures (docx package) ──────────────────────────────────────── */

const p = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts })] });
const h = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
const bullet = (text) => new Paragraph({ text, bullet: { level: 0 } });

function bodyParagraphs({ withContact }) {
  const out = [];
  if (withContact) {
    out.push(new Paragraph({ text: CV.name, heading: HeadingLevel.TITLE }));
    out.push(p(CV.headline, { bold: true }));
    out.push(p(`${CV.email} | ${CV.phone} | ${CV.location} | ${CV.linkedin}`));
  }
  out.push(p(`${CV.uae.visa} | ${CV.uae.notice} | ${CV.uae.nationality}`));
  out.push(h("Summary"), p(CV.summary), h("Experience"));
  for (const e of CV.experience) {
    out.push(p(`${e.role} - ${e.company}`, { bold: true }), p(`${e.location} | ${e.dates}`));
    for (const b of e.bullets) out.push(bullet(b));
  }
  out.push(h("Education"));
  for (const e of CV.education) out.push(p(`${e.degree}, ${e.school} (${e.dates})`));
  out.push(h("Skills"), p(CV.skills.join(", ")));
  out.push(h("Certifications"), ...CV.certifications.map((c) => p(c)));
  out.push(h("Languages"), p(CV.languages.join(" | ")));
  return out;
}

async function headerContactDocx() {
  // Word CV templates commonly put the name + contact line in the page
  // header. mammoth.extractRawText reads only document.xml, so without a
  // header pass the import loses the person's name and email.
  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({ text: CV.name, heading: HeadingLevel.TITLE }),
              p(`${CV.email} | ${CV.phone} | ${CV.location} | ${CV.linkedin}`),
            ],
          }),
        },
        footers: { default: new Footer({ children: [p("Page footer - references available on request")] }) },
        children: [p(CV.headline, { bold: true }), ...bodyParagraphs({ withContact: false })],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function twoColumnTableDocx() {
  // A two-column template: left column skills/contact, right column the
  // narrative — laid out as one borderless table, as Word templates do.
  const cell = (children, width) =>
    new TableCell({ children, width: { size: width, type: WidthType.PERCENTAGE } });
  const left = [
    h("Contact"),
    p(CV.email),
    p(CV.phone),
    p(CV.location),
    h("Skills"),
    ...CV.skills.map((s) => bullet(s)),
    h("Languages"),
    ...CV.languages.map((l) => p(l)),
  ];
  const right = [
    h("Summary"),
    p(CV.summary),
    h("Experience"),
    ...CV.experience.flatMap((e) => [
      p(`${e.role} - ${e.company}`, { bold: true }),
      p(`${e.location} | ${e.dates}`),
      ...e.bullets.map(bullet),
    ]),
    h("Education"),
    ...CV.education.map((e) => p(`${e.degree}, ${e.school} (${e.dates})`)),
  ];
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: CV.name, heading: HeadingLevel.TITLE }),
          p(CV.headline, { bold: true }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: [cell(left, 32), cell(right, 68)] })],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function rtlMixedDocx() {
  // Bilingual CV: English sections with Arabic/Urdu lines interleaved, the
  // Arabic paragraphs marked bidirectional as Word does.
  const ar = (text) =>
    new Paragraph({ bidirectional: true, children: [new TextRun({ text, rightToLeft: true })] });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: CV.name, heading: HeadingLevel.TITLE }),
          ar(CV_AR.name),
          p(`${CV.email} | ${CV.phone} | ${CV.location}`),
          h("Summary"),
          p(CV.summary),
          ar(CV_AR.sections[0][1][0]),
          h("Experience"),
          ...CV.experience.flatMap((e) => [
            p(`${e.role} - ${e.company}`, { bold: true }),
            p(`${e.location} | ${e.dates}`),
            ...e.bullets.map(bullet),
          ]),
          ar(CV_AR.sections[1][1][0]),
          h("Education"),
          ...CV.education.map((e) => p(`${e.degree}, ${e.school} (${e.dates})`)),
          ar("بکالوریوس سپلائی چین مینجمنٹ، شارجہ یونیورسٹی"),
          h("Skills"),
          p(CV.skills.join(", ")),
          h("Languages"),
          p("English - Fluent | Arabic - Native | Urdu - Conversational"),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** OLE2 compound-file signature + filler: what a Word 97-2003 .doc looks like
 *  to a zip reader when someone renames it to .docx. */
function legacyDocBytes() {
  const header = Buffer.from("D0CF11E0A1B11AE1", "hex");
  const filler = Buffer.alloc(4096, 0);
  Buffer.from("Microsoft Word 97-2003 document (synthetic filler)").copy(filler, 512);
  return Buffer.concat([header, filler]);
}

/* ── main ──────────────────────────────────────────────────────────────── */

async function main() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const write = (name, data) => {
    fs.writeFileSync(path.join(FIXTURE_DIR, name), data);
    console.log(`wrote ${name} (${data.length} bytes)`);
  };

  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(englishHtml(), { waitUntil: "load" });
    write("text-cv.pdf", await page.pdf({ format: "A4", printBackground: true }));
    // The "scan": a JPEG of the same page, embedded with no text layer.
    const jpeg = await page.screenshot({ type: "jpeg", quality: 60 });
    write("scanned-cv.pdf", imageOnlyPdf(jpeg, 794, 1123));
    await page.setContent(arabicHtml(), { waitUntil: "load" });
    write("arabic-only.pdf", await page.pdf({ format: "A4", printBackground: true }));
  } finally {
    await browser.close();
  }

  write("encrypted-cv.pdf", encryptedTextPdf(textContent(cvLines()), "secret", "owner"));
  write("plain-helvetica-cv.pdf", assemblePdf(simpleTextPdfObjects(textContent(cvLines()))));
  // Readable text, but not a CV: no contact line, no section headings, no
  // dates — the mapping yields nothing and the import must say so.
  write("not-a-cv.pdf", assemblePdf(simpleTextPdfObjects(textContent(NOT_A_CV_LINES))));
  write("header-contact.docx", await headerContactDocx());
  write("two-column-table.docx", await twoColumnTableDocx());
  write("rtl-mixed.docx", await rtlMixedDocx());
  write("legacy-doc-renamed.docx", legacyDocBytes());
  write("empty.pdf", Buffer.alloc(0));
  write("photo-of-cv.jpg", Buffer.from("FFD8FFE000104A46494600010100000100010000FFD9", "hex"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
