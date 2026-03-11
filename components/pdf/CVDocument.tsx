import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { CvData, PlanTier } from "../../lib/types/cv";

/* ─── Helpers ─────────────────────────────────────────────── */

const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 4 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

const formatDateRange = (start?: string, end?: string, isCurrent?: boolean) => {
  const s = start?.trim() || "";
  const e = end?.trim() || "";
  if (!s && !e) return "";
  if (isCurrent) return `${s} – Present`.trim();
  if (s && e) return `${s} – ${e}`;
  return s || e;
};

const formatLanguage = (name: string, level?: string) => {
  const normalized = level?.toLowerCase();
  const prettyLevel =
    normalized === "beginner"
      ? "Conversational"
      : normalized === "intermediate"
        ? "Professional"
        : normalized === "advanced"
          ? "Fluent"
          : normalized
            ? toTitleCase(normalized)
            : "";
  return `${toTitleCase(name)}${prettyLevel ? ` (${prettyLevel})` : ""}`;
};

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
 * Spacing: Classic px-10 = 40px → 30pt, py-12 = 48px → 36pt
 * mt-6 = 24px → 18pt, space-y-3 = 12px → 9pt, pb-1 = 4px → 3pt
 * pl-4 = 16px → 12pt, space-y-1 = 4px → 3pt
 */

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 30,
    paddingRight: 30,
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
    textDecoration: "none",
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
    opacity: 0.08,
    transform: "rotate(-28deg)",
  },
});

/* ─── Component ───────────────────────────────────────────── */

type Props = {
  data: CvData;
  plan?: PlanTier;
};

export const CVDocument = ({ data, plan = "free" }: Props) => {
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() || "Your Name";
  const headline = data.personal.headline || "Your Headline";

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = data.projects.length > 0;

  // Build contact items (same order as Classic template)
  type ContactItem = { text: string; href?: string };
  const contacts: ContactItem[] = [];
  if (data.personal.email?.trim())
    contacts.push({ text: data.personal.email.trim(), href: `mailto:${data.personal.email.trim()}` });
  if (data.personal.phone?.trim())
    contacts.push({ text: data.personal.phone.trim(), href: `tel:${data.personal.phone.trim()}` });
  if (data.personal.location?.trim())
    contacts.push({ text: data.personal.location.trim() });
  if (data.personal.linkedin?.trim())
    contacts.push({ text: shortenDisplayUrl(data.personal.linkedin), href: data.personal.linkedin.trim() });
  if (data.personal.website?.trim())
    contacts.push({ text: shortenDisplayUrl(data.personal.website), href: data.personal.website.trim() });
  if (data.personal.nationality?.trim())
    contacts.push({ text: data.personal.nationality.trim() });
  if (data.personal.drivingLicense?.trim())
    contacts.push({ text: data.personal.drivingLicense.trim() });
  if (data.personal.dateOfBirth?.trim())
    contacts.push({ text: `DOB: ${data.personal.dateOfBirth.trim()}` });

  const showPhoto = Boolean(data.personal.photo && data.personal.showPhoto);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── Watermark (free plan — diagonal overlay like Classic) ── */}
        {plan === "free" && (
          <View style={s.watermarkContainer} fixed>
            <Text style={s.watermarkText}>MakeMyCV | Free</Text>
          </View>
        )}

        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.headline}>{headline}</Text>
            {contacts.length > 0 && (
              <View style={s.contactRow}>
                {contacts.map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                    {item.href ? (
                      <Link src={item.href} style={s.contactLink}>
                        {item.text}
                      </Link>
                    ) : (
                      <Text style={s.contactItem}>{item.text}</Text>
                    )}
                    {i < contacts.length - 1 && <Text style={s.contactSep}>|</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
          {showPhoto && data.personal.photo && (
            <Image src={data.personal.photo} style={s.photo} />
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

        {/* ── Experience ── */}
        {hasExperience && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Experience</Text>
            </View>
            {data.experience.map((role) => (
              <View key={role.id} style={s.entryBlock} wrap={false}>
                <View style={s.entryRow}>
                  <View style={{ flexDirection: "row", flex: 1 }}>
                    <Text style={s.entryTitle}>
                      {role.role?.trim() || "Role"}
                    </Text>
                    {role.company && (
                      <Text style={s.entryCompany}>
                        {` | ${role.company.trim()}`}
                      </Text>
                    )}
                  </View>
                  <Text style={s.entryDate}>
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                  </Text>
                </View>
                {role.location?.trim() && (
                  <Text style={s.entrySubtext}>{role.location.trim()}</Text>
                )}
                {role.bullets.filter((b) => b.trim()).length > 0 && (
                  <View style={s.bulletList}>
                    {role.bullets
                      .map((b) => b.trim())
                      .filter(Boolean)
                      .map((bullet, bi) => (
                        <View key={bi} style={s.bulletItem}>
                          <Text style={s.bulletDot}>•</Text>
                          <Text style={s.bulletText}>{bullet}</Text>
                        </View>
                      ))}
                  </View>
                )}
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
            {data.education.map((edu) => (
              <View key={edu.id} style={s.entryBlock} wrap={false}>
                <View style={s.entryRow}>
                  <View style={{ flexDirection: "row", flex: 1 }}>
                    <Text style={s.entryTitle}>
                      {edu.degree?.trim() || "Degree"}
                    </Text>
                    {edu.school && (
                      <Text style={s.entryCompany}>
                        {` | ${edu.school.trim()}`}
                      </Text>
                    )}
                  </View>
                  <Text style={s.entryDate}>
                    {formatDateRange(edu.startDate, edu.endDate)}
                  </Text>
                </View>
                {(edu.field || edu.notes) && (
                  <Text style={s.entrySubtext}>
                    {[edu.field?.trim(), edu.notes?.trim()].filter(Boolean).join(" | ")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Skills ── */}
        {hasSkills && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Skills</Text>
            </View>
            <Text style={s.body}>
              {data.skills.map((sk) => toTitleCase(sk.name)).join(", ")}
            </Text>
          </View>
        )}

        {/* ── Languages & Certifications ── */}
        {(hasLanguages || hasCertifications) && (
          <View style={s.twoCol}>
            {hasLanguages && (
              <View style={s.twoColItem}>
                <View style={s.sectionHeadingWrap}>
                  <Text style={s.sectionHeading}>Languages</Text>
                </View>
                <Text style={s.body}>
                  {data.languages
                    .map((lang) => formatLanguage(lang.name, lang.level))
                    .join(" | ")}
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
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>
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
            {data.projects.map((project) => {
              const bullets = (project.bullets ?? [])
                .map((b) => b.trim())
                .filter(Boolean);
              const showLink = shouldShowProjectLink(project.link);
              return (
                <View key={project.id} style={s.entryBlock} wrap={false}>
                  <View style={{ flexDirection: "row" }}>
                    <Text style={s.entryTitle}>
                      {project.name?.trim() || "Project"}
                    </Text>
                    {showLink && (
                      <Text style={{ ...s.entryCompany, color: SLATE_500 }}>
                        {` | ${project.link?.trim()}`}
                      </Text>
                    )}
                  </View>
                  {bullets.length > 0 && (
                    <View style={s.bulletList}>
                      {bullets.map((bullet, bi) => (
                        <View key={bi} style={s.bulletItem}>
                          <Text style={s.bulletDot}>•</Text>
                          <Text style={s.bulletText}>{bullet}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Page>
    </Document>
  );
};
