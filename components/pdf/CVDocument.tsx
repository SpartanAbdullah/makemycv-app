import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { CvData, PlanTier } from "../../lib/types/cv";
import { formatLanguageLevel } from "../../lib/language";

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
  const prettyLevel = level ? formatLanguageLevel(level) : "";
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
    opacity: 0.3,
    transform: "rotate(-28deg)",
  },

  /* ── Executive sidebar ──────────────────────────────────── */
  /* Negative margins extend the navy panel to the page top/bottom/left
     edges, escaping the page-level 36pt/30pt padding so the sidebar bleeds
     edge-to-edge (matches the live preview). Width and padding mirror the
     live template's 200px sidebar with 28px/20px padding. */
  execSidebar: {
    width: 150,
    backgroundColor: "#1E2A4A",
    marginTop: -36,
    marginBottom: -36,
    marginLeft: -30,
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
    borderBottomColor: "rgba(255,255,255,0.15)",
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
});

/* ─── Shared bullet renderer ──────────────────────────────── */

const BulletList = ({ bullets }: { bullets: string[] }) => {
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
}: {
  edu: CvData["education"][number];
  headingStyle?: Style;
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
      <Text style={{ fontSize: 7.5, color: "#15803d", marginTop: 2 }}>
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
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = data.projects.length > 0;

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
      href: data.personal.linkedin.trim(),
    });
  if (data.personal.website?.trim())
    contacts.push({
      text: shortenDisplayUrl(data.personal.website),
      href: data.personal.website.trim(),
    });
  if (data.personal.nationality?.trim())
    contacts.push({ text: data.personal.nationality.trim() });
  if (data.personal.drivingLicense?.trim())
    contacts.push({ text: data.personal.drivingLicense.trim() });
  if (data.personal.dateOfBirth?.trim())
    contacts.push({ text: `DOB: ${data.personal.dateOfBirth.trim()}` });

  const showPhoto = Boolean(data.personal.photo && data.personal.showPhoto);

  return (
    <View>
      {/* ── Header ── */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={{ marginBottom: 2 }}>
            <Text style={{ ...s.name, lineHeight: 1 }}>{name}</Text>
          </View>
          {data.personal.headline?.trim() ? (
            <View style={{ marginBottom: 3 }}>
              <Text style={{ ...s.headline, lineHeight: 1.2 }}>
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
              <BulletList bullets={role.bullets} />
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
            <EducationEntry key={edu.id} edu={edu} />
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
                <BulletList bullets={project.bullets ?? []} />
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
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";

  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasProjects = data.projects.length > 0;
  const showPhoto = Boolean(data.personal.photo && data.personal.showPhoto);

  // Build sidebar contact lines — plain text label prefixes (no emoji — unreliable in react-pdf)
  const sidebarContacts: string[] = [];
  if (data.personal.email?.trim())
    sidebarContacts.push(`Email: ${data.personal.email.trim()}`);
  if (data.personal.phone?.trim())
    sidebarContacts.push(`Tel: ${data.personal.phone.trim()}`);
  if (data.personal.location?.trim())
    sidebarContacts.push(`Location: ${data.personal.location.trim()}`);
  if (data.personal.linkedin?.trim())
    sidebarContacts.push(
      `LinkedIn: ${shortenDisplayUrl(data.personal.linkedin)}`,
    );
  if (data.personal.website?.trim())
    sidebarContacts.push(`Web: ${shortenDisplayUrl(data.personal.website)}`);
  if (data.personal.nationality?.trim())
    sidebarContacts.push(`Nationality: ${data.personal.nationality.trim()}`);
  if (data.personal.drivingLicense?.trim())
    sidebarContacts.push(`DL: ${data.personal.drivingLicense.trim()}`);
  if (data.personal.dateOfBirth?.trim())
    sidebarContacts.push(`DOB: ${data.personal.dateOfBirth.trim()}`);

  return (
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Sidebar ── */}
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
                borderColor: "rgba(255,255,255,0.2)",
              }}
            />
          </View>
        )}

        {/* Name */}
        <Text style={s.execName}>{name}</Text>

        {/* Headline */}
        {data.personal.headline?.trim() ? (
          <Text style={s.execHeadline}>{data.personal.headline.trim()}</Text>
        ) : null}

        {/* Contact */}
        {sidebarContacts.length > 0 && (
          <View>
            <Text style={s.execSideLabel}>CONTACT</Text>
            {sidebarContacts.map((line, i) => (
              <Text key={i} style={s.execContactItem}>
                {line}
              </Text>
            ))}
          </View>
        )}

        {/* Skills */}
        {hasSkills && (
          <View>
            <Text style={s.execSideLabel}>SKILLS</Text>
            {data.skills.map((skill) => (
              <Text key={skill.id} style={s.execSkillItem}>
                {toTitleCase(skill.name)}
              </Text>
            ))}
          </View>
        )}

        {/* Languages */}
        {hasLanguages && (
          <View>
            <Text style={s.execSideLabel}>LANGUAGES</Text>
            {data.languages.map((lang) => (
              <Text key={lang.id} style={s.execSkillItem}>
                {formatLanguage(lang.name, lang.level)}
              </Text>
            ))}
          </View>
        )}

        {/* Certifications */}
        {hasCertifications && (
          <View>
            <Text style={s.execSideLabel}>CERTIFICATIONS</Text>
            {data.certifications.map((cert) => (
              <View key={cert.id} style={{ marginBottom: 4 }}>
                <Text
                  style={{
                    fontSize: 7.5,
                    fontFamily: "Helvetica-Bold",
                    color: "#FFFFFF",
                    lineHeight: 1.4,
                  }}
                >
                  {cert.name.trim()}
                </Text>
                {(cert.issuer || cert.date) && (
                  <Text
                    style={{
                      fontSize: 7,
                      color: "#94A3B8",
                      lineHeight: 1.4,
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
      <View style={{ flex: 1, paddingLeft: 20 }}>
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
                <BulletList bullets={role.bullets} />
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
            {data.education.map((edu) => (
              <EducationEntry key={edu.id} edu={edu} />
            ))}
          </View>
        )}

        {/* Projects */}
        {hasProjects && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Projects</Text>
            </View>
            {data.projects.map((project) => {
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
                  <BulletList bullets={project.bullets ?? []} />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
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
  const contactParts: string[] = [];
  if (data.personal.email?.trim())
    contactParts.push(data.personal.email.trim());
  if (data.personal.phone?.trim())
    contactParts.push(data.personal.phone.trim());
  if (data.personal.location?.trim())
    contactParts.push(data.personal.location.trim());
  if (data.personal.linkedin?.trim())
    contactParts.push(shortenDisplayUrl(data.personal.linkedin));
  if (data.personal.website?.trim())
    contactParts.push(shortenDisplayUrl(data.personal.website));
  if (data.personal.nationality?.trim())
    contactParts.push(data.personal.nationality.trim());
  if (data.personal.drivingLicense?.trim())
    contactParts.push(`DL: ${data.personal.drivingLicense.trim()}`);
  if (data.personal.dateOfBirth?.trim())
    contactParts.push(`DOB: ${data.personal.dateOfBirth.trim()}`);

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = data.projects.length > 0;
  const showPhoto = Boolean(data.personal.photo && data.personal.showPhoto);

  // atsSectionHeading already has marginTop: 16 baked in.
  // Override first section to marginTop: 0 via inline style.
  const firstSection = hasSummary
    ? "summary"
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
            <Text style={{ ...s.atsName, lineHeight: 1 }}>{name}</Text>
          </View>
          {data.personal.headline?.trim() ? (
            <View style={{ marginBottom: 4 }}>
              <Text style={{ ...s.atsHeadline, lineHeight: 1.2 }}>
                {data.personal.headline.trim()}
              </Text>
            </View>
          ) : null}
          {contactParts.length > 0 && (
            <Text style={s.atsContactLine}>{contactParts.join(" · ")}</Text>
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
      <View style={s.atsDivider} />

      {/* ── Summary ── */}
      {hasSummary && (
        <View>
          <Text style={headingStyle("summary")}>Summary</Text>
          <Text style={{ ...s.body, color: "#374151", lineHeight: 1.6 }}>
            {data.personal.summary?.trim()}
          </Text>
        </View>
      )}

      {/* ── Experience ── */}
      {hasExperience && (
        <View>
          <Text style={headingStyle("experience")}>Experience</Text>
          {data.experience.map((role) => (
            <View key={role.id} style={{ marginBottom: 9 }} wrap={false}>
              <View style={s.entryRow}>
                <Text
                  style={{
                    fontFamily: "Helvetica-Bold",
                    fontSize: 8.6,
                    color: "#111827",
                  }}
                >
                  {role.role?.trim() || "Role"}
                </Text>
                <Text
                  style={{
                    fontSize: 7.8,
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
                    fontSize: 8.25,
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
              <BulletList bullets={role.bullets} />
            </View>
          ))}
        </View>
      )}

      {/* ── Education ── */}
      {hasEducation && (
        <View>
          <Text style={headingStyle("education")}>Education</Text>
          {data.education.map((edu) => (
            <EducationEntry
              key={edu.id}
              edu={edu}
              headingStyle={{
                fontFamily: "Helvetica-Bold",
                fontSize: 8.6,
                color: "#111827",
              }}
            />
          ))}
        </View>
      )}

      {/* ── Skills ── */}
      {hasSkills && (
        <View>
          <Text style={headingStyle("skills")}>Skills</Text>
          <Text style={{ ...s.body, color: "#374151" }}>
            {data.skills.map((sk) => toTitleCase(sk.name)).join(" · ")}
          </Text>
        </View>
      )}

      {/* ── Languages ── */}
      {hasLanguages && (
        <View>
          <Text style={headingStyle("languages")}>Languages</Text>
          <Text style={{ ...s.body, color: "#374151" }}>
            {data.languages
              .map((lang) =>
                lang.level ? `${lang.name} (${formatLanguageLevel(lang.level)})` : lang.name,
              )
              .join(" · ")}
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
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
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
          {data.projects.map((project) => {
            const showLink = shouldShowProjectLink(project.link);
            return (
              <View key={project.id} style={{ marginBottom: 8 }} wrap={false}>
                <Text
                  style={{
                    fontFamily: "Helvetica-Bold",
                    fontSize: 8.6,
                    color: "#111827",
                  }}
                >
                  {project.name?.trim() || "Project"}
                </Text>
                {showLink && (
                  <Text
                    style={{
                      fontSize: 7.5,
                      color: "#6B7280",
                      marginTop: 1,
                    }}
                  >
                    ({project.link!.trim()})
                  </Text>
                )}
                <BulletList bullets={project.bullets ?? []} />
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

const ModernPDFLayout = ({ data }: { data: CvData }) => {
  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = data.projects.length > 0;
  const showPhoto = Boolean(data.personal.photo && data.personal.showPhoto);

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
      href: data.personal.linkedin.trim(),
    });
  if (data.personal.website?.trim())
    contacts.push({
      text: shortenDisplayUrl(data.personal.website),
      href: data.personal.website.trim(),
    });
  if (data.personal.nationality?.trim())
    contacts.push({ text: data.personal.nationality.trim() });
  if (data.personal.drivingLicense?.trim())
    contacts.push({ text: data.personal.drivingLicense.trim() });
  if (data.personal.dateOfBirth?.trim())
    contacts.push({ text: `DOB: ${data.personal.dateOfBirth.trim()}` });

  const modernSectionHeadingWrap: Style = {
    borderLeftWidth: 3,
    borderLeftColor: "#4F46E5",
    paddingLeft: 8,
    marginBottom: 6,
  };

  return (
    <View>
      {/* ── Header ── */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={{ marginBottom: 2 }}>
            <Text style={{ ...s.name, color: "#4F46E5", lineHeight: 1 }}>
              {name}
            </Text>
          </View>
          {data.personal.headline?.trim() ? (
            <View style={{ marginBottom: 3 }}>
              <Text style={{ ...s.headline, lineHeight: 1.2 }}>
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
        </View>
        {showPhoto && data.personal.photo && (
          <Image
            src={data.personal.photo}
            style={{
              ...s.photo,
              borderRadius:
                data.settings.photoShape === "square" ? 8 : 30,
            }}
          />
        )}
      </View>

      {/* ── Summary ── */}
      {hasSummary && (
        <View style={s.section}>
          <View style={modernSectionHeadingWrap}>
            <Text style={s.sectionHeading}>Summary</Text>
          </View>
          <Text style={s.body}>{data.personal.summary?.trim()}</Text>
        </View>
      )}

      {/* ── Experience ── */}
      {hasExperience && (
        <View style={s.section}>
          <View style={modernSectionHeadingWrap}>
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
              <BulletList bullets={role.bullets} />
            </View>
          ))}
        </View>
      )}

      {/* ── Education ── */}
      {hasEducation && (
        <View style={s.section}>
          <View style={modernSectionHeadingWrap}>
            <Text style={s.sectionHeading}>Education</Text>
          </View>
          {data.education.map((edu) => (
            <EducationEntry key={edu.id} edu={edu} />
          ))}
        </View>
      )}

      {/* ── Skills ── */}
      {hasSkills && (
        <View style={s.section}>
          <View style={modernSectionHeadingWrap}>
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
              <View style={modernSectionHeadingWrap}>
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
              <View style={modernSectionHeadingWrap}>
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
          <View style={modernSectionHeadingWrap}>
            <Text style={s.sectionHeading}>Projects</Text>
          </View>
          {data.projects.map((project) => {
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
                <BulletList bullets={project.bullets ?? []} />
              </View>
            );
          })}
        </View>
      )}
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
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = data.projects.length > 0;

  const contactParts: string[] = [];
  if (data.personal.email?.trim())
    contactParts.push(data.personal.email.trim());
  if (data.personal.phone?.trim())
    contactParts.push(data.personal.phone.trim());
  if (data.personal.location?.trim())
    contactParts.push(data.personal.location.trim());
  if (data.personal.linkedin?.trim())
    contactParts.push(shortenDisplayUrl(data.personal.linkedin));
  if (data.personal.website?.trim())
    contactParts.push(shortenDisplayUrl(data.personal.website));
  if (data.personal.nationality?.trim())
    contactParts.push(data.personal.nationality.trim());
  if (data.personal.drivingLicense?.trim())
    contactParts.push(`DL: ${data.personal.drivingLicense.trim()}`);
  if (data.personal.dateOfBirth?.trim())
    contactParts.push(`DOB: ${data.personal.dateOfBirth.trim()}`);

  const showPhoto = Boolean(data.personal.photo && data.personal.showPhoto);

  return (
    <View>
      {/* ── Dark Header ── */}
      <View
        style={{
          backgroundColor: "#1B2A4A",
          marginTop: -36,
          marginLeft: -30,
          marginRight: -30,
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
              fontSize: 20,
              fontFamily: "Helvetica-Bold",
              color: "#FFFFFF",
              lineHeight: 1.15,
            }}
          >
            {name}
          </Text>
          {data.personal.headline?.trim() ? (
            <Text
              style={{
                fontSize: 9,
                color: "#94A3B8",
                marginTop: 3,
                lineHeight: 1.4,
              }}
            >
              {data.personal.headline.trim()}
            </Text>
          ) : null}
          {contactParts.length > 0 && (
            <Text
              style={{
                fontSize: 7.5,
                color: "#CBD5E1",
                marginTop: 6,
                lineHeight: 1.6,
              }}
            >
              {contactParts.join("  \u00B7  ")}
            </Text>
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
              borderColor: "rgba(255,255,255,0.25)",
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
                  <BulletList bullets={role.bullets} />
                </View>
              ))}
            </View>
          )}

          {hasEducation && (
            <View style={hasExperience ? s.section : undefined}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Education</Text>
              </View>
              {data.education.map((edu) => (
                <EducationEntry key={edu.id} edu={edu} />
              ))}
            </View>
          )}

          {hasProjects && (
            <View style={s.section}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Projects</Text>
              </View>
              {data.projects.map((project) => {
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
                    <BulletList bullets={project.bullets ?? []} />
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
              <Text style={{ ...s.body, fontSize: 8 }}>
                {data.personal.summary?.trim()}
              </Text>
            </View>
          )}

          {hasSkills && (
            <View style={hasSummary ? s.section : undefined}>
              <View style={s.sectionHeadingWrap}>
                <Text style={s.sectionHeading}>Skills</Text>
              </View>
              <Text style={{ ...s.body, fontSize: 8 }}>
                {data.skills.map((sk) => toTitleCase(sk.name)).join(", ")}
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
                  style={{ fontSize: 8, color: SLATE_700, lineHeight: 1.6 }}
                >
                  {formatLanguage(lang.name, lang.level)}
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
                      fontSize: 8,
                      fontFamily: "Helvetica-Bold",
                      color: SLATE_800,
                    }}
                  >
                    {cert.name.trim()}
                  </Text>
                  {(cert.issuer || cert.date) && (
                    <Text style={{ fontSize: 7.5, color: SLATE_500 }}>
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
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = data.projects.length > 0;

  const sidebarContacts: Array<{ label: string; value: string }> = [];
  if (data.personal.email?.trim())
    sidebarContacts.push({
      label: "Email",
      value: data.personal.email.trim(),
    });
  if (data.personal.phone?.trim())
    sidebarContacts.push({
      label: "Phone",
      value: data.personal.phone.trim(),
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
    });
  if (data.personal.website?.trim())
    sidebarContacts.push({
      label: "Web",
      value: shortenDisplayUrl(data.personal.website),
    });
  if (data.personal.nationality?.trim())
    sidebarContacts.push({
      label: "Nationality",
      value: data.personal.nationality.trim(),
    });
  if (data.personal.drivingLicense?.trim())
    sidebarContacts.push({
      label: "License",
      value: data.personal.drivingLicense.trim(),
    });
  if (data.personal.dateOfBirth?.trim())
    sidebarContacts.push({
      label: "DOB",
      value: data.personal.dateOfBirth.trim(),
    });

  const showPhoto = Boolean(data.personal.photo && data.personal.showPhoto);

  return (
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Left main content ── */}
      <View style={{ flex: 1, paddingRight: 14 }}>
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
              fontSize: 20,
              fontFamily: "Helvetica-Bold",
              color: "#0F172A",
              lineHeight: 1.15,
            }}
          >
            {name}
          </Text>
          {data.personal.headline?.trim() ? (
            <Text
              style={{
                fontSize: 9,
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
                <BulletList bullets={role.bullets} />
              </View>
            ))}
          </View>
        )}

        {hasEducation && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Education</Text>
            </View>
            {data.education.map((edu) => (
              <EducationEntry key={edu.id} edu={edu} />
            ))}
          </View>
        )}

        {hasProjects && (
          <View style={s.section}>
            <View style={s.sectionHeadingWrap}>
              <Text style={s.sectionHeading}>Projects</Text>
            </View>
            {data.projects.map((project) => {
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
                  <BulletList bullets={project.bullets ?? []} />
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
          backgroundColor: "#0F172A",
          marginTop: -36,
          marginBottom: -36,
          marginRight: -30,
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
                borderColor: "rgba(255,255,255,0.15)",
              }}
            />
          </View>
        )}

        {/* Contact */}
        {sidebarContacts.length > 0 && (
          <View>
            <Text style={s.execSideLabel}>CONTACT</Text>
            {sidebarContacts.map((item, i) => (
              <View key={i} style={{ marginBottom: 3 }}>
                <Text
                  style={{
                    fontSize: 6,
                    fontFamily: "Helvetica-Bold",
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: 0.4,
                  }}
                >
                  {item.label.toUpperCase()}
                </Text>
                <Text style={{ ...s.execContactItem, fontSize: 7.5 }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {hasSkills && (
          <View>
            <Text style={s.execSideLabel}>SKILLS</Text>
            <Text
              style={{
                fontSize: 7.5,
                color: "#E2E8F0",
                lineHeight: 1.6,
              }}
            >
              {data.skills.map((sk) => toTitleCase(sk.name)).join(", ")}
            </Text>
          </View>
        )}

        {/* Languages */}
        {hasLanguages && (
          <View>
            <Text style={s.execSideLabel}>LANGUAGES</Text>
            {data.languages.map((lang) => (
              <Text key={lang.id} style={s.execSkillItem}>
                {formatLanguage(lang.name, lang.level)}
              </Text>
            ))}
          </View>
        )}

        {/* Certifications */}
        {hasCertifications && (
          <View>
            <Text style={s.execSideLabel}>CERTIFICATIONS</Text>
            {data.certifications.map((cert) => (
              <View key={cert.id} style={{ marginBottom: 4 }}>
                <Text
                  style={{
                    fontSize: 7.5,
                    fontFamily: "Helvetica-Bold",
                    color: "#FFFFFF",
                    lineHeight: 1.4,
                  }}
                >
                  {cert.name.trim()}
                </Text>
                {(cert.issuer || cert.date) && (
                  <Text
                    style={{
                      fontSize: 7,
                      color: "#94A3B8",
                      lineHeight: 1.4,
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
      default:
        return <ClassicPDFLayout data={data} />;
    }
  };

  return (
    <Document>
      <Page size="A4" style={s.page}>
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
