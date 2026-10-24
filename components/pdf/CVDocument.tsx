import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Link,
  Font,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { CvData, PlanTier } from "../../lib/types/cv";
import { formatLanguageLevel } from "../../lib/language";
import { getEssentialChips } from "../../lib/utils/essentials";
import { resolveTheme } from "../../lib/templates/theme";
// Opaque tints for the PDF: react-pdf converts alpha colours to 8-digit hex
// and pdfkit misparses that as solid neon green (audit 2026-10), so every
// translucent-looking colour is pre-blended with mix() instead. The pdf
// smoke script fails the build if an alpha colour creeps back in.
import { mix } from "../../lib/utils/color";
import { formatDateRange, normalizeHref } from "../../lib/utils/format";
import { meaningfulProjects } from "../../lib/utils/projects";
import { meaningfulExperience } from "../../lib/utils/experience";
import { meaningfulEducation } from "../../lib/utils/education";
import { isSkillsFirst } from "../../lib/data/sectionOrder";
import { splitSkills } from "../../lib/utils/skills";
import { PDF_FAMILY, pdfFontPair, pdfFontsReady, type PdfFontPair } from "../../lib/pdf/fonts";

// Disable react-pdf's default en-US hyphenator — it inserted real "-" glyphs into names/emails, corrupting ATS text extraction.
Font.registerHyphenationCallback((word) => [word]);

/* ─── Helpers ─────────────────────────────────────────────── */

/** Smart URL shortening matching Classic template logic */
const shortenDisplayUrl = (value: string) => {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  if (!cleaned) return value.trim();

  const [domain, ...pathParts] = cleaned.split("/");
  if (pathParts.length === 0) return domain;

  const maxSegments = domain.toLowerCase().includes("linkedin.com") ? 2 : 1;
  const kept = pathParts.filter(Boolean).slice(0, maxSegments);
  return kept.length > 0 ? `${domain}/${kept.join("/")}` : domain;
};

const shouldShowProjectLink = (value?: string) => {
  const normalized = value?.trim();
  if (!normalized) return false;
  return normalized.toLowerCase() !== "no link was pasted";
};

/* ─── Colors (from Classic template slate palette) ────────── */

const SLATE_900 = "#0F172A";
const SLATE_800 = "#1E293B";
const SLATE_700 = "#334155";
const SLATE_600 = "#475569";
const SLATE_500 = "#64748B";
const SLATE_400 = "#94A3B8";
const SLATE_300 = "#CBD5E1";
const SLATE_200 = "#E2E8F0";

/* ─── Styles ──────────────────────────────────────────────── */
/*
 * Font-size conversion: Classic uses CSS px (96 DPI),
 * @react-pdf uses pt (72 DPI). Factor: pt = px × 0.75
 *
 * Classic 30px  → 22.5pt  (name)
 * Classic 15px  → 11.25pt (headline)
 * Classic 12.5px → 9.4pt  (section headings)
 * Classic 12px  → 9pt     (entry title / company)
 * Classic 11.5px → 8.6pt  (body, bullets, certs)
 * Classic 11px  → 8.25pt  (dates, contact, subtext)
 *
 * Spacing: page padding = 27pt top/bottom, 24pt left/right
 * (tightened from the live template's 36pt/30pt equivalent for better fit)
 * mt-6 = 24px → 18pt, space-y-3 = 12px → 9pt, pb-1 = 4px → 3pt
 * pl-4 = 16px → 12pt, space-y-1 = 4px → 3pt
 */

const BASE_STYLES: Record<string, Style> = {
  page: {
    paddingTop: 27,
    paddingBottom: 27,
    paddingLeft: 24,
    paddingRight: 24,
    fontFamily: "Helvetica",
    fontSize: 8.6,
    lineHeight: 1.45,
    color: SLATE_700,
  },

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: SLATE_200,
    paddingBottom: 6,
  },
  headerLeft: { flex: 1 },
  name: {
    fontSize: 22.5,
    fontFamily: "Helvetica-Bold",
    color: SLATE_900,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 11.25,
    color: SLATE_600,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 5,
  },
  contactItem: {
    fontSize: 8.25,
    color: SLATE_500,
  },
  contactSep: {
    fontSize: 8.25,
    color: SLATE_300,
    marginHorizontal: 2,
  },
  contactLink: {
    fontSize: 8.25,
    color: SLATE_500,
    textDecoration: "underline",
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    objectFit: "cover",
    borderWidth: 1.5,
    borderColor: SLATE_200,
  },

  /* Sections */
  section: { marginTop: 18 },
  sectionHeadingWrap: {
    borderBottomWidth: 1,
    borderBottomColor: SLATE_200,
    paddingBottom: 3,
    marginBottom: 6,
  },
  sectionHeading: {
    fontSize: 9.4,
    fontFamily: "Helvetica-Bold",
    color: SLATE_800,
  },
  body: {
    fontSize: 8.6,
    lineHeight: 1.45,
    color: SLATE_700,
  },

  /* Experience / Education entries */
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
  },
  entryTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: SLATE_800,
  },
  entryCompany: {
    fontSize: 9,
    color: SLATE_700,
  },
  entryDate: {
    fontSize: 8.25,
    color: SLATE_500,
    textAlign: "right",
    flexShrink: 0,
  },
  entrySubtext: {
    fontSize: 8.25,
    color: SLATE_500,
    marginTop: 1,
  },
  entryBlock: {
    marginBottom: 9,
  },

  /* Bullet list */
  bulletList: { marginTop: 3, paddingLeft: 12 },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bulletDot: {
    width: 10,
    fontSize: 8.6,
    color: SLATE_400,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.6,
    lineHeight: 1.45,
    color: SLATE_700,
  },

  /* Two-column section (languages + certs) */
  twoCol: {
    flexDirection: "row",
    gap: 18,
    marginTop: 18,
  },
  twoColItem: { flex: 1 },

  /* Watermark — diagonal overlay matching Classic template */
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  watermarkText: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: SLATE_500,
    opacity: 0.3,
    transform: "rotate(-28deg)",
  },

  /* ── Executive sidebar ──────────────────────────────────── */
  /* Negative margins extend the panel to the page top/bottom/left edges,
     escaping the page-level 27pt/24pt padding (matches the live preview).
     The navy fill itself is NOT here: it is a separate fixed, absolutely
     positioned band in ExecutivePDFLayout, because a background on this
     View left a 27pt white notch at the top of page 2+ (react-pdf rebuilds
     the split continuation with marginTop 0). Width and padding mirror the
     live template's 200px sidebar with 28px/20px padding. */
  execSidebar: {
    width: 150,
    marginTop: -27,
    marginBottom: -27,
    marginLeft: -24,
    paddingTop: 21,
    paddingBottom: 21,
    paddingLeft: 15,
    paddingRight: 15,
    flexShrink: 0,
  },
  execName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    lineHeight: 1.2,
    marginBottom: 2,
  },
  execHeadline: {
    fontSize: 8,
    color: "#94A3B8",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    // Opaque 15%-white-on-navy; overridden per theme at render.
    borderBottomColor: "#404A65",
  },
  execSideLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 5,
    marginTop: 14,
  },
  execContactItem: {
    fontSize: 7.5,
    color: "#CBD5E1",
    lineHeight: 1.6,
    marginBottom: 2,
  },
  execSkillItem: {
    fontSize: 7.5,
    color: "#CBD5E1",
    lineHeight: 1.7,
  },

  /* ── ATS Clean ──────────────────────────────────────────── */
  atsName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  atsHeadline: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 5,
    marginTop: 0,
  },
  atsContactLine: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 4,
  },
  atsDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#111827",
    marginBottom: 12,
    marginTop: 6,
  },
  atsSectionHeading: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    marginBottom: 6,
    marginTop: 16,
  },
};

/* ─── Per-render style factory ─────────────────────────────── */
/*
 * Density sliders scale the sheet at render time. buildStyles(theme) clones
 * BASE_STYLES and multiplies every numeric fontSize by theme.fontScale and
 * every numeric lineHeight by theme.lineScale. It then multiplies the
 * SECTION-GAP margins (the vertical space BETWEEN top-level sections/entries)
 * by theme.spaceScale — for a KNOWN set of keys only, so headers/chips/photos
 * do not move. Each scale is EXACTLY 1.0 at the neutral default, so x*1 === x
 * and every saved CV renders byte-identically.
 */
const SECTION_GAP_KEYS: Record<string, ReadonlyArray<"marginTop" | "marginBottom">> = {
  section: ["marginTop"],
  entryBlock: ["marginBottom"],
  sectionHeadingWrap: ["marginBottom"],
  twoCol: ["marginTop"],
  // ATS Clean uses atsSectionHeading itself as the section divider; its
  // marginTop is the gap BETWEEN sections (the first section overrides it to 0
  // inline, which is unaffected).
  atsSectionHeading: ["marginTop"],
};

const buildStyles = (
  t: {
    fontScale: number;
    lineScale: number;
    spaceScale: number;
  },
  fonts: PdfFontPair = { regular: "Helvetica", bold: "Helvetica-Bold" },
) => {
  const out: Record<string, Style> = {};
  for (const k in BASE_STYLES) {
    const v: Style = { ...BASE_STYLES[k] };
    // BASE_STYLES is written against the Helvetica pair; swap in the user's
    // CV face (Inter / Bricolage / Instrument Serif) once registered — see
    // lib/pdf/fonts.ts. Custom families select weight via fontWeight.
    if (v.fontFamily === "Helvetica") v.fontFamily = fonts.regular;
    if (v.fontFamily === "Helvetica-Bold") {
      v.fontFamily = fonts.bold;
      v.fontWeight = 700;
    }
    if (typeof v.fontSize === "number") v.fontSize = v.fontSize * t.fontScale;
    if (typeof v.lineHeight === "number") v.lineHeight = v.lineHeight * t.lineScale;
    const gapProps = SECTION_GAP_KEYS[k];
    if (gapProps) {
      for (const prop of gapProps) {
        if (typeof v[prop] === "number") {
          v[prop] = (v[prop] as number) * t.spaceScale;
        }
      }
    }
    out[k] = v;
  }
  return StyleSheet.create(out);
};

/* ─── Shared bullet renderer ──────────────────────────────── */

const BulletList = ({
  bullets,
  s,
}: {
  bullets: string[];
  s: Record<string, Style>;
}) => {
  const items = bullets.map((b) => b.trim()).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <View style={s.bulletList}>
      {items.map((bullet, bi) => (
        <View key={bi} style={s.bulletItem}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{bullet}</Text>
        </View>
      ))}
    </View>
  );
};

/* ─── Education entry (shared fixed layout) ──────────────── */

const EducationEntry = ({
  edu,
  headingStyle,
  s,
  fontScale,
}: {
  edu: CvData["education"][number];
  headingStyle?: Style;
  s: Record<string, Style>;
  fontScale: number;
}) => (
  <View style={s.entryBlock} wrap={false}>
    <View style={s.entryRow}>
      <Text style={headingStyle ?? s.entryTitle}>
        {[edu.degree?.trim(), edu.field?.trim()].filter(Boolean).join(" · ") ||
          "Degree"}
      </Text>
      <Text style={s.entryDate}>
        {formatDateRange(edu.startDate, edu.endDate)}
      </Text>
    </View>
    {edu.school?.trim() ? (
      <Text style={s.entrySubtext}>{edu.school.trim()}</Text>
    ) : null}
    {edu.notes?.trim() ? (
      <Text style={{ ...s.entrySubtext, marginTop: 1 }}>
        {edu.notes.trim()}
      </Text>
    ) : null}
    {edu.attested ? (
      <Text style={{ fontSize: 7.5 * fontScale, color: "#15803d", marginTop: 2 }}>
        {edu.attestingBody?.trim()
          ? `\u2713 Attested \u2014 ${edu.attestingBody.trim()}`
          : "Attested"}
      </Text>
    ) : null}
  </View>
);

/* ═══════════════════════════════════════════════════════════
   CLASSIC PDF LAYOUT
   ═══════════════════════════════════════════════════════════ */

const ClassicPDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, "#1e5b54");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );
  const skillsBlock =
    generalSkills.length > 0 || technicalSkills.length > 0 ? (
      <>
        {generalSkills.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Skills</Text>
            </View>
            <Text style={s.body}>
              {generalSkills.map((sk) => sk.name).join(", ")}
            </Text>
          </View>
        )}
        {technicalSkills.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Technical Skills</Text>
            </View>
            <Text style={s.body}>
              {technicalSkills.map((sk) => sk.name).join(", ")}
            </Text>
          </View>
        )}
      </>
    ) : null;
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";

  const hasSummary = Boolean(data.personal.summary?.trim());
  const experience = meaningfulExperience(data.experience);
  const hasExperience = experience.length > 0;
  const education = meaningfulEducation(data.education);
  const hasEducation = education.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const projects = meaningfulProjects(data.projects);
  const hasProjects = projects.length > 0;

  type ContactItem = { text: string; href?: string };
  const contacts: ContactItem[] = [];
  if (data.personal.email?.trim())
    contacts.push({
      text: data.personal.email.trim(),
      href: `mailto:${data.personal.email.trim()}`,
    });
  if (data.personal.phone?.trim())
    contacts.push({
      text: data.personal.phone.trim(),
      href: `tel:${data.personal.phone.trim()}`,
    });
  if (data.personal.location?.trim())
    contacts.push({ text: data.personal.location.trim() });
  if (data.personal.linkedin?.trim())
    contacts.push({
      text: shortenDisplayUrl(data.personal.linkedin),
      href: normalizeHref(data.personal.linkedin),
    });
  if (data.personal.website?.trim())
    contacts.push({
      text: shortenDisplayUrl(data.personal.website),
      href: normalizeHref(data.personal.website),
    });
  if (data.personal.dateOfBirth?.trim())
    contacts.push({ text: `DOB: ${data.personal.dateOfBirth.trim()}` });

  const essentialChips = getEssentialChips(data.personal);
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

  return (
    <View>
      {/* ── Header ── */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={{ marginBottom: 2 }}>
            <Text style={{ ...s.name, lineHeight: 1 * theme.lineScale }}>{name}</Text>
          </View>
          {data.personal.headline?.trim() ? (
            <View style={{ marginBottom: 3 }}>
              <Text style={{ ...s.headline, lineHeight: 1.2 * theme.lineScale }}>
                {data.personal.headline.trim()}
              </Text>
            </View>
          ) : null}
          {contacts.length > 0 && (
            <View style={s.contactRow}>
              {contacts.map((item, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  {item.href ? (
                    <Link src={item.href} style={s.contactLink}>
                      {item.text}
                    </Link>
                  ) : (
                    <Text style={s.contactItem}>{item.text}</Text>
                  )}
                  {i < contacts.length - 1 && (
                    <Text style={s.contactSep}>|</Text>
                  )}
                </View>
              ))}
            </View>
          )}
          {essentialChips.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                marginTop: 3,
              }}
            >
              {essentialChips.map((chip, i) => (
                <View
                  key={chip.label}
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  <Text
                    style={{
                      fontSize: 9 * theme.fontScale,
                      color: "#0F172A",
                      fontWeight: 600,
                    }}
                  >
                    {chip.label}:
                  </Text>
                  <Text style={{ fontSize: 9 * theme.fontScale, color: "#475569", marginLeft: 2 }}>
                    {chip.value}
                  </Text>
                  {i < essentialChips.length - 1 && (
                    <Text style={{ ...s.contactSep, color: "#CBD5E1" }}>·</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
        {showPhoto && data.personal.photo && (
          <Image src={data.personal.photo} style={{ ...s.photo, borderRadius: data.settings.photoShape === "square" ? 8 : 30 }} />
        )}
      </View>

      {/* ── Summary ── */}
      {hasSummary && (
        <View style={s.section}>
          <View style={s.sectionHeadingWrap}>
            <Text style={s.sectionHeading}>Summary</Text>
          </View>
          <Text style={s.body}>{data.personal.summary?.trim()}</Text>
        </View>
      )}

      {/* ── Skills (hoisted above experience for skills-first domains) ── */}
      {isSkillsFirst(data.settings.domain) ? skillsBlock : null}

      {/* ── Experience ── */}
      {hasExperience && (
        <View style={s.section}>
          <View style={s.sectionHeadingWrap}>
            <Text style={s.sectionHeading}>Experience</Text>
          </View>
          {experience.map((role) => (
            <View key={role.id} style={s.entryBlock} minPresenceAhead={48}>
              <View style={s.entryRow}>
                <Text style={{ ...s.entryTitle, flex: 1 }}>
                  {role.role?.trim() || "Role"}
                  {role.company ? (
                    <Text style={s.entryCompany}>
                      {` | ${role.company.trim()}`}
                    </Text>
                  ) : null}
                </Text>
                <Text style={s.entryDate}>
                  {formatDateRange(
                    role.startDate,
                    role.endDate,
                    role.isCurrent,
                  )}
                </Text>
              </View>
              {role.location?.trim() && (
                <Text style={s.entrySubtext}>{role.location.trim()}</Text>
              )}
              <BulletList bullets={role.bullets} s={s} />
            </View>
          ))}
        </View>
      )}

      {/* ── Education ── */}
      {hasEducation && (
        <View style={s.section}>
          <View style={s.sectionHeadingWrap}>
            <Text style={s.sectionHeading}>Education</Text>
          </View>
          {education.map((edu) => (
            <EducationEntry key={edu.id} edu={edu} s={s} fontScale={theme.fontScale} />
          ))}
        </View>
      )}

      {/* ── Skills (rendered above if skills-first) ── */}
      {isSkillsFirst(data.settings.domain) ? null : skillsBlock}

      {/* ── Languages & Certifications ── */}
      {(hasLanguages || hasCertifications) && (
        <View style={s.twoCol}>
          {hasLanguages && (
            <View style={s.twoColItem}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Languages</Text>
              </View>
              <Text style={s.body}>
                {data.languages.map((lang, i, arr) => (
                  <Text key={lang.id}>
                    <Text style={{ fontFamily: fonts.bold, fontWeight: 700 }}>
                      {lang.name}
                    </Text>
                    {lang.level
                      ? ` — ${formatLanguageLevel(lang.level)}`
                      : ""}
                    {i < arr.length - 1 ? "  |  " : ""}
                  </Text>
                ))}
              </Text>
            </View>
          )}
          {hasCertifications && (
            <View style={s.twoColItem}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Certifications</Text>
              </View>
              {data.certifications.map((cert) => (
                <Text key={cert.id} style={{ ...s.body, marginBottom: 2 }}>
                  <Text style={{ fontFamily: fonts.bold, fontWeight: 700 }}>
                    {cert.name.trim()}
                  </Text>
                  <Text style={{ color: SLATE_500 }}>
                    {cert.issuer ? ` | ${cert.issuer.trim()}` : ""}
                    {cert.date ? ` | ${cert.date.trim()}` : ""}
                  </Text>
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Projects ── */}
      {hasProjects && (
        <View style={s.section}>
          <View style={s.sectionHeadingWrap}>
            <Text style={s.sectionHeading}>Projects</Text>
          </View>
          {projects.map((project) => {
            const showLink = shouldShowProjectLink(project.link);
            return (
              <View key={project.id} style={s.entryBlock} wrap={false}>
                <Text style={s.entryTitle}>
                  {project.name?.trim() || "Project"}
                  {showLink ? (
                    <Text style={{ ...s.entryCompany, color: SLATE_500 }}>
                      {" | "}
                      <Link
                        src={normalizeHref(project.link)}
                        style={{
                          ...s.entryCompany,
                          color: SLATE_500,
                          textDecoration: "underline",
                        }}
                      >
                        {project.link?.trim()}
                      </Link>
                    </Text>
                  ) : null}
                </Text>
                <BulletList bullets={project.bullets ?? []} s={s} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   EXECUTIVE PDF LAYOUT
   ═══════════════════════════════════════════════════════════ */

const ExecutivePDFLayout = ({ data }: { data: CvData }) => {
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasSummary = Boolean(data.personal.summary?.trim());
  const experience = meaningfulExperience(data.experience);
  const hasExperience = experience.length > 0;
  const education = meaningfulEducation(data.education);
  const hasEducation = education.length > 0;
  const projects = meaningfulProjects(data.projects);
  const hasProjects = projects.length > 0;
  const theme = resolveTheme(data.settings, "#1E2A4A");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const m = theme.marginScale;
  const { onAccent, onAccentMuted } = theme;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

  // Build sidebar contact lines — plain text label prefixes (no emoji — unreliable in react-pdf)
  const sidebarContacts: Array<{
    text: string;
    href?: string;
    fontSize?: number;
  }> = [];
  if (data.personal.email?.trim()) {
    const email = data.personal.email.trim();
    sidebarContacts.push({
      text: `Email: ${email}`,
      href: `mailto:${email}`,
      // Long emails must stay one unbroken string (ATS) — shrink to fit the narrow column.
      fontSize: email.length > 26 ? 6.2 * theme.fontScale : undefined,
    });
  }
  if (data.personal.phone?.trim())
    sidebarContacts.push({
      text: `Tel: ${data.personal.phone.trim()}`,
      href: `tel:${data.personal.phone.trim()}`,
    });
  if (data.personal.location?.trim())
    sidebarContacts.push({
      text: `Location: ${data.personal.location.trim()}`,
    });
  if (data.personal.linkedin?.trim())
    sidebarContacts.push({
      text: `LinkedIn: ${shortenDisplayUrl(data.personal.linkedin)}`,
      href: normalizeHref(data.personal.linkedin),
    });
  if (data.personal.website?.trim())
    sidebarContacts.push({
      text: `Web: ${shortenDisplayUrl(data.personal.website)}`,
      href: normalizeHref(data.personal.website),
    });
  if (data.personal.dateOfBirth?.trim())
    sidebarContacts.push({ text: `DOB: ${data.personal.dateOfBirth.trim()}` });

  const essentialChips = getEssentialChips(data.personal);

  return (
    <>
      {/* The navy band is its own fixed, absolutely positioned layer so it
          covers every page edge to edge. As the sidebar View's background it
          left a 27pt white notch on page 2+ (audit 2026-10). Yoga places an
          absolute child against the parent's padding edge, so 0/0/0 on a
          direct child of the Page reaches the physical page edges. */}
      <View
        fixed
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 150,
          backgroundColor: theme.accent,
        }}
      />
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Sidebar (transparent; the fixed band above is its fill) ── */}
      <View style={s.execSidebar}>
        {/* Photo */}
        {showPhoto && data.personal.photo && (
          <View style={{ marginBottom: 12 }}>
            <Image
              src={data.personal.photo}
              style={{
                width: 64,
                height: 64,
                borderRadius:
                  data.settings.photoShape === "square" ? 6 : 32,
                objectFit: "cover",
                borderWidth: 1.5,
                borderColor: mix(onAccent, theme.accent, 0.8),
              }}
            />
          </View>
        )}

        {/* Name — stacked first/last lines (mirrors live executive) */}
        {data.personal.firstName?.trim() || data.personal.lastName?.trim() ? (
          <>
            {data.personal.firstName?.trim() ? (
              <Text style={{ ...s.execName, color: onAccent }}>{data.personal.firstName.trim()}</Text>
            ) : null}
            {data.personal.lastName?.trim() ? (
              <Text style={{ ...s.execName, color: onAccent }}>{data.personal.lastName.trim()}</Text>
            ) : null}
          </>
        ) : (
          <Text style={{ ...s.execName, color: onAccent }}>Your Name</Text>
        )}

        {/* Headline */}
        {data.personal.headline?.trim() ? (
          <Text style={{ ...s.execHeadline, color: onAccentMuted, borderBottomColor: mix(onAccent, theme.accent, 0.85) }}>{data.personal.headline.trim()}</Text>
        ) : null}

        {/* Contact */}
        {sidebarContacts.length > 0 && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>CONTACT</Text>
            {sidebarContacts.map((item, i) =>
              item.href ? (
                <Link
                  key={i}
                  src={item.href}
                  style={{
                    ...s.execContactItem,
                    color: onAccentMuted,
                    textDecoration: "underline",
                    ...(item.fontSize ? { fontSize: item.fontSize } : {}),
                  }}
                >
                  {item.text}
                </Link>
              ) : (
                <Text
                  key={i}
                  style={{
                    ...s.execContactItem,
                    color: onAccentMuted,
                    ...(item.fontSize ? { fontSize: item.fontSize } : {}),
                  }}
                >
                  {item.text}
                </Text>
              ),
            )}
          </View>
        )}

        {/* Personal */}
        {essentialChips.length > 0 && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>PERSONAL</Text>
            {essentialChips.map((chip) => (
              <Text key={chip.label} style={{ ...s.execContactItem, color: onAccentMuted }}>
                {chip.label}: {chip.value}
              </Text>
            ))}
          </View>
        )}

        {/* Skills */}
        {hasSkills && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>SKILLS</Text>
            {data.skills.map((skill) => (
              <Text key={skill.id} style={{ ...s.execSkillItem, color: onAccentMuted }}>
                <Text style={{ color: onAccentMuted }}>{"·  "}</Text>
                {skill.name}
              </Text>
            ))}
          </View>
        )}

        {/* Languages */}
        {hasLanguages && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>LANGUAGES</Text>
            {data.languages.map((lang) => (
              <Text key={lang.id} style={{ ...s.execSkillItem, color: onAccentMuted }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700 }}>
                  {lang.name}
                </Text>
                {lang.level
                  ? ` — ${formatLanguageLevel(lang.level)}`
                  : ""}
              </Text>
            ))}
          </View>
        )}

        {/* Certifications */}
        {hasCertifications && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>CERTIFICATIONS</Text>
            {data.certifications.map((cert) => (
              <View key={cert.id} style={{ marginBottom: 4 }}>
                <Text
                  style={{
                    fontSize: 7.5 * theme.fontScale,
                    fontFamily: fonts.bold, fontWeight: 700,
                    color: onAccent,
                    lineHeight: 1.4 * theme.lineScale,
                  }}
                >
                  {cert.name.trim()}
                </Text>
                {(cert.issuer || cert.date) && (
                  <Text
                    style={{
                      fontSize: 7 * theme.fontScale,
                      color: onAccentMuted,
                      lineHeight: 1.4 * theme.lineScale,
                    }}
                  >
                    {[cert.issuer?.trim(), cert.date?.trim()]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Main column ── */}
      <View style={{ flex: 1, paddingLeft: 20 * m }}>
        {/* Summary */}
        {hasSummary && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Summary</Text>
            </View>
            <Text style={s.body}>{data.personal.summary?.trim()}</Text>
          </View>
        )}

        {/* Experience */}
        {hasExperience && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Experience</Text>
            </View>
            {experience.map((role) => (
              <View key={role.id} style={s.entryBlock} minPresenceAhead={48}>
                <View style={s.entryRow}>
                  <Text style={{ ...s.entryTitle, flex: 1 }}>
                    {role.role?.trim() || "Role"}
                    {role.company ? (
                      <Text style={s.entryCompany}>
                        {` | ${role.company.trim()}`}
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={s.entryDate}>
                    {formatDateRange(
                      role.startDate,
                      role.endDate,
                      role.isCurrent,
                    )}
                  </Text>
                </View>
                {role.location?.trim() && (
                  <Text style={s.entrySubtext}>{role.location.trim()}</Text>
                )}
                <BulletList bullets={role.bullets} s={s} />
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {hasEducation && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Education</Text>
            </View>
            {education.map((edu) => (
              <EducationEntry key={edu.id} edu={edu} s={s} fontScale={theme.fontScale} />
            ))}
          </View>
        )}

        {/* Projects */}
        {hasProjects && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Projects</Text>
            </View>
            {projects.map((project) => {
              const showLink = shouldShowProjectLink(project.link);
              return (
                <View key={project.id} style={s.entryBlock} wrap={false}>
                  <Text style={s.entryTitle}>
                    {project.name?.trim() || "Project"}
                    {showLink ? (
                      <Text style={{ ...s.entryCompany, color: SLATE_500 }}>
                        {" | "}
                        <Link
                          src={normalizeHref(project.link)}
                          style={{
                            ...s.entryCompany,
                            color: theme.accentText,
                            textDecoration: "none",
                          }}
                        >
                          {project.link?.trim()}
                        </Link>
                      </Text>
                    ) : null}
                  </Text>
                  <BulletList bullets={project.bullets ?? []} s={s} />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════
   ATS CLEAN PDF LAYOUT
   ═══════════════════════════════════════════════════════════ */

const ATSCleanPDFLayout = ({ data }: { data: CvData }) => {
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";

  // Contact line — plain text only, no emoji, separated by middle dot
  const contactParts: Array<{ text: string; href?: string }> = [];
  if (data.personal.email?.trim())
    contactParts.push({
      text: data.personal.email.trim(),
      href: `mailto:${data.personal.email.trim()}`,
    });
  if (data.personal.phone?.trim())
    contactParts.push({
      text: data.personal.phone.trim(),
      href: `tel:${data.personal.phone.trim()}`,
    });
  if (data.personal.location?.trim())
    contactParts.push({ text: data.personal.location.trim() });
  if (data.personal.linkedin?.trim())
    contactParts.push({
      text: shortenDisplayUrl(data.personal.linkedin),
      href: normalizeHref(data.personal.linkedin),
    });
  if (data.personal.website?.trim())
    contactParts.push({
      text: shortenDisplayUrl(data.personal.website),
      href: normalizeHref(data.personal.website),
    });
  if (data.personal.dateOfBirth?.trim())
    contactParts.push({ text: `DOB: ${data.personal.dateOfBirth.trim()}` });

  const essentialChips = getEssentialChips(data.personal);
  const essentialsLine = essentialChips
    .map((c) => `${c.label}: ${c.value}`)
    .join(" · ");

  const hasSummary = Boolean(data.personal.summary?.trim());
  const experience = meaningfulExperience(data.experience);
  const hasExperience = experience.length > 0;
  const education = meaningfulEducation(data.education);
  const hasEducation = education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const projects = meaningfulProjects(data.projects);
  const hasProjects = projects.length > 0;
  const theme = resolveTheme(data.settings, "#111827");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

  // atsSectionHeading already has marginTop: 16 baked in.
  // Override first section to marginTop: 0 via inline style.
  const skillsFirst = isSkillsFirst(data.settings.domain);
  const firstSection = hasSummary
    ? "summary"
    : skillsFirst && hasSkills
      ? "skills"
      : hasExperience
        ? "experience"
        : hasEducation
          ? "education"
          : hasSkills
            ? "skills"
            : hasLanguages
              ? "languages"
              : hasCertifications
                ? "certifications"
                : hasProjects
                  ? "projects"
                  : null;

  const headingStyle = (id: string) =>
    firstSection === id
      ? { ...s.atsSectionHeading, marginTop: 0 }
      : s.atsSectionHeading;

  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );
  const skillsBlock =
    generalSkills.length > 0 || technicalSkills.length > 0 ? (
      <>
        {generalSkills.length > 0 && (
          <View>
            <Text style={headingStyle("skills")}>Skills</Text>
            <Text style={{ ...s.body, color: "#374151" }}>
              {generalSkills.map((sk) => sk.name).join(" · ")}
            </Text>
          </View>
        )}
        {technicalSkills.length > 0 && (
          <View>
            <Text
              style={
                generalSkills.length === 0
                  ? headingStyle("skills")
                  : s.atsSectionHeading
              }
            >
              Technical Skills
            </Text>
            <Text style={{ ...s.body, color: "#374151" }}>
              {technicalSkills.map((sk) => sk.name).join(" · ")}
            </Text>
          </View>
        )}
      </>
    ) : null;

  return (
    <View>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          marginBottom: 6,
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ marginBottom: 6 }}>
            <Text style={{ ...s.atsName, lineHeight: 1 * theme.lineScale }}>{name}</Text>
          </View>
          {data.personal.headline?.trim() ? (
            <View style={{ marginBottom: 4 }}>
              <Text style={{ ...s.atsHeadline, lineHeight: 1.2 * theme.lineScale }}>
                {data.personal.headline.trim()}
              </Text>
            </View>
          ) : null}
          {contactParts.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {contactParts.map((item, i) => (
                <View key={i} style={{ flexDirection: "row" }}>
                  {item.href ? (
                    <Link
                      src={item.href}
                      style={{ ...s.atsContactLine, textDecoration: "none" }}
                    >
                      {item.text}
                    </Link>
                  ) : (
                    <Text style={s.atsContactLine}>{item.text}</Text>
                  )}
                  {i < contactParts.length - 1 && (
                    <Text style={{ ...s.atsContactLine, marginHorizontal: 3 }}>
                      ·
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
          {essentialsLine && (
            <Text style={{ ...s.atsContactLine, color: "#374151", marginTop: 2 }}>
              {essentialsLine}
            </Text>
          )}
        </View>
        {showPhoto && data.personal.photo && (
          <Image
            src={data.personal.photo}
            style={{
              width: 54,
              height: 54,
              borderRadius:
                data.settings.photoShape === "square" ? 4 : 27,
              objectFit: "cover",
              borderWidth: 0.75,
              borderColor: "#E5E7EB",
            }}
          />
        )}
      </View>
      <View style={{ ...s.atsDivider, borderBottomColor: theme.accentText }} />

      {/* ── Summary ── */}
      {hasSummary && (
        <View>
          <Text style={headingStyle("summary")}>Summary</Text>
          <Text style={{ ...s.body, color: "#374151", lineHeight: 1.6 * theme.lineScale }}>
            {data.personal.summary?.trim()}
          </Text>
        </View>
      )}

      {/* ── Skills (hoisted above experience for skills-first domains) ── */}
      {skillsFirst ? skillsBlock : null}

      {/* ── Experience ── */}
      {hasExperience && (
        <View>
          <Text style={headingStyle("experience")}>Experience</Text>
          {experience.map((role) => (
            <View key={role.id} style={{ marginBottom: 9 * theme.spaceScale }} minPresenceAhead={48}>
              <View style={s.entryRow}>
                <Text
                  style={{
                    fontFamily: fonts.bold, fontWeight: 700,
                    fontSize: 8.6 * theme.fontScale,
                    color: "#111827",
                  }}
                >
                  {role.role?.trim() || "Role"}
                </Text>
                <Text
                  style={{
                    fontSize: 7.8 * theme.fontScale,
                    color: "#6B7280",
                    flexShrink: 0,
                    paddingLeft: 6,
                  }}
                >
                  {formatDateRange(
                    role.startDate,
                    role.endDate,
                    role.isCurrent,
                  )}
                </Text>
              </View>
              {(role.company || role.location) && (
                <Text
                  style={{
                    fontSize: 8.25 * theme.fontScale,
                    color: "#374151",
                    marginTop: 1,
                    marginBottom: 3,
                  }}
                >
                  {role.company?.trim() || ""}
                  {role.company?.trim() && role.location?.trim() ? " · " : ""}
                  {role.location?.trim() || ""}
                </Text>
              )}
              <BulletList bullets={role.bullets} s={s} />
            </View>
          ))}
        </View>
      )}

      {/* ── Education ── */}
      {hasEducation && (
        <View>
          <Text style={headingStyle("education")}>Education</Text>
          {education.map((edu) => (
            <EducationEntry
              key={edu.id}
              edu={edu}
              s={s}
              fontScale={theme.fontScale}
              headingStyle={{
                fontFamily: fonts.bold, fontWeight: 700,
                fontSize: 8.6 * theme.fontScale,
                color: "#111827",
              }}
            />
          ))}
        </View>
      )}

      {/* ── Skills (rendered above if skills-first) ── */}
      {skillsFirst ? null : skillsBlock}

      {/* ── Languages ── */}
      {hasLanguages && (
        <View>
          <Text style={headingStyle("languages")}>Languages</Text>
          <Text style={{ ...s.body, color: "#374151" }}>
            {data.languages.map((lang, i, arr) => (
              <Text key={lang.id}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700 }}>
                  {lang.name}
                </Text>
                {lang.level
                  ? ` — ${formatLanguageLevel(lang.level)}`
                  : ""}
                {i < arr.length - 1 ? " · " : ""}
              </Text>
            ))}
          </Text>
        </View>
      )}

      {/* ── Certifications ── */}
      {hasCertifications && (
        <View>
          <Text style={headingStyle("certifications")}>Certifications</Text>
          {data.certifications.map((cert) => (
            <Text
              key={cert.id}
              style={{ ...s.body, color: "#374151", marginBottom: 3 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontWeight: 700 }}>
                {cert.name.trim()}
              </Text>
              {cert.issuer ? ` · ${cert.issuer.trim()}` : ""}
              {cert.date ? ` · ${cert.date.trim()}` : ""}
            </Text>
          ))}
        </View>
      )}

      {/* ── Projects ── */}
      {hasProjects && (
        <View>
          <Text style={headingStyle("projects")}>Projects</Text>
          {projects.map((project) => {
            const showLink = shouldShowProjectLink(project.link);
            return (
              <View key={project.id} style={{ marginBottom: 8 * theme.spaceScale }} wrap={false}>
                <Text
                  style={{
                    fontFamily: fonts.bold, fontWeight: 700,
                    fontSize: 8.6 * theme.fontScale,
                    color: "#111827",
                  }}
                >
                  {project.name?.trim() || "Project"}
                </Text>
                {showLink && (
                  <Text
                    style={{
                      fontSize: 7.5 * theme.fontScale,
                      color: "#6B7280",
                      marginTop: 1,
                    }}
                  >
                    {"("}
                    <Link
                      src={normalizeHref(project.link)}
                      style={{
                        fontSize: 7.5 * theme.fontScale,
                        color: "#6B7280",
                        textDecoration: "none",
                      }}
                    >
                      {project.link!.trim()}
                    </Link>
                    {")"}
                  </Text>
                )}
                <BulletList bullets={project.bullets ?? []} s={s} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   MODERN PDF LAYOUT
   ═══════════════════════════════════════════════════════════ */
/*
 * Mirrors lib/templates/modern.tsx section by section (2026-10-24 parity
 * fix — the download used to be a single-column "Summary" stack that shared
 * nothing but the data with the preview). A padded page (the router scales
 * the 27/24pt padding with Page Margins), a header closed by a slate-200
 * rule, then a TWO-COLUMN body: main column Profile > Experience (bordered,
 * rounded cards) > Languages > Certifications > Projects, and a 150pt aside
 * (the live 200px) holding Education > Skills (chips). Modern hardcodes
 * emerald/slate exactly like the live file and does not use the theme
 * accent; parity with the preview is the goal, not a redesign.
 *
 * px → pt at 0.75: name 30px → 22.5pt, body 14px → 10.5pt, small 12px → 9pt,
 * essentials chip 10px/9px → 7.5/6.75pt, gaps 16/12/8/4px → 12/9/6/3pt.
 * Line-heights are the live ratios (36/30, 20/14, 16/12, 1.375). Density:
 * fontScale on every size (and on the em-based letter-spacing), lineScale on
 * every line-height, spaceScale ONLY on the gaps between sections — the live
 * template's --sp — and marginScale on the page padding via the router.
 * Tailwind semibold → the 700 cut (the PDF faces ship 400/700 only).
 */

const MODERN_SLATE_100 = "#F1F5F9";
const MODERN_EMERALD_50 = "#ECFDF5";
const MODERN_EMERALD_200 = "#A7F3D0";
const MODERN_EMERALD_700 = "#047857";
const MODERN_GREEN_700 = "#15803D";

/** list-disc pl-5: text starts 15pt in, the marker sits in that gutter in the
 *  list's own colour, no gap between items (the live <ul> has no space-y). */
const ModernBullets = ({
  items,
  style,
  marginTop = 0,
}: {
  items: string[];
  style: Style;
  marginTop?: number;
}) => {
  const bullets = items.map((b) => b.trim()).filter(Boolean);
  if (bullets.length === 0) return null;
  return (
    <View style={{ marginTop, paddingLeft: 6 }}>
      {bullets.map((bullet, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          <Text style={{ ...style, width: 9 }}>•</Text>
          <Text style={{ ...style, flex: 1 }}>{bullet}</Text>
        </View>
      ))}
    </View>
  );
};

/** h2 with the live `avoid-orphan` intent: never leave a heading alone at the
 *  foot of a page — break before it unless ~36pt of its section follows. */
const ModernHeading = ({ children, style }: { children: string; style: Style }) => (
  <Text style={style} minPresenceAhead={36}>
    {children}
  </Text>
);

const ModernPDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, "#1e5b54");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  // mt-[calc(1.5rem*var(--sp))] / space-y-[calc(1.5rem*var(--sp))] = 24px → 18pt
  const sectionGap = 18 * theme.spaceScale;
  // The live name is set in the display face (`font-display` → Bricolage)
  // whatever body face the user picked; do the same once the faces are
  // registered, falling back to the bold body face (Node / registration failed).
  const nameFont = pdfFontsReady() ? PDF_FAMILY.display : fonts.bold;

  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = experience.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = projects.length > 0;
  const hasEducation = education.length > 0;
  const hasSkills = data.skills.length > 0;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const essentialChips = getEssentialChips(data.personal);

  // Live order: email, phone, location, website, linkedin, DOB — no "|"
  // separators, a 16px/4px wrap gap instead.
  type ContactItem = { text: string; href?: string };
  const contacts: ContactItem[] = [];
  if (data.personal.email?.trim())
    contacts.push({
      text: data.personal.email.trim(),
      href: `mailto:${data.personal.email.trim()}`,
    });
  if (data.personal.phone?.trim())
    contacts.push({
      text: data.personal.phone.trim(),
      href: `tel:${data.personal.phone.trim()}`,
    });
  if (data.personal.location?.trim())
    contacts.push({ text: data.personal.location.trim() });
  if (data.personal.website?.trim())
    contacts.push({
      text: shortenDisplayUrl(data.personal.website),
      href: normalizeHref(data.personal.website),
    });
  if (data.personal.linkedin?.trim())
    contacts.push({
      text: shortenDisplayUrl(data.personal.linkedin),
      href: normalizeHref(data.personal.linkedin),
    });
  if (data.personal.dateOfBirth?.trim())
    contacts.push({ text: `DOB: ${data.personal.dateOfBirth.trim()}` });

  /* ── Modern type scale ── */
  const bold: Style = { fontFamily: fonts.bold, fontWeight: 700 };
  // h2: text-xs/4 font-semibold uppercase tracking-[0.2em] text-slate-500
  const heading: Style = {
    fontSize: 9 * fs,
    lineHeight: (16 / 12) * ls,
    ...bold,
    textTransform: "uppercase",
    letterSpacing: 0.2 * 9 * fs,
    color: SLATE_500,
  };
  // text-sm/5 text-slate-700 — paragraphs, bullets, languages, certs
  const body: Style = {
    fontSize: 10.5 * fs,
    lineHeight: (20 / 14) * ls,
    color: SLATE_700,
  };
  // text-sm/5 font-semibold in the root's slate-900 — role, school, project
  const bodyStrong: Style = { ...body, ...bold, color: SLATE_900 };
  // text-xs/4 text-slate-500 — contact, company line, degree line
  const small: Style = {
    fontSize: 9 * fs,
    lineHeight: (16 / 12) * ls,
    color: SLATE_500,
  };

  // space-y only separates sections that are present, so the first rendered
  // section in each column gets no top margin whichever one it is.
  const present: Record<string, boolean> = {
    profile: hasSummary,
    experience: hasExperience,
    languages: hasLanguages,
    certifications: hasCertifications,
    projects: hasProjects,
    education: hasEducation,
    skills: hasSkills,
  };
  const mainOrder = [
    "profile",
    "experience",
    "languages",
    "certifications",
    "projects",
  ].filter((k) => present[k]);
  const asideOrder = ["education", "skills"].filter((k) => present[k]);
  const gapFor = (order: string[], key: string): Style =>
    order[0] === key ? {} : { marginTop: sectionGap };

  return (
    <View>
      {/* ── Header: border-b border-slate-200 pb-4, flex gap-4 ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          borderBottomWidth: 0.75,
          borderBottomColor: SLATE_200,
          paddingBottom: 12,
        }}
      >
        {/* flex-col gap-2 */}
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            style={{
              fontSize: 22.5 * fs,
              lineHeight: 1.2 * ls,
              fontFamily: nameFont,
              fontWeight: 700,
              letterSpacing: -0.025 * 22.5 * fs,
              color: SLATE_900,
            }}
          >
            {name}
          </Text>
          {headline ? (
            <Text
              style={{
                fontSize: 10.5 * fs,
                lineHeight: (20 / 14) * ls,
                color: SLATE_500,
              }}
            >
              {headline}
            </Text>
          ) : null}
          {contacts.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                columnGap: 12,
                rowGap: 3,
              }}
            >
              {contacts.map((item, i) =>
                item.href ? (
                  <Link
                    key={i}
                    src={item.href}
                    style={{ ...small, textDecoration: "underline" }}
                  >
                    {item.text}
                  </Link>
                ) : (
                  <Text key={i} style={small}>
                    {item.text}
                  </Text>
                ),
              )}
            </View>
          )}
          {essentialChips.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 4.5,
                marginTop: 3,
              }}
            >
              {essentialChips.map((chip) => (
                <View
                  key={chip.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    borderWidth: 0.75,
                    borderColor: MODERN_EMERALD_200,
                    backgroundColor: MODERN_EMERALD_50,
                    borderRadius: 999,
                    paddingHorizontal: 6,
                    paddingVertical: 1.5,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 6.75 * fs,
                      lineHeight: 1.375 * ls,
                      ...bold,
                      textTransform: "uppercase",
                      letterSpacing: 0.05 * 6.75 * fs,
                      color: MODERN_EMERALD_700,
                    }}
                  >
                    {chip.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 7.5 * fs,
                      lineHeight: 1.375 * ls,
                      color: SLATE_700,
                    }}
                  >
                    {chip.value}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {showPhoto && data.personal.photo && (
          <Image
            src={data.personal.photo}
            style={{
              width: 60,
              height: 60,
              borderRadius: data.settings.photoShape === "square" ? 6 : 30,
              objectFit: "cover",
              borderWidth: 1.5,
              borderColor: SLATE_200,
            }}
          />
        )}
      </View>

      {/* ── Body: grid-cols-[2fr_1fr] gap-8 → main column + 150pt aside ── */}
      <View style={{ flexDirection: "row", gap: 24, marginTop: sectionGap }}>
        {/* ── Main column ── */}
        <View style={{ flex: 2 }}>
          {hasSummary && (
            <View style={gapFor(mainOrder, "profile")}>
              <ModernHeading style={heading}>Profile</ModernHeading>
              <Text style={{ ...body, marginTop: 6 }}>
                {data.personal.summary?.trim()}
              </Text>
            </View>
          )}

          {hasExperience && (
            <View style={gapFor(mainOrder, "experience")}>
              <ModernHeading style={heading}>Experience</ModernHeading>
              {/* mt-3 space-y-4; each role is a rounded-xl bordered card */}
              <View style={{ marginTop: 9 }}>
                {experience.map((role, i) => {
                  const company = role.company?.trim() || "";
                  const location = role.location?.trim() || "";
                  const subline =
                    company && location
                      ? `${company} - ${location}`
                      : company || location;
                  return (
                    <View
                      key={role.id}
                      minPresenceAhead={48}
                      style={{
                        marginTop: i > 0 ? 12 : 0,
                        borderWidth: 0.75,
                        borderColor: SLATE_200,
                        borderRadius: 9,
                        padding: 9,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                        }}
                      >
                        <Text style={{ ...bodyStrong, flex: 1 }}>
                          {role.role?.trim() || "Role"}
                        </Text>
                        {/* the date span inherits the row's font-semibold */}
                        <Text
                          style={{
                            ...small,
                            ...bold,
                            color: SLATE_400,
                            flexShrink: 0,
                          }}
                        >
                          {formatDateRange(
                            role.startDate,
                            role.endDate,
                            role.isCurrent,
                          )}
                        </Text>
                      </View>
                      {subline ? <Text style={small}>{subline}</Text> : null}
                      <ModernBullets
                        items={role.bullets}
                        style={body}
                        marginTop={6}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {hasLanguages && (
            <View style={gapFor(mainOrder, "languages")}>
              <ModernHeading style={heading}>Languages</ModernHeading>
              {/* mt-3 space-y-2 */}
              <View style={{ marginTop: 9 }}>
                {data.languages.map((lang, i) => (
                  <Text
                    key={lang.id}
                    style={{ ...body, marginTop: i > 0 ? 6 : 0 }}
                  >
                    <Text style={bold}>{lang.name}</Text>
                    {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {hasCertifications && (
            <View style={gapFor(mainOrder, "certifications")}>
              <ModernHeading style={heading}>Certifications</ModernHeading>
              {/* mt-3 space-y-2 */}
              <View style={{ marginTop: 9 }}>
                {data.certifications.map((cert, i) => {
                  const meta = [cert.issuer?.trim(), cert.date?.trim()]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Text
                      key={cert.id}
                      style={{ ...body, marginTop: i > 0 ? 6 : 0 }}
                    >
                      {cert.name.trim()}
                      {meta ? ` — ${meta}` : ""}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}

          {hasProjects && (
            <View style={gapFor(mainOrder, "projects")}>
              {projects.map((project, index) => {
                const bullets = (project.bullets ?? [])
                  .map((b) => b.trim())
                  .filter(Boolean);
                const [firstBullet, ...remainingBullets] = bullets;
                const showLink = shouldShowProjectLink(project.link);
                return (
                  <View key={project.id}>
                    {/* keep-with-next: heading (first project), title and
                        first bullet stay on one page; the rest may break */}
                    <View wrap={false}>
                      {index === 0 ? (
                        <ModernHeading style={heading}>Projects</ModernHeading>
                      ) : null}
                      <Text style={{ ...bodyStrong, marginTop: 9 }}>
                        {project.name?.trim() || "Project"}
                        {showLink ? (
                          <Link
                            src={normalizeHref(project.link)}
                            style={{ ...bodyStrong, textDecoration: "underline" }}
                          >
                            {` - ${project.link?.trim()}`}
                          </Link>
                        ) : null}
                      </Text>
                      {firstBullet ? (
                        <ModernBullets items={[firstBullet]} style={body} />
                      ) : null}
                    </View>
                    {remainingBullets.length > 0 ? (
                      <ModernBullets items={remainingBullets} style={body} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Aside (live: 200px, flex-shrink 0) ── */}
        <View style={{ width: 150, flexShrink: 0 }}>
          {hasEducation && (
            <View style={gapFor(asideOrder, "education")}>
              <ModernHeading style={heading}>Education</ModernHeading>
              {/* mt-3 space-y-3 */}
              <View style={{ marginTop: 9 }}>
                {education.map((edu, i) => {
                  const dates = formatDateRange(edu.startDate, edu.endDate);
                  const attestedBy = edu.attested
                    ? edu.attestingBody?.trim() || ""
                    : "";
                  const field = edu.field?.trim();
                  return (
                    <View
                      key={edu.id}
                      wrap={false}
                      style={{ marginTop: i > 0 ? 9 : 0 }}
                    >
                      <Text style={bodyStrong}>
                        {edu.school?.trim() || "School"}
                      </Text>
                      <Text style={small}>
                        {edu.degree?.trim() || "Degree"}
                        {field ? ` - ${field}` : ""}
                      </Text>
                      {dates ? (
                        <Text style={{ ...small, color: SLATE_400 }}>{dates}</Text>
                      ) : null}
                      {attestedBy ? (
                        <Text
                          style={{
                            ...small,
                            color: MODERN_GREEN_700,
                            marginTop: 1.5,
                          }}
                        >
                          {`✓ Attested — ${attestedBy}`}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {hasSkills && (
            <View style={gapFor(asideOrder, "skills")}>
              <ModernHeading style={heading}>Skills</ModernHeading>
              {/* mt-3 flex-wrap gap-2; rounded-full bg-slate-100 px-3 py-1 */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 9,
                }}
              >
                {data.skills.map((skill) => (
                  <Text
                    key={skill.id}
                    style={{
                      fontSize: 9 * fs,
                      lineHeight: (16 / 12) * ls,
                      color: SLATE_900,
                      backgroundColor: MODERN_SLATE_100,
                      borderRadius: 999,
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                    }}
                  >
                    {skill.name}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   EXEC SPLIT PDF LAYOUT
   ═══════════════════════════════════════════════════════════ */

const ExecSplitPDFLayout = ({ data }: { data: CvData }) => {
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";

  const hasSummary = Boolean(data.personal.summary?.trim());
  const experience = meaningfulExperience(data.experience);
  const hasExperience = experience.length > 0;
  const education = meaningfulEducation(data.education);
  const hasEducation = education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const projects = meaningfulProjects(data.projects);
  const hasProjects = projects.length > 0;

  const contactParts: Array<{ text: string; href?: string }> = [];
  if (data.personal.email?.trim())
    contactParts.push({
      text: data.personal.email.trim(),
      href: `mailto:${data.personal.email.trim()}`,
    });
  if (data.personal.phone?.trim())
    contactParts.push({
      text: data.personal.phone.trim(),
      href: `tel:${data.personal.phone.trim()}`,
    });
  if (data.personal.location?.trim())
    contactParts.push({ text: data.personal.location.trim() });
  if (data.personal.linkedin?.trim())
    contactParts.push({
      text: shortenDisplayUrl(data.personal.linkedin),
      href: normalizeHref(data.personal.linkedin),
    });
  if (data.personal.website?.trim())
    contactParts.push({
      text: shortenDisplayUrl(data.personal.website),
      href: normalizeHref(data.personal.website),
    });
  if (data.personal.dateOfBirth?.trim())
    contactParts.push({ text: `DOB: ${data.personal.dateOfBirth.trim()}` });

  const essentialChips = getEssentialChips(data.personal);
  const theme = resolveTheme(data.settings, "#1B2A4A");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const { onAccent, onAccentMuted } = theme;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

  return (
    <View>
      {/* ── Dark Header ── */}
      <View
        style={{
          backgroundColor: theme.accent,
          marginTop: -27,
          marginLeft: -24,
          marginRight: -24,
          paddingTop: 24,
          paddingBottom: 20,
          paddingLeft: 30,
          paddingRight: 30,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 20 * theme.fontScale,
              fontFamily: fonts.bold, fontWeight: 700,
              color: onAccent,
              lineHeight: 1.15 * theme.lineScale,
            }}
          >
            {name}
          </Text>
          {data.personal.headline?.trim() ? (
            <Text
              style={{
                fontSize: 9 * theme.fontScale,
                color: onAccentMuted,
                marginTop: 3,
                lineHeight: 1.4 * theme.lineScale,
              }}
            >
              {data.personal.headline.trim()}
            </Text>
          ) : null}
          {contactParts.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 6,
              }}
            >
              {contactParts.map((item, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  {item.href ? (
                    <Link
                      src={item.href}
                      style={{
                        fontSize: 7.5 * theme.fontScale,
                        color: onAccentMuted,
                        lineHeight: 1.6 * theme.lineScale,
                        textDecoration: "underline",
                      }}
                    >
                      {item.text}
                    </Link>
                  ) : (
                    <Text
                      style={{
                        fontSize: 7.5 * theme.fontScale,
                        color: onAccentMuted,
                        lineHeight: 1.6 * theme.lineScale,
                      }}
                    >
                      {item.text}
                    </Text>
                  )}
                  {i < contactParts.length - 1 && (
                    <Text
                      style={{
                        fontSize: 7.5 * theme.fontScale,
                        color: onAccentMuted,
                        lineHeight: 1.6 * theme.lineScale,
                        marginHorizontal: 4,
                      }}
                    >
                      {"\u00B7"}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
          {essentialChips.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                marginTop: 5,
              }}
            >
              {essentialChips.map((chip) => (
                <View
                  key={chip.label}
                  style={{
                    flexDirection: "row",
                    backgroundColor: mix(theme.onAccent, theme.accent, 0.9),
                    borderRadius: 8,
                    paddingTop: 1,
                    paddingBottom: 1,
                    paddingLeft: 5,
                    paddingRight: 6,
                    marginRight: 4,
                    marginBottom: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 7 * theme.fontScale,
                      color: onAccentMuted,
                      fontFamily: fonts.bold, fontWeight: 700,
                      marginRight: 3,
                    }}
                  >
                    {chip.label}
                  </Text>
                  <Text style={{ fontSize: 7 * theme.fontScale, color: onAccentMuted }}>
                    {chip.value}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {showPhoto && data.personal.photo && (
          <Image
            src={data.personal.photo}
            style={{
              width: 52,
              height: 52,
              borderRadius:
                data.settings.photoShape === "square" ? 6 : 26,
              objectFit: "cover",
              marginLeft: 12,
              borderWidth: 1.5,
              borderColor: mix(theme.onAccent, theme.accent, 0.75),
            }}
          />
        )}
      </View>

      {/* ── Two-column body ── */}
      <View style={{ flexDirection: "row", marginTop: 14, gap: 18 }}>
        {/* Left — main */}
        <View style={{ flex: 1 }}>
          {hasExperience && (
            <View>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Experience</Text>
              </View>
              {experience.map((role) => (
                <View key={role.id} style={s.entryBlock} minPresenceAhead={48}>
                  <View style={s.entryRow}>
                    <Text style={{ ...s.entryTitle, flex: 1 }}>
                      {role.role?.trim() || "Role"}
                      {role.company ? (
                        <Text style={s.entryCompany}>
                          {` | ${role.company.trim()}`}
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={s.entryDate}>
                      {formatDateRange(
                        role.startDate,
                        role.endDate,
                        role.isCurrent,
                      )}
                    </Text>
                  </View>
                  {role.location?.trim() && (
                    <Text style={s.entrySubtext}>{role.location.trim()}</Text>
                  )}
                  <BulletList bullets={role.bullets} s={s} />
                </View>
              ))}
            </View>
          )}

          {hasEducation && (
            <View style={hasExperience ? s.section : undefined}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Education</Text>
              </View>
              {education.map((edu) => (
                <EducationEntry key={edu.id} edu={edu} s={s} fontScale={theme.fontScale} />
              ))}
            </View>
          )}

          {hasProjects && (
            <View style={s.section}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Projects</Text>
              </View>
              {projects.map((project) => {
                const showLink = shouldShowProjectLink(project.link);
                return (
                  <View key={project.id} style={s.entryBlock} wrap={false}>
                    <Text style={s.entryTitle}>
                      {project.name?.trim() || "Project"}
                      {showLink ? (
                        <Text style={{ ...s.entryCompany, color: SLATE_500 }}>
                          {" | "}
                          <Link
                            src={normalizeHref(project.link)}
                            style={{
                              ...s.entryCompany,
                              color: SLATE_500,
                              textDecoration: "underline",
                            }}
                          >
                            {project.link?.trim()}
                          </Link>
                        </Text>
                      ) : null}
                    </Text>
                    <BulletList bullets={project.bullets ?? []} s={s} />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Right — sidebar content */}
        <View style={{ width: 140, flexShrink: 0 }}>
          {hasSummary && (
            <View>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Summary</Text>
              </View>
              <Text style={{ ...s.body, fontSize: 8 * theme.fontScale }}>
                {data.personal.summary?.trim()}
              </Text>
            </View>
          )}

          {hasSkills && (
            <View style={hasSummary ? s.section : undefined}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Skills</Text>
              </View>
              <Text style={{ ...s.body, fontSize: 8 * theme.fontScale }}>
                {data.skills.map((sk) => sk.name).join(", ")}
              </Text>
            </View>
          )}

          {hasLanguages && (
            <View style={s.section}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Languages</Text>
              </View>
              {data.languages.map((lang) => (
                <Text
                  key={lang.id}
                  style={{ fontSize: 8 * theme.fontScale, color: SLATE_700, lineHeight: 1.6 * theme.lineScale }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontWeight: 700 }}>
                    {lang.name}
                  </Text>
                  {lang.level
                    ? ` — ${formatLanguageLevel(lang.level)}`
                    : ""}
                </Text>
              ))}
            </View>
          )}

          {hasCertifications && (
            <View style={s.section}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Certifications</Text>
              </View>
              {data.certifications.map((cert) => (
                <View key={cert.id} style={{ marginBottom: 3 }}>
                  <Text
                    style={{
                      fontSize: 8 * theme.fontScale,
                      fontFamily: fonts.bold, fontWeight: 700,
                      color: SLATE_800,
                    }}
                  >
                    {cert.name.trim()}
                  </Text>
                  {(cert.issuer || cert.date) && (
                    <Text style={{ fontSize: 7.5 * theme.fontScale, color: SLATE_500 }}>
                      {[cert.issuer?.trim(), cert.date?.trim()]
                        .filter(Boolean)
                        .join(" \u00B7 ")}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   CORPORATE SIDEBAR PDF LAYOUT
   ═══════════════════════════════════════════════════════════ */

const CorpSidebarPDFLayout = ({ data }: { data: CvData }) => {
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";

  const hasSummary = Boolean(data.personal.summary?.trim());
  const experience = meaningfulExperience(data.experience);
  const hasExperience = experience.length > 0;
  const education = meaningfulEducation(data.education);
  const hasEducation = education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const projects = meaningfulProjects(data.projects);
  const hasProjects = projects.length > 0;

  const sidebarContacts: Array<{
    label: string;
    value: string;
    href?: string;
    fontSize?: number;
  }> = [];
  if (data.personal.email?.trim()) {
    const email = data.personal.email.trim();
    sidebarContacts.push({
      label: "Email",
      value: email,
      href: `mailto:${email}`,
      // Long emails must stay one unbroken string (ATS) — shrink to fit the narrow column.
      fontSize: email.length > 26 ? 6.2 : undefined,
    });
  }
  if (data.personal.phone?.trim())
    sidebarContacts.push({
      label: "Phone",
      value: data.personal.phone.trim(),
      href: `tel:${data.personal.phone.trim()}`,
    });
  if (data.personal.location?.trim())
    sidebarContacts.push({
      label: "Location",
      value: data.personal.location.trim(),
    });
  if (data.personal.linkedin?.trim())
    sidebarContacts.push({
      label: "LinkedIn",
      value: shortenDisplayUrl(data.personal.linkedin),
      href: normalizeHref(data.personal.linkedin),
    });
  if (data.personal.website?.trim())
    sidebarContacts.push({
      label: "Web",
      value: shortenDisplayUrl(data.personal.website),
      href: normalizeHref(data.personal.website),
    });
  if (data.personal.dateOfBirth?.trim())
    sidebarContacts.push({
      label: "DOB",
      value: data.personal.dateOfBirth.trim(),
    });

  const essentialChips = getEssentialChips(data.personal);
  const theme = resolveTheme(data.settings, "#0F172A");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const m = theme.marginScale;
  const { onAccent, onAccentMuted } = theme;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

  return (
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Left main content ── */}
      <View style={{ flex: 1, paddingRight: 14 * m }}>
        {/* Name header */}
        <View
          style={{
            borderBottomWidth: 1.5,
            borderBottomColor: "#0F172A",
            paddingBottom: 6,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontSize: 20 * theme.fontScale,
              fontFamily: fonts.bold, fontWeight: 700,
              color: "#0F172A",
              lineHeight: 1.15 * theme.lineScale,
            }}
          >
            {name}
          </Text>
          {data.personal.headline?.trim() ? (
            <Text
              style={{
                fontSize: 9 * theme.fontScale,
                color: SLATE_500,
                marginTop: 2,
              }}
            >
              {data.personal.headline.trim()}
            </Text>
          ) : null}
        </View>

        {hasSummary && (
          <View>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Summary</Text>
            </View>
            <Text style={s.body}>{data.personal.summary?.trim()}</Text>
          </View>
        )}

        {hasExperience && (
          <View style={hasSummary ? s.section : undefined}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Experience</Text>
            </View>
            {experience.map((role) => (
              <View key={role.id} style={s.entryBlock} minPresenceAhead={48}>
                <View style={s.entryRow}>
                  <Text style={{ ...s.entryTitle, flex: 1 }}>
                    {role.role?.trim() || "Role"}
                    {role.company ? (
                      <Text style={s.entryCompany}>
                        {` | ${role.company.trim()}`}
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={s.entryDate}>
                    {formatDateRange(
                      role.startDate,
                      role.endDate,
                      role.isCurrent,
                    )}
                  </Text>
                </View>
                {role.location?.trim() && (
                  <Text style={s.entrySubtext}>{role.location.trim()}</Text>
                )}
                <BulletList bullets={role.bullets} s={s} />
              </View>
            ))}
          </View>
        )}

        {hasEducation && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Education</Text>
            </View>
            {education.map((edu) => (
              <EducationEntry key={edu.id} edu={edu} s={s} fontScale={theme.fontScale} />
            ))}
          </View>
        )}

        {hasProjects && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Projects</Text>
            </View>
            {projects.map((project) => {
              const showLink = shouldShowProjectLink(project.link);
              return (
                <View key={project.id} style={s.entryBlock} wrap={false}>
                  <Text style={s.entryTitle}>
                    {project.name?.trim() || "Project"}
                    {showLink ? (
                      <Text style={{ ...s.entryCompany, color: SLATE_500 }}>
                        {" | "}
                        <Link
                          src={normalizeHref(project.link)}
                          style={{
                            ...s.entryCompany,
                            color: SLATE_500,
                            textDecoration: "underline",
                          }}
                        >
                          {project.link?.trim()}
                        </Link>
                      </Text>
                    ) : null}
                  </Text>
                  <BulletList bullets={project.bullets ?? []} s={s} />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── Right dark sidebar ── */}
      <View
        style={{
          width: 155,
          flexShrink: 0,
          backgroundColor: theme.accent,
          marginTop: -27,
          marginBottom: -27,
          marginRight: -24,
          paddingTop: 24,
          paddingBottom: 24,
          paddingLeft: 14,
          paddingRight: 14,
        }}
      >
        {/* Photo */}
        {showPhoto && data.personal.photo && (
          <View
            style={{
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Image
              src={data.personal.photo}
              style={{
                width: 56,
                height: 56,
                borderRadius:
                  data.settings.photoShape === "square" ? 6 : 28,
                objectFit: "cover",
                borderWidth: 1.5,
                borderColor: mix(theme.onAccent, theme.accent, 0.85),
              }}
            />
          </View>
        )}

        {/* Contact */}
        {sidebarContacts.length > 0 && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>CONTACT</Text>
            {sidebarContacts.map((item, i) => (
              <View key={i} style={{ marginBottom: 3 }}>
                <Text
                  style={{
                    fontSize: 6 * theme.fontScale,
                    fontFamily: fonts.bold, fontWeight: 700,
                    // One step quieter than the values beneath (which are
                    // onAccentMuted now) so the label/value hierarchy holds.
                    color: mix(theme.onAccent, theme.accent, 0.55),
                    letterSpacing: 0.4,
                  }}
                >
                  {item.label.toUpperCase()}
                </Text>
                {item.href ? (
                  <Link
                    src={item.href}
                    style={{
                      ...s.execContactItem,
                      // Theme ink, not the base style's #CBD5E1: on light
                      // accents (Sand) the hardcoded grey vanished (audit).
                      color: onAccentMuted,
                      fontSize: (item.fontSize ?? 7.5) * theme.fontScale,
                      textDecoration: "underline",
                    }}
                  >
                    {item.value}
                  </Link>
                ) : (
                  <Text
                    style={{
                      ...s.execContactItem,
                      color: onAccentMuted,
                      fontSize: (item.fontSize ?? 7.5) * theme.fontScale,
                    }}
                  >
                    {item.value}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Personal */}
        {essentialChips.length > 0 && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>PERSONAL</Text>
            {essentialChips.map((chip) => (
              <View key={chip.label} style={{ marginBottom: 3 }}>
                <Text
                  style={{
                    fontSize: 6 * theme.fontScale,
                    fontFamily: fonts.bold, fontWeight: 700,
                    // One step quieter than the values beneath (which are
                    // onAccentMuted now) so the label/value hierarchy holds.
                    color: mix(theme.onAccent, theme.accent, 0.55),
                    letterSpacing: 0.4,
                  }}
                >
                  {chip.label.toUpperCase()}
                </Text>
                <Text style={{ ...s.execContactItem, color: onAccentMuted, fontSize: 7.5 * theme.fontScale }}>
                  {chip.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {hasSkills && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>SKILLS</Text>
            <Text
              style={{
                fontSize: 7.5 * theme.fontScale,
                color: onAccentMuted,
                lineHeight: 1.6 * theme.lineScale,
              }}
            >
              {data.skills.map((sk) => sk.name).join(", ")}
            </Text>
          </View>
        )}

        {/* Languages */}
        {hasLanguages && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>LANGUAGES</Text>
            {data.languages.map((lang) => (
              <Text key={lang.id} style={{ ...s.execSkillItem, color: onAccentMuted }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700 }}>
                  {lang.name}
                </Text>
                {lang.level
                  ? ` — ${formatLanguageLevel(lang.level)}`
                  : ""}
              </Text>
            ))}
          </View>
        )}

        {/* Certifications */}
        {hasCertifications && (
          <View>
            <Text style={{ ...s.execSideLabel, color: onAccentMuted }}>CERTIFICATIONS</Text>
            {data.certifications.map((cert) => (
              <View key={cert.id} style={{ marginBottom: 4 }}>
                <Text
                  style={{
                    fontSize: 7.5 * theme.fontScale,
                    fontFamily: fonts.bold, fontWeight: 700,
                    color: onAccent,
                    lineHeight: 1.4 * theme.lineScale,
                  }}
                >
                  {cert.name.trim()}
                </Text>
                {(cert.issuer || cert.date) && (
                  <Text
                    style={{
                      fontSize: 7 * theme.fontScale,
                      color: onAccentMuted,
                      lineHeight: 1.4 * theme.lineScale,
                    }}
                  >
                    {[cert.issuer?.trim(), cert.date?.trim()]
                      .filter(Boolean)
                      .join(" \u00B7 ")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   PROFESSIONAL PDF LAYOUT (centered single-column; with/without photo)
   ═══════════════════════════════════════════════════════════ */

const ProPdfHeading = ({
  children,
  accent,
  fontScale,
  spaceScale,
  fonts,
}: {
  children: string;
  accent: string;
  fontScale: number;
  spaceScale: number;
  fonts: PdfFontPair;
}) => (
  <View
    style={{
      marginTop: 14 * spaceScale,
      marginBottom: 8,
      paddingBottom: 3,
      borderBottomWidth: 1.5,
      borderBottomColor: accent,
    }}
  >
    <Text
      style={{
        fontSize: 9 * fontScale,
        fontFamily: fonts.bold, fontWeight: 700,
        color: "#111827",
        letterSpacing: 1,
        textTransform: "uppercase",
        textAlign: "center",
      }}
    >
      {children}
    </Text>
  </View>
);

const ProfessionalPDFLayout = ({
  data,
  withPhoto,
}: {
  data: CvData;
  withPhoto: boolean;
}) => {
  const theme = resolveTheme(data.settings, "#1f2937");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  // On a white page, accent is used only as text/border → use the readable form.
  const accent = theme.accentText;
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );
  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = projects.length > 0;
  const skillsFirst = isSkillsFirst(data.settings.domain);
  const photo =
    withPhoto && theme.photoVisible && data.personal.photo
      ? data.personal.photo
      : null;
  const essentialChips = getEssentialChips(data.personal);

  const contactBits = [
    data.personal.email?.trim(),
    data.personal.phone?.trim(),
    data.personal.location?.trim(),
    data.personal.linkedin?.trim()
      ? shortenDisplayUrl(data.personal.linkedin.trim())
      : "",
    data.personal.website?.trim()
      ? shortenDisplayUrl(data.personal.website.trim())
      : "",
  ].filter(Boolean);

  const skillsSection = hasSkills ? (
    <>
      {generalSkills.length > 0 && (
        <View>
          <ProPdfHeading fonts={fonts} accent={accent} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Skills</ProPdfHeading>
          <Text style={{ ...s.body, textAlign: "center" }}>
            {generalSkills.map((sk) => sk.name).join("   •   ")}
          </Text>
        </View>
      )}
      {technicalSkills.length > 0 && (
        <View>
          <ProPdfHeading fonts={fonts} accent={accent} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Technical Skills</ProPdfHeading>
          <Text style={{ ...s.body, textAlign: "center" }}>
            {technicalSkills.map((sk) => sk.name).join("   •   ")}
          </Text>
        </View>
      )}
    </>
  ) : null;

  return (
    <View>
      {/* Centered header */}
      <View style={{ alignItems: "center", paddingBottom: 4 }}>
        {photo ? (
          <Image
            src={photo}
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              objectFit: "cover",
              borderWidth: 1.5,
              borderColor: accent,
              marginBottom: 6,
            }}
          />
        ) : null}
        <Text
          style={{
            fontSize: 20 * theme.fontScale,
            fontFamily: fonts.bold, fontWeight: 700,
            color: "#111827",
            letterSpacing: 1,
            textAlign: "center",
          }}
        >
          {name.toUpperCase()}
        </Text>
        {headline ? (
          <Text style={{ fontSize: 10 * theme.fontScale, color: accent, marginTop: 3, textAlign: "center" }}>
            {headline}
          </Text>
        ) : null}
        {contactBits.length > 0 ? (
          <Text style={{ fontSize: 8 * theme.fontScale, color: SLATE_500, marginTop: 4, textAlign: "center" }}>
            {contactBits.join("   •   ")}
          </Text>
        ) : null}
        {essentialChips.length > 0 ? (
          <Text style={{ fontSize: 7.5 * theme.fontScale, color: SLATE_600, marginTop: 3, textAlign: "center" }}>
            {essentialChips.map((c) => `${c.label}: ${c.value}`).join("   ·   ")}
          </Text>
        ) : null}
      </View>

      {hasSummary && (
        <View>
          <ProPdfHeading fonts={fonts} accent={accent} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Summary</ProPdfHeading>
          <Text style={s.body}>{data.personal.summary?.trim()}</Text>
        </View>
      )}

      {skillsFirst ? skillsSection : null}

      {hasExperience && (
        <View>
          <ProPdfHeading fonts={fonts} accent={accent} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Experience</ProPdfHeading>
          {experience.map((role) => (
            <View key={role.id} style={s.entryBlock} minPresenceAhead={48}>
              <View style={s.entryRow}>
                <Text style={{ ...s.entryTitle, flex: 1 }}>
                  {role.role?.trim() || "Role"}
                  {role.company ? (
                    <Text style={s.entryCompany}>{` | ${role.company.trim()}`}</Text>
                  ) : null}
                </Text>
                <Text style={s.entryDate}>
                  {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                </Text>
              </View>
              {role.location?.trim() ? (
                <Text style={s.entrySubtext}>{role.location.trim()}</Text>
              ) : null}
              <BulletList bullets={role.bullets} s={s} />
            </View>
          ))}
        </View>
      )}

      {hasEducation && (
        <View>
          <ProPdfHeading fonts={fonts} accent={accent} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Education</ProPdfHeading>
          {education.map((edu) => (
            <EducationEntry key={edu.id} edu={edu} s={s} fontScale={theme.fontScale} />
          ))}
        </View>
      )}

      {skillsFirst ? null : skillsSection}

      {(hasLanguages || hasCertifications) && (
        <View style={s.twoCol}>
          {hasLanguages && (
            <View style={s.twoColItem}>
              <ProPdfHeading fonts={fonts} accent={accent} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Languages</ProPdfHeading>
              <Text style={{ ...s.body, textAlign: "center" }}>
                {data.languages
                  .map(
                    (lang) =>
                      `${lang.name}${lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}`,
                  )
                  .join("   •   ")}
              </Text>
            </View>
          )}
          {hasCertifications && (
            <View style={s.twoColItem}>
              <ProPdfHeading fonts={fonts} accent={accent} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Certifications</ProPdfHeading>
              {data.certifications.map((cert) => (
                <Text key={cert.id} style={{ ...s.body, textAlign: "center" }}>
                  {cert.name.trim()}
                  {[cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).length
                    ? ` | ${[cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).join(" · ")}`
                    : ""}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {hasProjects && (
        <View>
          <ProPdfHeading fonts={fonts} accent={accent} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Projects</ProPdfHeading>
          {projects.map((project) => (
            <View key={project.id} style={s.entryBlock} wrap={false}>
              <Text style={s.entryTitle}>{project.name?.trim() || "Project"}</Text>
              <BulletList bullets={project.bullets ?? []} s={s} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   ONYX PDF LAYOUT (charcoal left sidebar + photo)
   ═══════════════════════════════════════════════════════════ */

const OnyxHeading = ({
  children,
  accent,
  fontScale,
  spaceScale,
  fonts,
}: {
  children: string;
  accent: string;
  fontScale: number;
  spaceScale: number;
  fonts: PdfFontPair;
}) => (
  <View
    style={{
      marginTop: 14 * spaceScale,
      marginBottom: 7,
      paddingBottom: 3,
      borderBottomWidth: 1.5,
      borderBottomColor: accent,
    }}
  >
    <Text
      style={{
        fontSize: 9.5 * fontScale,
        fontFamily: fonts.bold, fontWeight: 700,
        color: "#1F2937",
        letterSpacing: 0.6,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  </View>
);

const OnyxPDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, "#262626");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const m = theme.marginScale;
  const { accent, accentText, onAccent, onAccentMuted } = theme;
  // Opaque equivalent of 18% white / 12% black over the band.
  const bandBorder = mix(onAccent, accent, onAccent === "#FFFFFF" ? 0.82 : 0.88);
  const firstName = data.personal.firstName?.trim() || "First";
  const lastName = data.personal.lastName?.trim() || "Last";
  const headline = data.personal.headline?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasProjects = projects.length > 0;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const essentialChips = getEssentialChips(data.personal);

  const contactItems: Array<{ text: string; href?: string; fontSize?: number }> = [];
  if (data.personal.email?.trim()) {
    const email = data.personal.email.trim();
    contactItems.push({ text: email, href: `mailto:${email}`, fontSize: email.length > 24 ? 6.4 * theme.fontScale : undefined });
  }
  if (data.personal.phone?.trim())
    contactItems.push({ text: data.personal.phone.trim(), href: `tel:${data.personal.phone.trim()}` });
  if (data.personal.location?.trim())
    contactItems.push({ text: data.personal.location.trim() });
  // A long single-token URL cannot wrap (hyphenation is off; textkit breaks
  // only on spaces) and ran out of the band into the main column (audit
  // 2026-10), so step the size down by length the way the email line does.
  const urlSize = (text: string) => {
    const base = text.length > 44 ? 5.8 : text.length > 34 ? 6.4 : undefined;
    return base === undefined ? undefined : base * theme.fontScale;
  };
  if (data.personal.linkedin?.trim()) {
    const text = shortenDisplayUrl(data.personal.linkedin);
    contactItems.push({ text, href: normalizeHref(data.personal.linkedin), fontSize: urlSize(text) });
  }
  if (data.personal.website?.trim()) {
    const text = shortenDisplayUrl(data.personal.website);
    contactItems.push({ text, href: normalizeHref(data.personal.website), fontSize: urlSize(text) });
  }

  const sideLabel = {
    fontSize: 7 * theme.fontScale,
    fontFamily: fonts.bold, fontWeight: 700,
    color: onAccentMuted,
    letterSpacing: 0.8,
    marginBottom: 5,
    marginTop: 14,
    textTransform: "uppercase" as const,
  };
  const sideText = { fontSize: 7.8 * theme.fontScale, color: onAccentMuted, lineHeight: 1.5 * theme.lineScale, marginBottom: 2 };

  return (
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Charcoal sidebar (edge-bleed) ── */}
      <View
        style={{
          width: 172,
          backgroundColor: accent,
          marginTop: -27,
          marginBottom: -27,
          marginLeft: -24,
          paddingTop: 26,
          paddingBottom: 26,
          paddingLeft: 16,
          paddingRight: 16,
          flexShrink: 0,
        }}
      >
        {showPhoto && data.personal.photo ? (
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Image
              src={data.personal.photo}
              style={{
                width: 84,
                height: 84,
                borderRadius: data.settings.photoShape === "square" ? 8 : 42,
                objectFit: "cover",
                borderWidth: 2,
                borderColor: bandBorder,
              }}
            />
          </View>
        ) : null}

        <Text style={{ fontSize: 14 * theme.fontScale, fontFamily: fonts.bold, fontWeight: 700, color: onAccent, textAlign: "center", lineHeight: 1.2 * theme.lineScale }}>
          {firstName} {lastName}
        </Text>
        {headline ? (
          <Text
            style={{
              fontSize: 8 * theme.fontScale,
              color: onAccentMuted,
              textAlign: "center",
              marginTop: 3,
              paddingBottom: 12,
              borderBottomWidth: 0.5,
              borderBottomColor: bandBorder,
            }}
          >
            {headline}
          </Text>
        ) : null}

        {hasSummary && (
          <View>
            <Text style={sideLabel}>ABOUT ME</Text>
            <Text style={{ fontSize: 7.8 * theme.fontScale, color: onAccentMuted, lineHeight: 1.55 * theme.lineScale }}>
              {data.personal.summary?.trim()}
            </Text>
          </View>
        )}

        {contactItems.length > 0 && (
          <View>
            <Text style={sideLabel}>CONTACT</Text>
            {contactItems.map((item, i) =>
              item.href ? (
                <Link
                  key={i}
                  src={item.href}
                  style={{ ...sideText, textDecoration: "none", ...(item.fontSize ? { fontSize: item.fontSize } : {}) }}
                >
                  {item.text}
                </Link>
              ) : (
                <Text key={i} style={sideText}>
                  {item.text}
                </Text>
              ),
            )}
          </View>
        )}

        {hasLanguages && (
          <View>
            <Text style={sideLabel}>LANGUAGES</Text>
            {data.languages.map((lang) => (
              <Text key={lang.id} style={sideText}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700, color: onAccent }}>{lang.name}</Text>
                {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
              </Text>
            ))}
          </View>
        )}

        {essentialChips.length > 0 && (
          <View>
            <Text style={sideLabel}>DETAILS</Text>
            {essentialChips.map((chip) => (
              <Text key={chip.label} style={sideText}>
                <Text style={{ color: onAccentMuted, fontFamily: fonts.bold, fontWeight: 700 }}>{chip.label}: </Text>
                {chip.value}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* ── Main column ── */}
      <View style={{ flex: 1, paddingLeft: 18 * m }}>
        {hasExperience && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Experience</OnyxHeading>
            {experience.map((role) => (
              <View key={role.id} style={s.entryBlock} minPresenceAhead={48}>
                <View style={s.entryRow}>
                  <Text style={{ ...s.entryTitle, flex: 1 }}>
                    {role.role?.trim() || "Role"}
                    {role.company ? (
                      <Text style={{ ...s.entryCompany, color: accentText }}>{` | ${role.company.trim()}`}</Text>
                    ) : null}
                  </Text>
                  <Text style={s.entryDate}>
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                  </Text>
                </View>
                {role.location?.trim() ? <Text style={s.entrySubtext}>{role.location.trim()}</Text> : null}
                <BulletList bullets={role.bullets} s={s} />
              </View>
            ))}
          </View>
        )}

        {hasEducation && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Education</OnyxHeading>
            {education.map((edu) => (
              <EducationEntry key={edu.id} edu={edu} s={s} fontScale={theme.fontScale} />
            ))}
          </View>
        )}

        {hasSkills && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Skills</OnyxHeading>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {data.skills.map((skill) => (
                <Text
                  key={skill.id}
                  style={{
                    fontSize: 8 * theme.fontScale,
                    color: "#374151",
                    backgroundColor: "#F3F4F6",
                    borderWidth: 0.5,
                    borderColor: "#E5E7EB",
                    borderRadius: 3,
                    paddingVertical: 1.5,
                    paddingHorizontal: 5,
                  }}
                >
                  {skill.name}
                </Text>
              ))}
            </View>
          </View>
        )}

        {hasCertifications && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Certifications</OnyxHeading>
            {data.certifications.map((cert) => (
              <Text key={cert.id} style={{ ...s.body, marginBottom: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700, color: SLATE_800 }}>{cert.name.trim()}</Text>
                {[cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).length
                  ? ` | ${[cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).join(" · ")}`
                  : ""}
              </Text>
            ))}
          </View>
        )}

        {hasProjects && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Projects</OnyxHeading>
            {projects.map((project) => (
              <View key={project.id} style={s.entryBlock} wrap={false}>
                <Text style={s.entryTitle}>{project.name?.trim() || "Project"}</Text>
                <BulletList bullets={project.bullets ?? []} s={s} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   SANDSTONE PDF LAYOUT (warm beige left sidebar + photo + personal details)
   ═══════════════════════════════════════════════════════════ */

const SandstonePDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, "#ECE3D2");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const m = theme.marginScale;
  const { accent, accentText, onAccent, onAccentMuted } = theme;
  // Opaque equivalent of 18% white / 10% black over the band.
  const bandBorder = mix(onAccent, accent, onAccent === "#FFFFFF" ? 0.82 : 0.9);
  const firstName = data.personal.firstName?.trim() || "First";
  const lastName = data.personal.lastName?.trim() || "Last";
  const headline = data.personal.headline?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasProjects = projects.length > 0;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const essentialChips = getEssentialChips(data.personal);
  const personalDetails = [
    ...essentialChips.map((c) => ({ label: c.label, value: c.value })),
    data.personal.dateOfBirth?.trim()
      ? { label: "Date of birth", value: data.personal.dateOfBirth.trim() }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const contactItems: Array<{ text: string; href?: string; fontSize?: number }> = [];
  if (data.personal.email?.trim()) {
    const email = data.personal.email.trim();
    contactItems.push({ text: email, href: `mailto:${email}`, fontSize: email.length > 26 ? 6.4 : undefined });
  }
  if (data.personal.phone?.trim())
    contactItems.push({ text: data.personal.phone.trim(), href: `tel:${data.personal.phone.trim()}` });
  if (data.personal.location?.trim())
    contactItems.push({ text: data.personal.location.trim() });
  // Same length-step as the email line: a long single-token URL cannot wrap
  // and ran out of the 180pt band into the main column (audit 2026-10).
  // Unscaled here; the renderer multiplies by fontScale.
  const urlSize = (text: string) => (text.length > 44 ? 5.8 : text.length > 34 ? 6.4 : undefined);
  if (data.personal.linkedin?.trim()) {
    const text = shortenDisplayUrl(data.personal.linkedin);
    contactItems.push({ text, href: normalizeHref(data.personal.linkedin), fontSize: urlSize(text) });
  }
  if (data.personal.website?.trim()) {
    const text = shortenDisplayUrl(data.personal.website);
    contactItems.push({ text, href: normalizeHref(data.personal.website), fontSize: urlSize(text) });
  }

  const SIDE_TEXT = onAccent;
  const SIDE_MUTED = onAccentMuted;
  const sideLabel = {
    fontSize: 7 * theme.fontScale,
    fontFamily: fonts.bold, fontWeight: 700,
    color: SIDE_MUTED,
    letterSpacing: 0.8,
    marginBottom: 5,
    marginTop: 14,
    textTransform: "uppercase" as const,
  };

  return (
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Warm sidebar (edge-bleed) ── */}
      <View
        style={{
          width: 180,
          backgroundColor: accent,
          marginTop: -27,
          marginBottom: -27,
          marginLeft: -24,
          paddingTop: 26,
          paddingBottom: 26,
          paddingLeft: 16,
          paddingRight: 16,
          flexShrink: 0,
        }}
      >
        {showPhoto && data.personal.photo ? (
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Image
              src={data.personal.photo}
              style={{
                width: 88,
                height: 88,
                borderRadius: data.settings.photoShape === "square" ? 8 : 44,
                objectFit: "cover",
                borderWidth: 2,
                borderColor: bandBorder,
              }}
            />
          </View>
        ) : null}

        <Text style={{ fontSize: 14 * theme.fontScale, fontFamily: fonts.bold, fontWeight: 700, color: onAccent, textAlign: "center", lineHeight: 1.2 * theme.lineScale }}>
          {firstName} {lastName}
        </Text>
        {headline ? (
          <Text
            style={{
              fontSize: 8 * theme.fontScale,
              color: onAccentMuted,
              fontFamily: fonts.bold, fontWeight: 700,
              textAlign: "center",
              marginTop: 3,
              paddingBottom: 12,
              borderBottomWidth: 0.5,
              borderBottomColor: bandBorder,
            }}
          >
            {headline}
          </Text>
        ) : null}

        {personalDetails.length > 0 && (
          <View>
            <Text style={sideLabel}>PERSONAL DETAILS</Text>
            {personalDetails.map((d) => (
              <View key={d.label} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 6.5 * theme.fontScale, fontFamily: fonts.bold, fontWeight: 700, color: SIDE_MUTED, letterSpacing: 0.4 }}>
                  {d.label.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 7.8 * theme.fontScale, color: SIDE_TEXT, lineHeight: 1.4 * theme.lineScale }}>{d.value}</Text>
              </View>
            ))}
          </View>
        )}

        {contactItems.length > 0 && (
          <View>
            <Text style={sideLabel}>CONTACT</Text>
            {contactItems.map((item, i) =>
              item.href ? (
                <Link
                  key={i}
                  src={item.href}
                  style={{ fontSize: (item.fontSize ?? 7.8) * theme.fontScale, color: SIDE_TEXT, lineHeight: 1.5 * theme.lineScale, marginBottom: 2, textDecoration: "none" }}
                >
                  {item.text}
                </Link>
              ) : (
                <Text key={i} style={{ fontSize: 7.8 * theme.fontScale, color: SIDE_TEXT, lineHeight: 1.5 * theme.lineScale, marginBottom: 2 }}>
                  {item.text}
                </Text>
              ),
            )}
          </View>
        )}

        {hasLanguages && (
          <View>
            <Text style={sideLabel}>LANGUAGES</Text>
            {data.languages.map((lang) => (
              <Text key={lang.id} style={{ fontSize: 7.8 * theme.fontScale, color: SIDE_TEXT, lineHeight: 1.5 * theme.lineScale, marginBottom: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700, color: SIDE_TEXT }}>{lang.name}</Text>
                {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* ── Main column ── */}
      <View style={{ flex: 1, paddingLeft: 18 * m }}>
        {hasSummary && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>About Me</OnyxHeading>
            <Text style={s.body}>{data.personal.summary?.trim()}</Text>
          </View>
        )}

        {hasExperience && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Work Experience</OnyxHeading>
            {experience.map((role) => (
              <View key={role.id} style={s.entryBlock} minPresenceAhead={48}>
                <View style={s.entryRow}>
                  <Text style={{ ...s.entryTitle, flex: 1 }}>
                    {role.role?.trim() || "Role"}
                    {role.company ? (
                      <Text style={{ ...s.entryCompany, color: accentText }}>{` | ${role.company.trim()}`}</Text>
                    ) : null}
                  </Text>
                  <Text style={s.entryDate}>
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                  </Text>
                </View>
                {role.location?.trim() ? <Text style={s.entrySubtext}>{role.location.trim()}</Text> : null}
                <BulletList bullets={role.bullets} s={s} />
              </View>
            ))}
          </View>
        )}

        {hasEducation && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Education</OnyxHeading>
            {education.map((edu) => (
              <EducationEntry key={edu.id} edu={edu} s={s} fontScale={theme.fontScale} />
            ))}
          </View>
        )}

        {hasSkills && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Skills</OnyxHeading>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {data.skills.map((skill) => (
                <Text
                  key={skill.id}
                  style={{
                    fontSize: 8 * theme.fontScale,
                    color: "#44403C",
                    backgroundColor: "#F5F0E6",
                    borderWidth: 0.5,
                    borderColor: "#E2D8C4",
                    borderRadius: 3,
                    paddingVertical: 1.5,
                    paddingHorizontal: 5,
                  }}
                >
                  {skill.name}
                </Text>
              ))}
            </View>
          </View>
        )}

        {hasCertifications && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Certifications</OnyxHeading>
            {data.certifications.map((cert) => (
              <Text key={cert.id} style={{ ...s.body, marginBottom: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700, color: SLATE_800 }}>{cert.name.trim()}</Text>
                {[cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).length
                  ? ` | ${[cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).join(" · ")}`
                  : ""}
              </Text>
            ))}
          </View>
        )}

        {hasProjects && (
          <View>
            <OnyxHeading fonts={fonts} accent={accentText} fontScale={theme.fontScale} spaceScale={theme.spaceScale}>Projects</OnyxHeading>
            {projects.map((project) => (
              <View key={project.id} style={s.entryBlock} wrap={false}>
                <Text style={s.entryTitle}>{project.name?.trim() || "Project"}</Text>
                <BulletList bullets={project.bullets ?? []} s={s} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN ROUTER — CVDocument
   ═══════════════════════════════════════════════════════════ */

type Props = {
  data: CvData;
  plan?: PlanTier;
  templateId?: string;
};

export const CVDocument = ({
  data,
  plan = "free",
  templateId = "classic",
}: Props) => {
  // Page Margins (theme.marginScale) scales the shared page padding — but ONLY
  // for single-column templates, whose content sits directly under s.page. The
  // two-column/sidebar layouts bleed to the page edge with hardcoded negative
  // margins tied to s.page's 24/27, so scaling their page padding would break
  // the bleed; their main-column margins land in the next pass.
  const theme = resolveTheme(data.settings);
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const marginScale = theme.marginScale;
  // Templates whose content sits directly under s.page (no edge-bleed) — their
  // page padding scales with margins. Modern belongs here even though its BODY
  // is two-column (main column + 150pt aside, see ModernPDFLayout): it is a
  // padded page like the live template's 36px/32px padding, not a bleed
  // sidebar. The true edge-bleed sidebars (executive/exec-split/corp-sidebar/
  // onyx/sandstone) instead scale their MAIN-COLUMN padding.
  const SINGLE_COLUMN = new Set([
    "classic",
    "ats-clean",
    "professional",
    "professional-photo",
    "modern",
  ]);
  const pageStyle = SINGLE_COLUMN.has(templateId)
    ? {
        ...s.page,
        paddingTop: 27 * marginScale,
        paddingBottom: 27 * marginScale,
        paddingLeft: 24 * marginScale,
        paddingRight: 24 * marginScale,
      }
    : s.page;

  const renderLayout = () => {
    switch (templateId) {
      case "executive":
        return <ExecutivePDFLayout data={data} />;
      case "ats-clean":
        return <ATSCleanPDFLayout data={data} />;
      case "modern":
        return <ModernPDFLayout data={data} />;
      case "exec-split":
        return <ExecSplitPDFLayout data={data} />;
      case "corp-sidebar":
        return <CorpSidebarPDFLayout data={data} />;
      case "professional":
        return <ProfessionalPDFLayout data={data} withPhoto={false} />;
      case "professional-photo":
        return <ProfessionalPDFLayout data={data} withPhoto={true} />;
      case "onyx":
        return <OnyxPDFLayout data={data} />;
      case "sandstone":
        return <SandstonePDFLayout data={data} />;
      default:
        return <ClassicPDFLayout data={data} />;
    }
  };

  const fullName = [data.personal.firstName, data.personal.lastName]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return (
    <Document
      // PDF metadata (audit F09): some ATS/HR tools show the file's Title, and
      // an empty one reads as sloppy. No producer/creator override — react-pdf's
      // default is fine; language helps screen readers pick the voice.
      title={fullName ? `${fullName} — CV` : "CV"}
      author={fullName || undefined}
      subject="Curriculum vitae"
      language="en"
    >
      <Page size="A4" style={pageStyle}>
        {plan === "free" && (
          <View style={s.watermarkContainer} fixed>
            <Text style={s.watermarkText}>Created with MakeMyCV.ae — Free Plan</Text>
          </View>
        )}
        {renderLayout()}
      </Page>
    </Document>
  );
};
