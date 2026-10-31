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
import type { ReactNode } from "react";
import type { CvData, PlanTier } from "../../lib/types/cv";
import { formatLanguageLevel } from "../../lib/language";
import { getEssentialChips } from "../../lib/utils/essentials";
import { resolveTheme } from "../../lib/templates/theme";
import {
  bannerContactItems,
  bannerEducationTitle,
  bannerEssentials,
} from "../../lib/templates/banner";
// Opaque tints for the PDF: react-pdf converts alpha colours to 8-digit hex
// and pdfkit misparses that as solid neon green (audit 2026-10), so every
// translucent-looking colour is pre-blended with mix() instead. The pdf
// smoke script fails the build if an alpha colour creeps back in.
import { mix } from "../../lib/utils/color";
import { formatDateRange, normalizeHref } from "../../lib/utils/format";
import { meaningfulProjects } from "../../lib/utils/projects";
import { meaningfulExperience } from "../../lib/utils/experience";
import {
  attestedLabel,
  distinctField,
  educationTitle,
  meaningfulEducation,
} from "../../lib/utils/education";
import { isSkillsFirst } from "../../lib/data/sectionOrder";
import { splitSkills } from "../../lib/utils/skills";
import { PDF_FAMILY, pdfFontPair, pdfFontsReady, type PdfFontPair } from "../../lib/pdf/fonts";
// Gulf Standard shares its Personal Details rows and degree de-dup rule with
// the live template so both renderers print identical label/value pairs.
import {
  GULF_STANDARD_ACCENT,
  gulfDegreeTitle,
  gulfDetailColumns,
  gulfDetailRows,
} from "../../lib/templates/gulf-standard";
// Chronicle and Harvard share their text rules (contact order, essentials
// labels, degree de-dup, Harvard's label-prefixed lines) with the live
// templates so both renderers print identical text.
import {
  CHRONICLE_ACCENT,
  CHRONICLE_DATE_GAP_PT,
  CHRONICLE_DATE_TRACK_PT,
  CHRONICLE_DOT_PT,
  CHRONICLE_DOT_TOP_PT,
  CHRONICLE_RAIL_TRACK_PT,
  CHRONICLE_RAIL_WIDTH_PT,
  chronicleContactItems,
  chronicleDegreeTitle,
  chronicleEssentials,
  chronicleRailColors,
} from "../../lib/templates/chronicle";
import {
  HARVARD_INK,
  HARVARD_INK_SOFT,
  HARVARD_PAGE_PADDING_PT,
  HARVARD_RULE,
  harvardContactItems,
  harvardDegreeTitle,
  harvardEssentials,
  harvardSkillLines,
} from "../../lib/templates/harvard";

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
/** Tailwind green-700 — the attestation colour every live template uses. */
const GREEN_700 = "#15803D";

/** The live templates are written in CSS px (96 DPI); react-pdf is pt (72). */
const pt = (px: number) => px * 0.75;
/**
 * The line box of every live run that sets no line-height of its own:
 * headings, side labels, chips and entry rows inherit `line-height: 1.5`
 * from Tailwind's preflight (`html { line-height: 1.5 }`, pulled in by
 * app/globals.css), which the Line Height slider does not scale. A react-pdf <Text> with no lineHeight does NOT re-resolve
 * from its own size but inherits the page's resolved box (8.6 × 1.45 =
 * 12.47pt — a 20pt line overprints the next), so every such run must set
 * this explicitly (measured in the preview, session 3, 2026-10-31).
 */
const LH_NORMAL = 1.5;

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
    // Explicit regular face: this style is used as a run INSIDE the bold
    // entryTitle, and nested Text inherits the parent's font otherwise.
    fontFamily: "Helvetica",
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

  /* ── Executive / Corporate sidebar text ────────────────── */
  /* The sidebar column, name block and labels are inline in the layouts
     (they depend on the theme and the margin scale); only the shared text
     runs live here. */
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
  twoCol: ["marginTop"],
  // NOT entryBlock / sectionHeadingWrap: the live templates keep the gap
  // between entries and under a heading fixed (space-y-3 / pb-1 + mt-2) and
  // scale only the gap between sections (audit 2026-10 defect 37).
  // ATS Clean builds its own sheet from the live px values (session 3,
  // 2026-10-31) and scales its heading gap inline.
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
    if (v.fontFamily === "Helvetica") {
      v.fontFamily = fonts.regular;
      v.fontWeight = 400;
    }
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

/** `gap` is the live space-y-* between items: margin above every item after the first. */
type BulletStyles = { list?: Style; item?: Style; dot?: Style; text?: Style; gap?: number };

const BulletList = ({
  bullets,
  s,
  styles,
}: {
  bullets: string[];
  s: Record<string, Style>;
  /** Per-layout overrides merged over the Classic sheet (sidebar layouts). */
  styles?: BulletStyles;
}) => {
  const items = bullets.map((b) => b.trim()).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <View style={{ ...s.bulletList, ...styles?.list }}>
      {items.map((bullet, bi) => (
        <View key={bi} style={{ ...s.bulletItem, ...styles?.item, ...(styles?.gap && bi > 0 ? { marginTop: styles.gap } : {}) }}>
          <Text style={{ ...s.bulletDot, ...styles?.dot }}>•</Text>
          <Text style={{ ...s.bulletText, ...styles?.text }}>{bullet}</Text>
        </View>
      ))}
    </View>
  );
};

/* ─── Experience entry (sidebar layouts) ─────────────────── */
/*
 * Executive, Exec Split, Corporate, Onyx and Sandstone draw a role as
 * "Role ............ dates" over "Company · Location" (or " | "), with the
 * company in the accent on Onyx and Sandstone. The PDF reused Classic's
 * "Role | Company" row and pushed the location to a grey third line
 * (template audit 2026-10 defect 7). Classic and Professional keep the
 * inline form because their live templates draw it that way; ATS Clean and
 * Modern already had their own rows.
 */

type ExperienceVariant = {
  roleStyle: Style;
  dateStyle: Style;
  companyStyle: Style;
  /** Location run on the company line; defaults to companyStyle. */
  locationStyle?: Style;
  /** Between company and location: " · " or " | ". */
  separator: string;
  /** Space under the company line before the bullets (Exec Split / Corporate 3px). */
  companyMarginBottom?: number;
  /** Bullet text (size, line-height, colour); the marker takes the same colour. */
  bulletText: Style;
  /** The live <ul> margin-top and padding-left, in pt. */
  bulletsMarginTop: number;
  bulletsPaddingLeft: number;
  /** Gap between roles (pt), as marginTop on every role after the first. */
  gap: number;
};

/** Marker column width: the live disc sits inside the <ul> padding, so the
 *  text starts exactly `bulletsPaddingLeft` in and the dot takes the last 9pt. */
const BULLET_DOT_WIDTH = 9;

const ExperienceEntry = ({
  role,
  v,
  index,
  s,
}: {
  role: CvData["experience"][number];
  v: ExperienceVariant;
  index: number;
  s: Record<string, Style>;
}) => {
  const company = role.company?.trim() ?? "";
  const location = role.location?.trim() ?? "";
  return (
    <View style={{ marginTop: index > 0 ? v.gap : 0 }} minPresenceAhead={48}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 6,
        }}
      >
        <Text style={{ ...v.roleStyle, flex: 1 }}>{role.role?.trim() || "Role"}</Text>
        <Text style={{ ...v.dateStyle, flexShrink: 0, textAlign: "right" }}>
          {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
        </Text>
      </View>
      {company || location ? (
        <Text
          style={{
            ...v.companyStyle,
            marginTop: 0.75,
            marginBottom: v.companyMarginBottom ?? 0,
          }}
        >
          {company}
          {company && location ? v.separator : ""}
          {location ? (
            <Text style={v.locationStyle ?? v.companyStyle}>{location}</Text>
          ) : null}
        </Text>
      ) : null}
      <BulletList
        bullets={role.bullets}
        s={s}
        styles={{
          list: {
            marginTop: v.bulletsMarginTop,
            paddingLeft: Math.max(0, v.bulletsPaddingLeft - BULLET_DOT_WIDTH),
          },
          item: { marginBottom: 0 },
          dot: {
            width: BULLET_DOT_WIDTH,
            fontSize: v.bulletText.fontSize,
            color: v.bulletText.color,
          },
          text: v.bulletText,
        }}
      />
    </View>
  );
};

/* ─── Education entry (one primitive, one variant per template) ── */
/*
 * Every live template draws an education entry differently — Classic puts the
 * school inline after the degree and the field on the notes line, ATS Clean
 * says "Degree in Field" with the attestation inline after the school,
 * Executive and Corporate badge the attestation in a bordered pill, Onyx and
 * Sandstone colour the school in the accent and print notes under the
 * attestation. The shared block used to ignore all of that and printed a bare
 * "Attested" even without an attesting body (template audit 2026-10 defects
 * 8, 21, 36), so each layout now passes its variant and the download reads
 * like the preview. Wording comes from lib/utils/education.ts
 * (educationTitle / attestedLabel) — the same functions the live files call.
 */

type EducationVariant = {
  /** Joiner between degree and field on the title line (" · ", " — ", " in "). */
  joiner: string;
  /** Classic: the field is not on the title line, it opens the notes line. */
  fieldOnNotesLine?: boolean;
  /** Classic / Professional: " | School" inline after the title. */
  schoolInline?: boolean;
  titleStyle: Style;
  dateStyle: Style;
  /** Style of the school run (inline) or line (block). */
  schoolStyle: Style;
  notesStyle: Style;
  /** Space above the notes line (pt); the live templates use 1px (default) or Classic's mt-1. */
  notesMarginTop?: number;
  /** Own line under the school, inline after the school, or a bordered pill beside it. */
  attested: "line" | "inline" | "pill";
  attestedStyle: Style;
  /** Pill border colour; defaults to the attestation text colour. */
  pillBorderColor?: string;
  /** Classic / Onyx / Sandstone / Professional show nothing without an attesting body. */
  attestedRequiresBody?: boolean;
  /** Executive prints "ATTESTED — body". */
  attestedUppercase?: boolean;
  /** Onyx / Sandstone print notes after the attestation line. */
  notesAfterAttested?: boolean;
  /** Gap between entries (pt), as marginTop on every entry after the first. */
  gap: number;
};

const EducationEntry = ({
  edu,
  v,
  index,
}: {
  edu: CvData["education"][number];
  v: EducationVariant;
  index: number;
}) => {
  const degree = edu.degree?.trim() ?? "";
  const field = edu.field?.trim() ?? "";
  const school = edu.school?.trim() ?? "";
  const notes = edu.notes?.trim() ?? "";
  const body = edu.attestingBody?.trim() ?? "";
  const showAttested =
    Boolean(edu.attested) && (Boolean(body) || !v.attestedRequiresBody);
  const attestedText = attestedLabel(body, v.attestedUppercase);
  const title = v.fieldOnNotesLine
    ? degree || "Degree"
    : educationTitle(degree, field, v.joiner);
  const notesLine = v.fieldOnNotesLine
    ? [distinctField(degree, field), notes].filter(Boolean).join(" | ")
    : notes;
  const dates = formatDateRange(edu.startDate, edu.endDate);

  const notesNode = notesLine ? (
    <Text style={{ ...v.notesStyle, marginTop: v.notesMarginTop ?? 0.75 }}>{notesLine}</Text>
  ) : null;
  const attestedLine =
    v.attested === "line" && showAttested ? (
      <Text style={{ ...v.attestedStyle, marginTop: 0.75 }}>{attestedText}</Text>
    ) : null;
  const hasSchoolLine =
    !v.schoolInline && (Boolean(school) || (showAttested && v.attested !== "line"));

  return (
    <View style={{ marginTop: index > 0 ? v.gap : 0 }} wrap={false}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 6,
        }}
      >
        <Text style={{ ...v.titleStyle, flex: 1 }}>
          {title}
          {v.schoolInline && school ? (
            <Text style={v.schoolStyle}>{` | ${school}`}</Text>
          ) : null}
        </Text>
        {dates ? (
          <Text style={{ ...v.dateStyle, flexShrink: 0, textAlign: "right" }}>
            {dates}
          </Text>
        ) : null}
      </View>
      {hasSchoolLine ? (
        v.attested === "pill" ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 4.5,
              marginTop: 0.75,
            }}
          >
            {school ? <Text style={v.schoolStyle}>{school}</Text> : null}
            {showAttested ? (
              <View
                style={{
                  borderWidth: 0.75,
                  borderColor: v.pillBorderColor ?? v.attestedStyle.color,
                  borderRadius: 2.25,
                  paddingVertical: 0.75,
                  paddingHorizontal: 3,
                }}
              >
                <Text style={v.attestedStyle}>{attestedText}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={{ ...v.schoolStyle, marginTop: 0.75 }}>
            {school}
            {v.attested === "inline" && showAttested ? (
              <Text style={v.attestedStyle}>
                {`${school ? "  " : ""}${attestedText}`}
              </Text>
            ) : null}
          </Text>
        )
      ) : null}
      {v.notesAfterAttested ? (
        <>
          {attestedLine}
          {notesNode}
        </>
      ) : (
        <>
          {notesNode}
          {attestedLine}
        </>
      )}
    </View>
  );
};

/* ─── Chips (skills and UAE essentials) ──────────────────── */
/*
 * Exec Split, Corporate, Modern, Professional, Onyx and Sandstone draw skills
 * and/or the UAE-essentials strip as bordered pills; the PDF flattened most of
 * them to one joined text line (template audit 2026-10 defect 9). One
 * primitive, styled per layout from the live file. ATS Clean goes the other
 * way: its text line is the ATS-safer form, so the preview now draws the line
 * too (see lib/templates/ats-clean.tsx). An item with a `label` prints it as a
 * leading run (essentials: "Visa" + "Employment visa").
 */

type ChipItem = { label?: string; value: string };

type ChipVariant = {
  fontSize: number;
  lineHeight?: number;
  color: string;
  backgroundColor?: string;
  /** Border is drawn only when a colour is given (0.75pt = the live 1px). */
  borderColor?: string;
  borderWidth?: number;
  borderRadius: number;
  paddingVertical: number;
  paddingHorizontal: number;
  gap: number;
  letterSpacing?: number;
  /** Merged over the value style for the leading label run. */
  labelStyle?: Style;
  /** Space between label and value (pt). */
  labelGap?: number;
};

const PdfChips = ({
  items,
  v,
  style,
}: {
  items: ChipItem[];
  v: ChipVariant;
  /** Extra style on the wrapping row (marginTop, justifyContent …). */
  style?: Style;
}) => {
  if (items.length === 0) return null;
  const text: Style = {
    fontSize: v.fontSize,
    color: v.color,
    ...(v.lineHeight !== undefined ? { lineHeight: v.lineHeight } : {}),
    ...(v.letterSpacing !== undefined ? { letterSpacing: v.letterSpacing } : {}),
  };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v.gap, ...style }}>
      {items.map((item, i) => (
        <View
          key={`${item.label ?? ""}|${item.value}|${i}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: v.backgroundColor,
            ...(v.borderColor
              ? { borderWidth: v.borderWidth ?? 0.75, borderColor: v.borderColor }
              : {}),
            borderRadius: v.borderRadius,
            paddingVertical: v.paddingVertical,
            paddingHorizontal: v.paddingHorizontal,
          }}
        >
          {item.label ? (
            <Text style={{ ...text, ...v.labelStyle, marginRight: v.labelGap ?? 3 }}>
              {item.label}
            </Text>
          ) : null}
          <Text style={text}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
};

/* ─── Ruled section heading (main columns) ───────────────── */
/*
 * Executive, Exec Split and Corporate draw small uppercase letter-spaced
 * headings — in the accent on Executive / Exec Split, slate-800 on Corporate —
 * over a hairline rule, but the PDF reused Classic's 9.4pt title-case slate
 * heading on a slate-200 rule, so a custom accent coloured the preview and
 * not the download (template audit 2026-10 defect 11). Each layout passes a
 * variant transcribed from its live heading component; the caller decides the
 * top margin (live Executive zeroes the first section, the other two do not).
 */

/**
 * pdf.js — and the text-layer parsers ATS portals run — read tracking above
 * roughly a tenth of the font size as spaces between letters: Exec Split's
 * 0.12em headings extracted as "E X P E R I E N C E" and the 0.1em sidebar
 * labels as "C O N TAC T" (template audit 2026-10 defect 39). The PDF caps
 * heading tracking at 8% of the size; the live headings keep theirs, which is
 * a visible but deliberate deviation in favour of a parseable download.
 */
const MAX_TRACKING_RATIO = 0.08;
const safeTracking = (letterSpacing: number, fontSize: number) =>
  Math.min(letterSpacing, MAX_TRACKING_RATIO * fontSize);

/**
 * Section-gap factory for headings and sidebar labels: `firstKey` is the
 * first PRESENT section and gets no top gap (live Executive / Onyx /
 * Sandstone zero their first heading); layouts whose live file keeps the gap
 * on every heading (Corporate) pass null.
 */
const withTopGap =
  <T extends object>(base: T, gap: number, firstKey: string | null) =>
  (key: string): T & { marginTop: number } => ({
    ...base,
    marginTop: key === firstKey ? 0 : gap,
  });

type HeadingVariant = {
  fontSize: number;
  /** Explicit line box; without it the heading inherits the page's resolved one. */
  lineHeight?: number;
  color: string;
  letterSpacing: number;
  uppercase?: boolean;
  textAlign?: "left" | "center";
  /** Rule under the heading; none when omitted. */
  ruleColor?: string;
  ruleWidth?: number;
  paddingBottom: number;
  marginBottom: number;
  marginTop: number;
};

const PdfHeading = ({
  children,
  v,
  fonts,
}: {
  children: string;
  v: HeadingVariant;
  fonts: PdfFontPair;
}) => (
  <View
    style={{
      marginTop: v.marginTop,
      marginBottom: v.marginBottom,
      paddingBottom: v.paddingBottom,
      ...(v.ruleColor
        ? { borderBottomWidth: v.ruleWidth ?? 0.75, borderBottomColor: v.ruleColor }
        : {}),
    }}
  >
    <Text
      style={{
        fontSize: v.fontSize,
        fontFamily: fonts.bold,
        fontWeight: 700,
        color: v.color,
        letterSpacing: safeTracking(v.letterSpacing, v.fontSize),
        ...(v.lineHeight !== undefined ? { lineHeight: v.lineHeight } : {}),
        ...(v.uppercase ? { textTransform: "uppercase" } : {}),
        ...(v.textAlign ? { textAlign: v.textAlign } : {}),
      }}
    >
      {children}
    </Text>
  </View>
);

/* ═══════════════════════════════════════════════════════════
   CLASSIC PDF LAYOUT
   ═══════════════════════════════════════════════════════════ */

const ClassicPDFLayout = ({ data }: { data: CvData }) => {
  /*
   * Transcribed from lib/templates/classic.tsx (PDF_FIDELITY.md session 4,
   * 2026-10-31). Every size is the live px value through pt(); every line
   * box is explicit. Classic's root sets `leading-[calc(1.45*var(--lh))]`,
   * a UNITLESS factor that every run without its own line-height inherits
   * (headings, dates, entry rows, chips) — so the inherited box here is
   * 1.45 × lineScale, not Tailwind's 1.5. fontScale on sizes, lineScale on
   * line-heights, spaceScale only on the gap between sections (mt-6·sp),
   * marginScale on the page padding via the router (live 36·m / 32·m px =
   * the router's 27·m / 24·m pt). Before this pass the layout ran on the
   * shared BASE_STYLES sheet: name 30px for 28, headline 15px for 14, chips
   * 12px for 10, a 6pt header rule gap for the live 9 + 12, bullets 10pt
   * further in than the live text, a trailing 9pt after every entry block
   * and a 12.47pt page line box on every heading and row.
   */
  const theme = resolveTheme(data.settings, "#1e5b54");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  /** The live root leading: 1.45·lh, inherited as a factor by every run that sets none. */
  const rootLine = 1.45 * ls;
  const bold: Style = { fontFamily: fonts.bold, fontWeight: 700 };
  // Explicit regular face for runs nested INSIDE a bold Text (nested Text
  // inherits the parent's font otherwise).
  const regular: Style = { fontFamily: fonts.regular, fontWeight: 400 };
  /** text-[11.5px] leading-[1.45] text-slate-700 — body, bullets, skills, languages, certs. */
  const body: Style = { fontSize: pt(11.5) * fs, lineHeight: rootLine, color: SLATE_700 };
  /** text-[11px] text-slate-500 — dates, locations, education notes. */
  const small: Style = { fontSize: pt(11) * fs, lineHeight: rootLine, color: SLATE_500 };
  /** text-[12px] font-semibold text-slate-800 — role, degree and project titles. */
  const entryTitle: Style = { ...bold, fontSize: pt(12) * fs, lineHeight: rootLine, color: SLATE_800 };
  /** section mt-6·sp; heading wrap border-b border-slate-200 pb-1; h2 12.5px semibold slate-800; content mt-2. */
  const section: Style = { marginTop: pt(24) * sp };
  const headingWrap: Style = {
    borderBottomWidth: 0.75,
    borderBottomColor: SLATE_200,
    paddingBottom: pt(4),
  };
  const headingText: Style = { ...bold, fontSize: pt(12.5) * fs, lineHeight: rootLine, color: SLATE_800 };
  const contentGap = pt(8);
  const heading = (label: string) => (
    <View style={headingWrap} minPresenceAhead={36}>
      <Text style={headingText}>{label}</Text>
    </View>
  );
  /** list-disc pl-4 space-y-1: text 16px in, the disc in that gutter in slate-400, 4px between items. */
  const bulletStyles = (marginTop: number): BulletStyles => ({
    list: { marginTop, paddingLeft: pt(16) - BULLET_DOT_WIDTH },
    item: { marginBottom: 0 },
    gap: pt(4),
    dot: { width: BULLET_DOT_WIDTH, fontSize: body.fontSize, color: SLATE_400 },
    text: body,
  });

  // classic.tsx education: "Degree | School" (12px semibold / normal), then
  // "Field | Notes" (11px slate-500, mt-1), then "Attested — body" (12px
  // green-700 on a 16px·lh box, mt-0.5) only when a body was given; entries
  // space-y-3.
  const eduVariant: EducationVariant = {
    joiner: " · ",
    fieldOnNotesLine: true,
    schoolInline: true,
    titleStyle: entryTitle,
    dateStyle: small,
    schoolStyle: { ...regular, color: SLATE_700 },
    notesStyle: small,
    notesMarginTop: pt(4),
    attested: "line",
    attestedStyle: {
      fontSize: pt(12) * fs,
      // leading-[calc(1rem*var(--lh))]: an ABSOLUTE 16px·lh box, not scaled by fontScale.
      lineHeight: ((16 / 12) * ls) / fs,
      color: GREEN_700,
    },
    attestedRequiresBody: true,
    gap: pt(12),
  };
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );
  const skillsBlock =
    generalSkills.length > 0 || technicalSkills.length > 0 ? (
      <>
        {generalSkills.length > 0 && (
          <View style={section}>
            {heading("Skills")}
            <Text style={{ ...body, marginTop: contentGap }}>
              {generalSkills.map((sk) => sk.name).join(", ")}
            </Text>
          </View>
        )}
        {technicalSkills.length > 0 && (
          <View style={section}>
            {heading("Technical Skills")}
            <Text style={{ ...body, marginTop: contentGap }}>
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
  /** text-[10.5px] leading-[1.375] text-slate-500 — the contact line (its emoji icons cannot be embedded). */
  const contact: Style = { fontSize: pt(10.5) * fs, lineHeight: 1.375 * ls, color: SLATE_500 };

  return (
    <View>
      {/* ── Header: border-b border-slate-200 pb-3 mb-4; left block flex-col
          gap-1 with pr-24 reserved for the absolute 76px photo. No
          marginBottom here: in CSS the header's mb-4 (16px) and the first
          section's mt-6·sp (≥ 16.8px) are adjacent block margins and
          COLLAPSE to the larger one; react-pdf would add both. ── */}
      <View
        style={{
          borderBottomWidth: 0.75,
          borderBottomColor: SLATE_200,
          paddingBottom: pt(12),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: pt(96), gap: pt(4) }}>
            <Text
              style={{
                ...bold,
                fontSize: pt(28) * fs,
                lineHeight: 1.1 * ls,
                letterSpacing: -0.025 * pt(28) * fs,
                color: SLATE_900,
              }}
            >
              {name}
            </Text>
            {data.personal.headline?.trim() ? (
              // Live weight 500; the PDF faces ship 400/700 only.
              <Text
                style={{
                  fontSize: pt(14) * fs,
                  lineHeight: rootLine,
                  color: SLATE_500,
                  marginTop: pt(2),
                }}
              >
                {data.personal.headline.trim()}
              </Text>
            ) : null}
            {contacts.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  columnGap: pt(8),
                  rowGap: pt(2),
                  marginTop: pt(6),
                }}
              >
                {contacts.map((item, i) => (
                  <View
                    key={i}
                    style={{ flexDirection: "row", alignItems: "center" }}
                  >
                    {item.href ? (
                      <Link src={item.href} style={{ ...contact, textDecoration: "underline" }}>
                        {item.text}
                      </Link>
                    ) : (
                      <Text style={contact}>{item.text}</Text>
                    )}
                    {i < contacts.length - 1 && (
                      <Text style={{ ...contact, color: SLATE_300, marginLeft: pt(4) }}>|</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
            {essentialChips.length > 0 && (
              // mt-1.5 text-[10px] leading-[1.375] text-slate-600; "Label:" semibold slate-800,
              // a slate-300 middle dot with mx-1.5 between chips — one wrapping text run, as live.
              <Text
                style={{
                  fontSize: pt(10) * fs,
                  lineHeight: 1.375 * ls,
                  color: SLATE_600,
                  marginTop: pt(6),
                }}
              >
                {essentialChips.map((chip, i) => (
                  <Text key={chip.label}>
                    <Text style={{ ...bold, color: SLATE_800 }}>{chip.label}:</Text>
                    {` ${chip.value}`}
                    {i < essentialChips.length - 1 ? (
                      <Text style={{ color: SLATE_300 }}>{"  ·  "}</Text>
                    ) : null}
                  </Text>
                ))}
              </Text>
            )}
          </View>
          {showPhoto && data.personal.photo && (
            <Image
              src={data.personal.photo}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: pt(76),
                height: pt(76),
                borderRadius: data.settings.photoShape === "square" ? pt(8) : pt(38),
                objectFit: "cover",
                borderWidth: pt(2),
                borderColor: SLATE_200,
              }}
            />
          )}
        </View>
      </View>

      {/* ── Summary ── */}
      {hasSummary && (
        <View style={section}>
          {heading("Summary")}
          <Text style={{ ...body, marginTop: contentGap }}>{data.personal.summary?.trim()}</Text>
        </View>
      )}

      {/* ── Skills (hoisted above experience for skills-first domains) ── */}
      {isSkillsFirst(data.settings.domain) ? skillsBlock : null}

      {/* ── Experience: mt-2 space-y-3; each role space-y-1 ── */}
      {hasExperience && (
        <View style={section}>
          {heading("Experience")}
          <View style={{ marginTop: contentGap }}>
            {experience.map((role, i) => (
              <View key={role.id} style={{ marginTop: i > 0 ? pt(12) : 0 }} minPresenceAhead={48}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: pt(12),
                  }}
                >
                  <Text style={{ ...entryTitle, lineHeight: 1.35 * ls, flex: 1 }}>
                    {role.role?.trim() || "Role"}
                    {role.company ? (
                      <Text style={{ ...regular, color: SLATE_700 }}>
                        {` | ${role.company.trim()}`}
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={{ ...small, flexShrink: 0, textAlign: "right" }}>
                    {formatDateRange(
                      role.startDate,
                      role.endDate,
                      role.isCurrent,
                    )}
                  </Text>
                </View>
                {role.location?.trim() && (
                  <Text style={{ ...small, marginTop: pt(4) }}>{role.location.trim()}</Text>
                )}
                <BulletList bullets={role.bullets} s={s} styles={bulletStyles(pt(4))} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Education: mt-2 space-y-3 ── */}
      {hasEducation && (
        <View style={section}>
          {heading("Education")}
          <View style={{ marginTop: contentGap }}>
            {education.map((edu, i) => (
              <EducationEntry key={edu.id} edu={edu} v={eduVariant} index={i} />
            ))}
          </View>
        </View>
      )}

      {/* ── Skills (rendered above if skills-first) ── */}
      {isSkillsFirst(data.settings.domain) ? null : skillsBlock}

      {/* ── Languages & Certifications: grid gap-6 md:grid-cols-2 ── */}
      {(hasLanguages || hasCertifications) && (
        <View style={{ ...section, flexDirection: "row", gap: pt(24) }}>
          {hasLanguages && (
            <View style={{ flex: 1 }}>
              {heading("Languages")}
              <Text style={{ ...body, marginTop: contentGap }}>
                {data.languages.map((lang, i, arr) => (
                  <Text key={lang.id}>
                    <Text style={bold}>{lang.name}</Text>
                    {lang.level
                      ? ` — ${formatLanguageLevel(lang.level)}`
                      : ""}
                    {i < arr.length - 1 ? " | " : ""}
                  </Text>
                ))}
              </Text>
            </View>
          )}
          {hasCertifications && (
            <View style={{ flex: 1 }}>
              {heading("Certifications")}
              {/* mt-2 space-y-2 */}
              <View style={{ marginTop: contentGap }}>
                {data.certifications.map((cert, i) => (
                  <Text key={cert.id} style={{ ...body, marginTop: i > 0 ? pt(8) : 0 }}>
                    <Text style={bold}>{cert.name.trim()}</Text>
                    <Text style={{ color: SLATE_500 }}>
                      {cert.issuer ? ` | ${cert.issuer.trim()}` : ""}
                      {cert.date ? ` | ${cert.date.trim()}` : ""}
                    </Text>
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Projects: heading, first title mt-2, later projects mt-3, bullets flush under the title ── */}
      {hasProjects && (
        <View style={section}>
          {heading("Projects")}
          {projects.map((project, i) => {
            const showLink = shouldShowProjectLink(project.link);
            return (
              <View key={project.id} style={{ marginTop: i === 0 ? contentGap : pt(12) }} wrap={false}>
                <Text style={entryTitle}>
                  {project.name?.trim() || "Project"}
                  {showLink ? (
                    <Text style={{ ...regular, color: SLATE_500 }}>
                      {" | "}
                      <Link
                        src={normalizeHref(project.link)}
                        style={{
                          ...regular,
                          color: SLATE_500,
                          textDecoration: "underline",
                        }}
                      >
                        {project.link?.trim()}
                      </Link>
                    </Text>
                  ) : null}
                </Text>
                <BulletList bullets={project.bullets ?? []} s={s} styles={bulletStyles(0)} />
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
  const fs = theme.fontScale;
  // executive.tsx sets no root line-height, so every run without its own
  // inherits Tailwind's 1.5 (LH_NORMAL, not scaled by the Line Height
  // slider); the PDF used to leave these on the page's 12.47pt box
  // (PDF_FIDELITY.md session 4, 2026-10-31).
  const eduVariant: EducationVariant = {
    joiner: " \u2014 ",
    titleStyle: { fontSize: pt(11) * fs, lineHeight: LH_NORMAL, fontFamily: fonts.bold, fontWeight: 700, color: "#111827" },
    dateStyle: { fontSize: pt(10) * fs, lineHeight: LH_NORMAL, color: "#6B7280" },
    schoolStyle: { fontSize: pt(11) * fs, lineHeight: LH_NORMAL, color: "#374151" },
    notesStyle: { fontSize: pt(10) * fs, lineHeight: LH_NORMAL, color: "#6B7280" },
    attested: "pill",
    attestedStyle: {
      fontSize: pt(8) * fs,
      color: theme.accentText,
      lineHeight: 1.4 * theme.lineScale,
    },
    attestedUppercase: true,
    gap: pt(10),
  };
  const firstMain = hasSummary
    ? "summary"
    : hasExperience
      ? "experience"
      : hasEducation
        ? "education"
        : hasProjects
          ? "projects"
          : null;
  const mainHeading = withTopGap<Omit<HeadingVariant, "marginTop">>(
    {
      fontSize: pt(10) * fs,
      // The live heading is a 10px span inside a div whose strut is the
      // root 11px × 1.5 = 16.5px, so the line box is 1.65 × the span size.
      lineHeight: 1.65,
      color: theme.accentText,
      letterSpacing: 0.08 * pt(10) * fs,
      uppercase: true,
      ruleColor: theme.accentText,
      ruleWidth: 0.75,
      paddingBottom: pt(3),
      marginBottom: pt(8),
    },
    pt(20) * theme.spaceScale,
    firstMain,
  );
  const expVariant: ExperienceVariant = {
    roleStyle: { fontSize: pt(12) * fs, lineHeight: LH_NORMAL, fontFamily: fonts.bold, fontWeight: 700, color: "#111827" },
    dateStyle: { fontSize: pt(10) * fs, lineHeight: LH_NORMAL, color: "#6B7280" },
    companyStyle: { fontSize: pt(11) * fs, lineHeight: LH_NORMAL, color: "#374151" },
    separator: " | ",
    bulletText: { fontSize: pt(11) * fs, lineHeight: 1.55 * theme.lineScale, color: "#374151" },
    bulletsMarginTop: pt(4),
    bulletsPaddingLeft: pt(12),
    gap: pt(12),
  };
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

  // executive.tsx sidebar: 22px bold stacked name, 12px headline, a 15%-ink
  // rule with 16px above/below; 9px bold uppercase labels, each section
  // 20px*sp below the previous one (the first sits right under the rule).
  const execName: Style = {
    fontSize: pt(22) * fs,
    fontFamily: fonts.bold, fontWeight: 700,
    color: onAccent,
    lineHeight: 1.15 * theme.lineScale,
  };
  const firstSide =
    sidebarContacts.length > 0
      ? "contact"
      : essentialChips.length > 0
        ? "personal"
        : hasSkills
          ? "skills"
          : hasLanguages
            ? "languages"
            : hasCertifications
              ? "certifications"
              : null;
  const sideLabel = withTopGap<Style>(
    {
      fontSize: pt(9) * fs,
      lineHeight: LH_NORMAL,
      fontFamily: fonts.bold, fontWeight: 700,
      color: onAccentMuted,
      // Live 0.1em; capped so pdf.js / ATS text layers do not read the label
      // as spaced letters ("C O N TAC T", audit 2026-10 defect 39).
      letterSpacing: safeTracking(0.1 * pt(9) * fs, pt(9) * fs),
      textTransform: "uppercase",
      marginBottom: pt(8),
    },
    pt(20) * theme.spaceScale,
    firstSide,
  );

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
      {/* ── Sidebar (transparent; the fixed band above is its fill). Pulled
          to the page edges with margins that undo the SCALED page padding, so
          its own padding stays the live 28px/20px whatever the margin level. ── */}
      <View
        style={{
          width: 150,
          marginTop: -27 * m,
          marginBottom: -27 * m,
          marginLeft: -24 * m,
          paddingTop: pt(28),
          paddingBottom: pt(28),
          paddingLeft: pt(20),
          paddingRight: pt(20),
          flexShrink: 0,
        }}
      >
        {/* Photo */}
        {showPhoto && data.personal.photo && (
          <View style={{ marginBottom: pt(16) }}>
            {/* live photoSize 88px, 2px ring, 16px below */}
            <Image
              src={data.personal.photo}
              style={{
                width: pt(88),
                height: pt(88),
                borderRadius:
                  data.settings.photoShape === "square" ? pt(8) : pt(44),
                objectFit: "cover",
                borderWidth: pt(2),
                borderColor: mix(onAccent, theme.accent, 0.8),
              }}
            />
          </View>
        )}

        {/* Name block — stacked first/last lines over the headline, closed
            by the 15%-ink rule (mirrors live executive) */}
        <View
          style={{
            borderBottomWidth: 0.75,
            borderBottomColor: mix(onAccent, theme.accent, 0.85),
            paddingBottom: pt(16),
            marginBottom: pt(16),
          }}
        >
          {data.personal.firstName?.trim() || data.personal.lastName?.trim() ? (
            <>
              {data.personal.firstName?.trim() ? (
                <Text style={execName}>{data.personal.firstName.trim()}</Text>
              ) : null}
              {data.personal.lastName?.trim() ? (
                <Text style={execName}>{data.personal.lastName.trim()}</Text>
              ) : null}
            </>
          ) : (
            <Text style={execName}>Your Name</Text>
          )}
          {data.personal.headline?.trim() ? (
            <Text
              style={{
                fontSize: pt(12) * fs,
                color: onAccentMuted,
                marginTop: pt(6),
                lineHeight: 1.4 * theme.lineScale,
              }}
            >
              {data.personal.headline.trim()}
            </Text>
          ) : null}
        </View>

        {/* Contact */}
        {sidebarContacts.length > 0 && (
          <View>
            <Text style={sideLabel("contact")}>Contact</Text>
            {/* live: 10px × 1.6 rows in a 4px-gap column, no trailing margin */}
            {sidebarContacts.map((item, i) =>
              item.href ? (
                <Link
                  key={i}
                  src={item.href}
                  style={{
                    ...s.execContactItem,
                    color: onAccentMuted,
                    textDecoration: "underline",
                    marginBottom: 0,
                    marginTop: i > 0 ? pt(4) : 0,
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
                    marginBottom: 0,
                    marginTop: i > 0 ? pt(4) : 0,
                    ...(item.fontSize ? { fontSize: item.fontSize } : {}),
                  }}
                >
                  {item.text}
                </Text>
              ),
            )}
          </View>
        )}

        {/* Personal: 10px × 1.5 rows, 4px apart, "Label:" bold at 0.04em */}
        {essentialChips.length > 0 && (
          <View>
            <Text style={sideLabel("personal")}>Personal</Text>
            {essentialChips.map((chip, i) => (
              <Text
                key={chip.label}
                style={{
                  fontSize: pt(10) * fs,
                  lineHeight: 1.5 * theme.lineScale,
                  color: onAccentMuted,
                  marginTop: i > 0 ? pt(4) : 0,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontWeight: 700,
                    letterSpacing: safeTracking(0.04 * pt(10) * fs, pt(10) * fs),
                  }}
                >
                  {chip.label}:
                </Text>
                {` ${chip.value}`}
              </Text>
            ))}
          </View>
        )}

        {/* Skills: 10px × 1.7 rows (the 12px dot sits inside that box), 2px apart */}
        {hasSkills && (
          <View>
            <Text style={sideLabel("skills")}>Skills</Text>
            {data.skills.map((skill, i) => (
              <Text
                key={skill.id}
                style={{ ...s.execSkillItem, color: onAccentMuted, marginTop: i > 0 ? pt(2) : 0 }}
              >
                <Text style={{ color: onAccentMuted }}>{"·  "}</Text>
                {skill.name}
              </Text>
            ))}
          </View>
        )}

        {/* Languages: 10px × 1.7 rows, 2px apart */}
        {hasLanguages && (
          <View>
            <Text style={sideLabel("languages")}>Languages</Text>
            {data.languages.map((lang, i) => (
              <Text
                key={lang.id}
                style={{ ...s.execSkillItem, color: onAccentMuted, marginTop: i > 0 ? pt(2) : 0 }}
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

        {/* Certifications: 10px bold name over a 9px issuer line, both × 1.4, entries 6px apart */}
        {hasCertifications && (
          <View>
            <Text style={sideLabel("certifications")}>Certifications</Text>
            {data.certifications.map((cert, i) => (
              <View key={cert.id} style={{ marginTop: i > 0 ? pt(6) : 0 }}>
                <Text
                  style={{
                    fontSize: pt(10) * fs,
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
                      fontSize: pt(9) * fs,
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

      {/* ── Main column: live padding 28px·m = 21·m pt on every side. The
          page pads 27·m top / 24·m right, so the column pulls itself up by
          6·m and out by 3·m to start and wrap where the preview does; the
          bottom keeps the page padding (it only decides where page 2 starts). ── */}
      <View
        style={{
          flex: 1,
          paddingLeft: pt(28) * m,
          marginTop: -(27 - pt(28)) * m,
          marginRight: -(24 - pt(28)) * m,
        }}
      >
        {/* Summary: 11px × 1.6 in #374151 */}
        {hasSummary && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("summary")}>Summary</PdfHeading>
            <Text style={{ fontSize: pt(11) * fs, lineHeight: 1.6 * theme.lineScale, color: "#374151" }}>
              {data.personal.summary?.trim()}
            </Text>
          </View>
        )}

        {/* Experience */}
        {hasExperience && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("experience")}>Experience</PdfHeading>
            {experience.map((role, i) => (
              <ExperienceEntry key={role.id} role={role} v={expVariant} index={i} s={s} />
            ))}
          </View>
        )}

        {/* Education */}
        {hasEducation && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("education")}>Education</PdfHeading>
            {education.map((edu, i) => (
              <EducationEntry key={edu.id} edu={edu} v={eduVariant} index={i} />
            ))}
          </View>
        )}

        {/* Projects */}
        {hasProjects && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("projects")}>Projects</PdfHeading>
            {/* executive.tsx 616–690: 11px bold name, 10px accent link on its
                own line, disc bullets 12px in at 11px × 1.55, projects 10px apart */}
            {projects.map((project, i) => {
              const showLink = shouldShowProjectLink(project.link);
              return (
                <View key={project.id} style={{ marginTop: i > 0 ? pt(10) : 0 }} wrap={false}>
                  <Text style={{ fontSize: pt(11) * fs, lineHeight: LH_NORMAL, fontFamily: fonts.bold, fontWeight: 700, color: "#111827" }}>
                    {project.name?.trim() || "Project"}
                  </Text>
                  {showLink && (
                    <Link
                      src={normalizeHref(project.link)}
                      style={{ fontSize: pt(10) * fs, lineHeight: LH_NORMAL, color: theme.accentText, textDecoration: "none" }}
                    >
                      {project.link!.trim()}
                    </Link>
                  )}
                  <BulletList
                    bullets={project.bullets ?? []}
                    s={s}
                    styles={{
                      list: { marginTop: pt(3), paddingLeft: Math.max(0, pt(12) - BULLET_DOT_WIDTH) },
                      item: { marginBottom: 0 },
                      dot: { width: BULLET_DOT_WIDTH, fontSize: pt(11) * fs, color: "#374151" },
                      text: expVariant.bulletText,
                    }}
                  />
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
  /*
   * Transcribed from lib/templates/ats-clean.tsx (PDF_FIDELITY.md rank 2 →
   * rank 5 residual, 2026-10-31 session 3). Every size is the live px value
   * through pt(); every line-height is the live ratio (the root 1.55 where
   * the live element inherits it) — set explicitly on each <Text>, because a
   * react-pdf child inherits its parent's RESOLVED line box, not the ratio.
   * fontScale on sizes, lineScale on line-heights, spaceScale only on the
   * gap between sections (the live SectionHeading marginTop), marginScale on
   * the page padding via the router. Before this pass the header alone put
   * the SUMMARY rule ~16pt lower than the preview.
   */
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
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;

  const ATS_INK = "#111827";
  const ATS_TEXT = "#374151";
  const ATS_MUTED = "#6B7280";
  const bold: Style = { fontFamily: fonts.bold, fontWeight: 700 };
  /** The live root: 11.5px × 1.55, inherited by everything that sets no own line-height. */
  const rootLine = 1.55 * ls;
  const body: Style = { fontSize: pt(11.5) * fs, lineHeight: rootLine, color: ATS_TEXT };
  const small: Style = { fontSize: pt(11) * fs, lineHeight: rootLine, color: ATS_TEXT };
  const muted: Style = { fontSize: pt(10.5) * fs, lineHeight: rootLine, color: ATS_MUTED };
  const entryTitle: Style = { ...bold, fontSize: pt(11.5) * fs, lineHeight: rootLine, color: ATS_INK };

  const eduVariant: EducationVariant = {
    joiner: " in ",
    titleStyle: entryTitle,
    dateStyle: muted,
    schoolStyle: small,
    notesStyle: muted,
    attested: "inline",
    attestedStyle: { fontSize: pt(10) * fs, color: GREEN_700 },
    gap: pt(10),
  };
  // Role ............ dates / Company · Location / disc bullets 16px in, no
  // gap between bullets, 12px between roles (ats-clean.tsx 365–465).
  const expVariant: ExperienceVariant = {
    roleStyle: entryTitle,
    dateStyle: muted,
    companyStyle: small,
    separator: " · ",
    companyMarginBottom: pt(4),
    bulletText: small,
    bulletsMarginTop: 0,
    bulletsPaddingLeft: pt(16),
    gap: pt(12),
  };
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

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

  // Live SectionHeading: 20px·sp above (0 for the first section), 8px below,
  // 11px bold uppercase at 0.1em over a 1.5px #111827 rule with 3px padding.
  const headingVariant = withTopGap<HeadingVariant>(
    {
      fontSize: pt(11) * fs,
      lineHeight: rootLine,
      color: ATS_INK,
      letterSpacing: 0.1 * pt(11) * fs,
      uppercase: true,
      ruleColor: ATS_INK,
      ruleWidth: pt(1.5),
      paddingBottom: pt(3),
      marginBottom: pt(8),
      marginTop: 0,
    },
    pt(20) * sp,
    firstSection,
  );
  const heading = (id: string, label: string) => (
    <PdfHeading v={headingVariant(id)} fonts={fonts}>
      {label}
    </PdfHeading>
  );

  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );
  const skillsBlock =
    generalSkills.length > 0 || technicalSkills.length > 0 ? (
      <>
        {generalSkills.length > 0 && (
          <View>
            {heading("skills", "Skills")}
            {/* Text line, not chips, in both renderers — the ATS-safer form
                (template audit 2026-10 defect 9); ats-clean.tsx matches. */}
            <Text style={body}>
              {generalSkills.map((sk) => sk.name).join(" · ")}
            </Text>
          </View>
        )}
        {technicalSkills.length > 0 && (
          <View>
            {heading(generalSkills.length === 0 ? "skills" : "technical-skills", "Technical Skills")}
            <Text style={body}>
              {technicalSkills.map((sk) => sk.name).join(" · ")}
            </Text>
          </View>
        )}
      </>
    ) : null;

  return (
    <View>
      {/* ── Header: name / headline / contact / essentials beside a 72px photo ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: pt(16),
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...bold,
              fontSize: pt(26) * fs,
              lineHeight: 1.2 * ls,
              color: ATS_INK,
              letterSpacing: pt(-0.3),
              marginBottom: pt(2),
            }}
          >
            {name}
          </Text>
          {data.personal.headline?.trim() ? (
            // Live weight 500; the PDF faces ship 400/700 only and the
            // regular cut is the nearer match.
            <Text
              style={{
                fontSize: pt(13) * fs,
                lineHeight: rootLine,
                color: ATS_TEXT,
                marginBottom: pt(8),
              }}
            >
              {data.personal.headline.trim()}
            </Text>
          ) : null}
          {contactParts.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: pt(4) }}>
              {contactParts.map((item, i) => (
                <View key={i} style={{ flexDirection: "row" }}>
                  {item.href ? (
                    <Link src={item.href} style={{ ...muted, textDecoration: "none" }}>
                      {item.text}
                    </Link>
                  ) : (
                    <Text style={muted}>{item.text}</Text>
                  )}
                  {i < contactParts.length - 1 && (
                    <Text style={{ ...muted, marginHorizontal: 2 }}>·</Text>
                  )}
                </View>
              ))}
            </View>
          )}
          {essentialsLine && (
            <Text
              style={{
                fontSize: pt(10) * fs,
                lineHeight: rootLine,
                color: ATS_TEXT,
                marginTop: pt(2),
              }}
            >
              {essentialsLine}
            </Text>
          )}
        </View>
        {showPhoto && data.personal.photo && (
          <Image
            src={data.personal.photo}
            style={{
              width: pt(72),
              height: pt(72),
              borderRadius: data.settings.photoShape === "square" ? pt(6) : pt(36),
              objectFit: "cover",
              borderWidth: 0.75,
              borderColor: "#E5E7EB",
            }}
          />
        )}
      </View>
      {/* 2px accent rule, 8px under the header and 16px above the first section. */}
      <View
        style={{
          borderBottomWidth: pt(2),
          borderBottomColor: theme.accentText,
          marginTop: pt(8),
          marginBottom: pt(16),
        }}
      />

      {/* ── Summary ── */}
      {hasSummary && (
        <View>
          {heading("summary", "Summary")}
          <Text style={{ ...body, lineHeight: 1.6 * ls }}>
            {data.personal.summary?.trim()}
          </Text>
        </View>
      )}

      {/* ── Skills (hoisted above experience for skills-first domains) ── */}
      {skillsFirst ? skillsBlock : null}

      {/* ── Experience ── */}
      {hasExperience && (
        <View>
          {heading("experience", "Experience")}
          {experience.map((role, i) => (
            <ExperienceEntry key={role.id} role={role} v={expVariant} index={i} s={s} />
          ))}
        </View>
      )}

      {/* ── Education ── */}
      {hasEducation && (
        <View>
          {heading("education", "Education")}
          {education.map((edu, i) => (
            <EducationEntry key={edu.id} edu={edu} v={eduVariant} index={i} />
          ))}
        </View>
      )}

      {/* ── Skills (rendered above if skills-first) ── */}
      {skillsFirst ? null : skillsBlock}

      {/* ── Languages: "Name — Level, Name — Level" on one line, as live ── */}
      {hasLanguages && (
        <View>
          {heading("languages", "Languages")}
          <Text style={small}>
            {data.languages.map((lang, i) => (
              <Text key={lang.id}>
                {i > 0 ? ", " : ""}
                <Text style={bold}>{lang.name}</Text>
                {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
              </Text>
            ))}
          </Text>
        </View>
      )}

      {/* ── Certifications: one line each, 4px apart ── */}
      {hasCertifications && (
        <View>
          {heading("certifications", "Certifications")}
          {data.certifications.map((cert, i) => (
            <Text key={cert.id} style={{ ...small, marginTop: i > 0 ? pt(4) : 0 }}>
              <Text style={bold}>{cert.name.trim()}</Text>
              {cert.issuer ? ` · ${cert.issuer.trim()}` : ""}
              {cert.date ? ` · ${cert.date.trim()}` : ""}
            </Text>
          ))}
        </View>
      )}

      {/* ── Projects ── */}
      {hasProjects && (
        <View>
          {heading("projects", "Projects")}
          {projects.map((project, i) => {
            const showLink = shouldShowProjectLink(project.link);
            return (
              <View key={project.id} style={{ marginTop: i > 0 ? pt(10) : 0 }} wrap={false}>
                <Text style={entryTitle}>{project.name?.trim() || "Project"}</Text>
                {showLink && (
                  <Text
                    style={{
                      fontSize: pt(10) * fs,
                      lineHeight: rootLine,
                      color: ATS_MUTED,
                      marginTop: pt(1),
                    }}
                  >
                    {"("}
                    <Link
                      src={normalizeHref(project.link)}
                      style={{ fontSize: pt(10) * fs, color: ATS_MUTED, textDecoration: "none" }}
                    >
                      {project.link!.trim()}
                    </Link>
                    {")"}
                  </Text>
                )}
                <BulletList
                  bullets={project.bullets ?? []}
                  s={s}
                  styles={{
                    list: { marginTop: pt(3), paddingLeft: pt(16) - BULLET_DOT_WIDTH },
                    item: { marginBottom: 0 },
                    dot: { width: BULLET_DOT_WIDTH, fontSize: small.fontSize, color: ATS_TEXT },
                    text: small,
                  }}
                />
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

/** A4 width in pt; the live preview frame is 794px = 595.5pt at 96 DPI. */
const A4_WIDTH_PT = 595.28;
const MODERN_SLATE_100 = "#F1F5F9";
const MODERN_EMERALD_50 = "#ECFDF5";
const MODERN_EMERALD_200 = "#A7F3D0";
const MODERN_EMERALD_700 = "#047857";

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
  /**
   * modern.tsx sets every line-height as `leading-[calc(Xrem*var(--lh))]`:
   * an ABSOLUTE px box scaled by the Line Height slider only, never by the
   * font size. A react-pdf ratio multiplies the (fontScale-scaled) size, so
   * the ratio must be divided by fontScale to land on the same box — before
   * this (session 4, 2026-10-31) every Modern line was 10 % too tall at
   * density 5 and 10 % too short at density 1, compounding down the column.
   */
  const absLine = (boxPx: number, fontPx: number) => ((boxPx / fontPx) * ls) / fs;
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
    lineHeight: absLine(16, 12),
    ...bold,
    textTransform: "uppercase",
    // Live tracking-[0.2em]; capped for the text layer (see safeTracking).
    letterSpacing: safeTracking(0.2 * 9 * fs, 9 * fs),
    color: SLATE_500,
  };
  // text-sm/5 text-slate-700 — paragraphs, bullets, languages, certs
  const body: Style = {
    fontSize: 10.5 * fs,
    lineHeight: absLine(20, 14),
    color: SLATE_700,
  };
  // text-sm/5 font-semibold in the root's slate-900 — role, school, project
  const bodyStrong: Style = { ...body, ...bold, color: SLATE_900 };
  // text-xs/4 text-slate-500 — contact, company line, degree line
  const small: Style = {
    fontSize: 9 * fs,
    lineHeight: absLine(16, 12),
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
              // leading-[calc(2.25rem*var(--lh))] = 36px·lh over a 30px·fs face
              lineHeight: absLine(36, 30),
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
                lineHeight: absLine(20, 14),
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
          {/* rounded-full border-emerald-200 bg-emerald-50 px-2 py-0.5; label
              9px semibold uppercase tracking-wider emerald-700, value 10px */}
          <PdfChips
            items={essentialChips}
            v={{
              fontSize: 7.5 * fs,
              lineHeight: 1.375 * ls,
              color: SLATE_700,
              backgroundColor: MODERN_EMERALD_50,
              borderColor: MODERN_EMERALD_200,
              borderRadius: 999,
              paddingVertical: 1.5,
              paddingHorizontal: 6,
              gap: 4.5,
              labelStyle: {
                fontSize: 6.75 * fs,
                ...bold,
                textTransform: "uppercase",
                letterSpacing: 0.05 * 6.75 * fs,
                color: MODERN_EMERALD_700,
              },
              labelGap: 3,
            }}
            style={{ marginTop: 3 }}
          />
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

      {/* ── Body: grid-cols-[2fr_1fr] gap-8 → a 2fr main column and a 1fr
          track holding the 200px (150pt) aside at its start. The aside used
          to be a fixed 150pt sibling, which handed the main column the rest
          of the 1fr track (~20pt wider than live) and shifted the aside
          right. Widths are resolved here exactly as the grid does (Yoga's
          flexGrow split between a text column and a chip-wrap column did
          not land on 2:1); the 1fr track is ≥ 169pt at every margin level,
          so the aside's 200px minimum never binds. ── */}
      <View style={{ flexDirection: "row", gap: 24, marginTop: sectionGap }}>
        {/* ── Main column ── */}
        <View style={{ width: ((A4_WIDTH_PT - 2 * 24 * theme.marginScale) - 24) * (2 / 3) }}>
          {/* Sections are FLAT children of the column, not wrapped Views:
              react-pdf honours a heading's minPresenceAhead only when the
              heading has a previous sibling on the page (@react-pdf/layout
              shouldBreak → breakingImprovesPresence), so a heading that
              opened its own section View was orphaned at the foot of a page
              (Certifications at density 5, session 4). The section gap sits
              on the heading instead; nothing else moves. */}
          {hasSummary && (
            <>
              <ModernHeading style={{ ...heading, ...gapFor(mainOrder, "profile") }}>Profile</ModernHeading>
              <Text style={{ ...body, marginTop: 6 }}>
                {data.personal.summary?.trim()}
              </Text>
            </>
          )}

          {hasExperience && (
            <>
              <ModernHeading style={{ ...heading, ...gapFor(mainOrder, "experience") }}>Experience</ModernHeading>
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
            </>
          )}

          {hasLanguages && (
            <>
              <ModernHeading style={{ ...heading, ...gapFor(mainOrder, "languages") }}>Languages</ModernHeading>
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
            </>
          )}

          {hasCertifications && (
            <>
              <ModernHeading style={{ ...heading, ...gapFor(mainOrder, "certifications") }}>Certifications</ModernHeading>
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
            </>
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

        {/* ── Aside: the 1fr track, with the live 200px / flex-shrink-0 column inside it ── */}
        <View style={{ flex: 1 }}>
        <View style={{ width: 150 }}>
          {hasEducation && (
            <>
              <ModernHeading style={{ ...heading, ...gapFor(asideOrder, "education") }}>Education</ModernHeading>
              {/* mt-3 space-y-3 */}
              <View style={{ marginTop: 9 }}>
                {education.map((edu, i) => {
                  const dates = formatDateRange(edu.startDate, edu.endDate);
                  const attestedBy = edu.attested
                    ? edu.attestingBody?.trim() || ""
                    : "";
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
                        {educationTitle(edu.degree, edu.field, " - ")}
                      </Text>
                      {dates ? (
                        <Text style={{ ...small, color: SLATE_400 }}>{dates}</Text>
                      ) : null}
                      {attestedBy ? (
                        <Text
                          style={{
                            ...small,
                            color: GREEN_700,
                            marginTop: 1.5,
                          }}
                        >
                          {attestedLabel(attestedBy)}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {hasSkills && (
            <>
              <ModernHeading style={{ ...heading, ...gapFor(asideOrder, "skills") }}>Skills</ModernHeading>
              {/* mt-3 flex-wrap gap-2; rounded-full bg-slate-100 px-3 py-1 */}
              <PdfChips
                items={data.skills.map((sk) => ({ value: sk.name }))}
                v={{
                  fontSize: 9 * fs,
                  lineHeight: absLine(16, 12),
                  color: SLATE_900,
                  backgroundColor: MODERN_SLATE_100,
                  borderRadius: 999,
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                  gap: 6,
                }}
                style={{ marginTop: 9 }}
              />
            </>
          )}
        </View>
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
  const fs = theme.fontScale;
  const m = theme.marginScale;
  const eduVariant: EducationVariant = {
    joiner: " in ",
    titleStyle: { fontSize: pt(11) * fs, fontFamily: fonts.bold, fontWeight: 700, color: "#111827" },
    dateStyle: { fontSize: pt(10) * fs, color: "#6B7280" },
    schoolStyle: { fontSize: pt(10.5) * fs, color: "#475569" },
    notesStyle: { fontSize: pt(10) * fs, color: "#6B7280" },
    attested: "inline",
    attestedStyle: { fontSize: pt(9) * fs, color: GREEN_700 },
    gap: pt(8),
  };
  const heading: HeadingVariant = {
    fontSize: pt(9.5) * fs,
    color: theme.accentText,
    letterSpacing: 0.12 * pt(9.5) * fs,
    uppercase: true,
    ruleColor: "#CBD5E1",
    ruleWidth: 0.75,
    paddingBottom: pt(3),
    marginBottom: pt(6),
    marginTop: pt(16) * theme.spaceScale,
  };
  const expVariant: ExperienceVariant = {
    roleStyle: { fontSize: pt(11.5) * fs, fontFamily: fonts.bold, fontWeight: 700, color: "#111827" },
    dateStyle: { fontSize: pt(10) * fs, color: "#6B7280" },
    companyStyle: { fontSize: pt(10.5) * fs, color: "#475569" },
    separator: " \u00B7 ",
    companyMarginBottom: pt(3),
    bulletText: { fontSize: pt(10.5) * fs, lineHeight: 1.5 * theme.lineScale, color: "#374151" },
    bulletsMarginTop: 0,
    bulletsPaddingLeft: pt(14),
    gap: pt(10),
  };
  const { onAccent, onAccentMuted } = theme;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

  return (
    <View>
      {/* ── Dark Header — bleeds through the SCALED page padding; live
          padding 28px 32px*m 24px 32px*m ── */}
      <View
        style={{
          backgroundColor: theme.accent,
          marginTop: -27 * m,
          marginLeft: -24 * m,
          marginRight: -24 * m,
          paddingTop: pt(28),
          paddingBottom: pt(24),
          paddingLeft: pt(32) * m,
          paddingRight: pt(32) * m,
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
          {/* exec-split.tsx essentials: 9px pills, 10% ink fill + 18% ink
              border (opaque via mix), radius 999, 2px 8px, gap 6px */}
          <PdfChips
            items={essentialChips}
            v={{
              fontSize: pt(9) * fs,
              lineHeight: 1.5 * theme.lineScale,
              color: onAccentMuted,
              backgroundColor: mix(onAccent, theme.accent, 0.9),
              borderColor: mix(onAccent, theme.accent, 0.82),
              borderRadius: 999,
              paddingVertical: pt(2),
              paddingHorizontal: pt(8),
              gap: pt(6),
              letterSpacing: 0.02 * pt(9) * fs,
              labelStyle: { fontFamily: fonts.bold, fontWeight: 700 },
              labelGap: pt(4),
            }}
            style={{ marginTop: pt(8) }}
          />
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

      {/* ── Two-column body — live padding-top 20px*m, column gap 28px,
          200px right column ── */}
      <View style={{ flexDirection: "row", marginTop: pt(20) * m, gap: pt(28) }}>
        {/* Left — main */}
        <View style={{ flex: 1 }}>
          {hasExperience && (
            <View>
              <PdfHeading fonts={fonts} v={heading}>Experience</PdfHeading>
              {experience.map((role, i) => (
                <ExperienceEntry key={role.id} role={role} v={expVariant} index={i} s={s} />
              ))}
            </View>
          )}

          {hasEducation && (
            <View>
              <PdfHeading fonts={fonts} v={heading}>Education</PdfHeading>
              {education.map((edu, i) => (
                <EducationEntry key={edu.id} edu={edu} v={eduVariant} index={i} />
              ))}
            </View>
          )}

          {hasProjects && (
            <View>
              <PdfHeading fonts={fonts} v={heading}>Projects</PdfHeading>
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
        <View style={{ width: pt(200), flexShrink: 0 }}>
          {hasSummary && (
            <View>
              <PdfHeading fonts={fonts} v={heading}>Summary</PdfHeading>
              <Text style={{ ...s.body, fontSize: 8 * theme.fontScale }}>
                {data.personal.summary?.trim()}
              </Text>
            </View>
          )}

          {hasSkills && (
            <View>
              <PdfHeading fonts={fonts} v={heading}>Skills</PdfHeading>
              {/* 9.5px accentText on #F1F5F9, 1px #CBD5E1, radius 3, 1px 6px, gap 4px */}
              <PdfChips
                items={data.skills.map((sk) => ({ value: sk.name }))}
                v={{
                  fontSize: pt(9.5) * fs,
                  lineHeight: 1.5 * theme.lineScale,
                  color: theme.accentText,
                  backgroundColor: "#F1F5F9",
                  borderColor: "#CBD5E1",
                  borderRadius: pt(3),
                  paddingVertical: pt(1),
                  paddingHorizontal: pt(6),
                  gap: pt(4),
                }}
              />
            </View>
          )}

          {hasLanguages && (
            <View>
              <PdfHeading fonts={fonts} v={heading}>Languages</PdfHeading>
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
            <View>
              <PdfHeading fonts={fonts} v={heading}>Certifications</PdfHeading>
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
  const fs = theme.fontScale;
  const eduVariant: EducationVariant = {
    joiner: " \u2014 ",
    titleStyle: { fontSize: pt(11) * fs, fontFamily: fonts.bold, fontWeight: 700, color: "#0F172A" },
    dateStyle: { fontSize: pt(10) * fs, color: "#64748B" },
    schoolStyle: { fontSize: pt(10.5) * fs, color: "#475569" },
    notesStyle: { fontSize: pt(10) * fs, color: "#64748B" },
    attested: "pill",
    attestedStyle: {
      fontSize: pt(8) * fs,
      color: GREEN_700,
      lineHeight: 1.4 * theme.lineScale,
    },
    pillBorderColor: "#BBF7D0",
    gap: pt(8),
  };
  const mainHeading = withTopGap<Omit<HeadingVariant, "marginTop">>(
    {
      fontSize: pt(10) * fs,
      color: "#1E293B",
      letterSpacing: 0.08 * pt(10) * fs,
      uppercase: true,
      ruleColor: "#E2E8F0",
      ruleWidth: 0.75,
      paddingBottom: pt(3),
      marginBottom: pt(6),
    },
    pt(18) * theme.spaceScale,
    null,
  );
  const expVariant: ExperienceVariant = {
    roleStyle: { fontSize: pt(11.5) * fs, fontFamily: fonts.bold, fontWeight: 700, color: "#0F172A" },
    dateStyle: { fontSize: pt(10) * fs, color: "#64748B" },
    companyStyle: { fontSize: pt(10.5) * fs, color: "#475569" },
    separator: " | ",
    companyMarginBottom: pt(3),
    bulletText: { fontSize: pt(10.5) * fs, lineHeight: 1.5 * theme.lineScale, color: "#374151" },
    bulletsMarginTop: 0,
    bulletsPaddingLeft: pt(14),
    gap: pt(10),
  };
  const m = theme.marginScale;
  const { onAccent, onAccentMuted } = theme;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  // corp-sidebar.tsx SidebarHeading: 9px bold uppercase at 50% ink, 18px*sp
  // above every label (the live file has no first-section exception).
  const sideLabel = withTopGap<Style>(
    {
      fontSize: pt(9) * fs,
      fontFamily: fonts.bold, fontWeight: 700,
      color: mix(onAccent, theme.accent, 0.5),
      letterSpacing: safeTracking(0.1 * pt(9) * fs, pt(9) * fs),
      textTransform: "uppercase",
      marginBottom: pt(6),
    },
    pt(18) * theme.spaceScale,
    null,
  );
  const SIDEBAR_WIDTH = pt(220);

  return (
    <>
      {/* Fixed band: reaches the page edges on every page (the sidebar View's
          own background left white notches at the top of page 2+ and the foot
          of page 1 — audit 2026-10 defect 19). */}
      <View
        fixed
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: SIDEBAR_WIDTH,
          backgroundColor: theme.accent,
        }}
      />
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Left main content (live padding 36px*m 28px*m 36px*m 32px*m; the
          top/bottom/left come from the scaled page padding) ── */}
      <View style={{ flex: 1, paddingRight: pt(28) * m }}>
        {/* Name header — live: 26px name, 12px headline, 2px accent rule 10px
            below, 16px under the block */}
        <View
          style={{
            borderBottomWidth: 1.5,
            borderBottomColor: theme.accentText,
            paddingBottom: pt(10),
            marginBottom: pt(16),
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
            <PdfHeading fonts={fonts} v={mainHeading("summary")}>Summary</PdfHeading>
            <Text style={s.body}>{data.personal.summary?.trim()}</Text>
          </View>
        )}

        {hasExperience && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("experience")}>Experience</PdfHeading>
            {experience.map((role, i) => (
              <ExperienceEntry key={role.id} role={role} v={expVariant} index={i} s={s} />
            ))}
          </View>
        )}

        {hasEducation && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("education")}>Education</PdfHeading>
            {education.map((edu, i) => (
              <EducationEntry key={edu.id} edu={edu} v={eduVariant} index={i} />
            ))}
          </View>
        )}

        {hasProjects && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("projects")}>Projects</PdfHeading>
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

      {/* ── Right sidebar (transparent; the fixed band is its fill). Margins
          undo the scaled page padding so the live 36px/20px padding holds. ── */}
      <View
        style={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          marginTop: -27 * m,
          marginBottom: -27 * m,
          marginRight: -24 * m,
          paddingTop: pt(36),
          paddingBottom: pt(36),
          paddingLeft: pt(20),
          paddingRight: pt(20),
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
            <Text style={sideLabel("contact")}>Contact</Text>
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
            <Text style={sideLabel("personal")}>Personal</Text>
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
            <Text style={sideLabel("skills")}>Skills</Text>
            <PdfChips
              items={data.skills.map((sk) => ({ value: sk.name }))}
              v={{
                fontSize: pt(9) * fs,
                lineHeight: 1.5 * theme.lineScale,
                color: onAccentMuted,
                backgroundColor: mix(onAccent, theme.accent, 0.92),
                borderRadius: pt(3),
                paddingVertical: pt(2),
                paddingHorizontal: pt(6),
                gap: pt(3),
              }}
            />
          </View>
        )}

        {/* Languages */}
        {hasLanguages && (
          <View>
            <Text style={sideLabel("languages")}>Languages</Text>
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
            <Text style={sideLabel("certifications")}>Certifications</Text>
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
    </>
  );
};

/* ═══════════════════════════════════════════════════════════
   PROFESSIONAL PDF LAYOUT (centered single-column; with/without photo)
   ═══════════════════════════════════════════════════════════ */

const ProfessionalPDFLayout = ({
  data,
  withPhoto,
}: {
  data: CvData;
  withPhoto: boolean;
}) => {
  /*
   * Transcribed from lib/templates/professional.tsx (session 3, 2026-10-31).
   * The live sheet is 11.5px × 1.5·lineScale on a 40·m / 44·m px page (30 /
   * 33pt — wider margins than the shared 27 / 24pt page, so the layout pads
   * the difference and wraps where the preview wraps). Every size is the live
   * px value through pt(), every line box the live ratio × lineScale (the
   * root 1.5 where the live element inherits it), spaceScale only on the
   * heading's top gap, and nothing is left to inherit the page's resolved
   * line box (see LH_NORMAL). Before this pass the download reused the Classic
   * sheet and put a second section gap (s.twoCol) above the Languages /
   * Certifications row, which at density 5 pushed that row to page 2
   * (PDF_FIDELITY.md rank 4).
   */
  const theme = resolveTheme(data.settings, "#1f2937");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  const m = theme.marginScale;
  // On a white page, accent is used only as text/border → use the readable form.
  const accent = theme.accentText;
  const bold: Style = { fontFamily: fonts.bold, fontWeight: 700 };
  const regular: Style = { fontFamily: fonts.regular, fontWeight: 400 };
  const rootLine = 1.5 * ls;
  /** text-[11.5px] leading-[1.5] text-slate-700 — skills, languages. */
  const body: Style = { fontSize: pt(11.5) * fs, lineHeight: rootLine, color: SLATE_700 };
  /** text-[11px] text-slate-500 at the root line box — dates, location, notes. */
  const small: Style = { fontSize: pt(11) * fs, lineHeight: rootLine, color: SLATE_500 };
  /** text-[11px] leading-[1.5] text-slate-700 — bullets. */
  const bulletText: Style = { fontSize: pt(11) * fs, lineHeight: rootLine, color: SLATE_700 };
  const bulletStyles: BulletStyles = {
    // list-disc pl-4 space-y-1, marker slate-400; the <ul> sits in the
    // role's space-y-1 flow, so the gap above it is the entry's own.
    list: { marginTop: 0, paddingLeft: pt(16) - BULLET_DOT_WIDTH },
    item: { marginBottom: 0 },
    gap: pt(4),
    dot: { width: BULLET_DOT_WIDTH, fontSize: pt(11) * fs, lineHeight: rootLine, color: SLATE_400 },
    text: bulletText,
  };
  /** Live headingStyle: 11px bold 0.14em uppercase centred over a 1.5px accent rule. */
  const heading = (label: string, first = false) => (
    <PdfHeading
      fonts={fonts}
      v={{
        fontSize: pt(11) * fs,
        lineHeight: rootLine,
        color: "#111827",
        letterSpacing: 0.14 * pt(11) * fs,
        uppercase: true,
        textAlign: "center",
        ruleColor: accent,
        ruleWidth: pt(1.5),
        paddingBottom: pt(4),
        marginBottom: pt(10),
        marginTop: first ? 0 : pt(18) * sp,
      }}
    >
      {label}
    </PdfHeading>
  );
  const eduVariant: EducationVariant = {
    joiner: " · ",
    schoolInline: true,
    titleStyle: { ...bold, fontSize: pt(12) * fs, lineHeight: rootLine, color: SLATE_800 },
    dateStyle: small,
    schoolStyle: { ...regular, color: SLATE_600 },
    notesStyle: small,
    attested: "line",
    attestedStyle: { fontSize: pt(11) * fs, lineHeight: rootLine, color: GREEN_700 },
    attestedRequiresBody: true,
    gap: pt(12),
  };
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
  ].filter(Boolean) as string[];

  // Live: text-[11.5px] leading-[1.5] centred, items joined by "  •  ".
  const skillLine = (list: typeof data.skills) => (
    <Text style={{ ...body, textAlign: "center" }}>
      {list.map((sk) => sk.name).join("  •  ")}
    </Text>
  );
  const skillsSection = hasSkills ? (
    <>
      {generalSkills.length > 0 && (
        <View>
          {heading("Skills")}
          {skillLine(generalSkills)}
        </View>
      )}
      {technicalSkills.length > 0 && (
        <View>
          {heading("Technical Skills")}
          {skillLine(technicalSkills)}
        </View>
      )}
    </>
  ) : null;

  return (
    // Live page padding is 40·m / 44·m px; the shared page gives 27 / 24pt.
    <View style={{ paddingTop: (pt(40) - 27) * m, paddingHorizontal: (pt(44) - 24) * m }}>
      {/* Centered header: photo / NAME / headline / contact / essentials chips */}
      <View style={{ alignItems: "center", paddingBottom: pt(6) }}>
        {photo ? (
          <Image
            src={photo}
            style={{
              width: pt(84),
              height: pt(84),
              borderRadius: pt(42),
              objectFit: "cover",
              borderWidth: pt(2),
              borderColor: accent,
              marginBottom: pt(10),
            }}
          />
        ) : null}
        <Text
          style={{
            ...bold,
            fontSize: pt(28) * fs,
            // Explicit line height: without it the name inherits the page's
            // 8.6pt × 1.45 ≈ 12.5pt line box, so the 20pt glyphs overflow it
            // and the headline below prints across the name (fidelity run
            // 2026-10-31). Mirrors professional.tsx (1.15 × lineScale).
            lineHeight: 1.15 * ls,
            color: "#111827",
            letterSpacing: pt(1),
            textAlign: "center",
          }}
        >
          {name.toUpperCase()}
        </Text>
        {headline ? (
          // Live weight 500; the PDF faces ship 400/700 and regular is nearer.
          <Text
            style={{
              fontSize: pt(12.5) * fs,
              lineHeight: rootLine,
              color: accent,
              marginTop: pt(5),
              letterSpacing: safeTracking(0.02 * pt(12.5) * fs, pt(12.5) * fs),
              textAlign: "center",
            }}
          >
            {headline}
          </Text>
        ) : null}
        {contactBits.length > 0 ? (
          // Live: 10.5px slate-500 runs 6px apart around a slate-300 "•".
          <Text
            style={{
              fontSize: pt(10.5) * fs,
              lineHeight: rootLine,
              color: SLATE_500,
              marginTop: pt(7),
              textAlign: "center",
            }}
          >
            {contactBits.map((bit, i) => (
              <Text key={i}>
                {i > 0 ? <Text style={{ color: SLATE_300 }}>{"  •  "}</Text> : null}
                {bit}
              </Text>
            ))}
          </Text>
        ) : null}
        <PdfChips
          items={essentialChips.map((c) => ({ label: `${c.label}:`, value: c.value }))}
          v={{
            fontSize: pt(9.5) * fs,
            lineHeight: rootLine,
            color: "#374151",
            backgroundColor: "#F3F4F6",
            borderColor: "#E5E7EB",
            borderRadius: 999,
            paddingVertical: pt(2),
            paddingHorizontal: pt(9),
            gap: pt(6),
            labelStyle: { color: "#6B7280" },
            labelGap: 2,
          }}
          style={{ marginTop: pt(8), alignSelf: "stretch", justifyContent: "center" }}
        />
      </View>

      {hasSummary && (
        <View>
          {heading("Summary")}
          <Text style={{ ...body, lineHeight: 1.55 * ls }}>{data.personal.summary?.trim()}</Text>
        </View>
      )}

      {skillsFirst ? skillsSection : null}

      {hasExperience && (
        <View>
          {heading("Experience")}
          {experience.map((role, i) => (
            // space-y-3 between roles; inside a role space-y-1 between the
            // title row, the location line and the bullet list.
            <View key={role.id} style={{ marginTop: i > 0 ? pt(12) : 0 }} minPresenceAhead={48}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: pt(12) }}>
                <Text style={{ ...bold, fontSize: pt(12) * fs, lineHeight: 1.35 * ls, color: SLATE_800, flex: 1 }}>
                  {role.role?.trim() || "Role"}
                  {role.company ? (
                    <Text style={{ ...regular, color: SLATE_600 }}>{` | ${role.company.trim()}`}</Text>
                  ) : null}
                </Text>
                <Text style={{ ...small, flexShrink: 0, textAlign: "right" }}>
                  {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                </Text>
              </View>
              {role.location?.trim() ? (
                <Text style={{ ...small, marginTop: pt(4) }}>{role.location.trim()}</Text>
              ) : null}
              <BulletList
                bullets={role.bullets}
                s={s}
                styles={{ ...bulletStyles, list: { ...bulletStyles.list, marginTop: pt(4) } }}
              />
            </View>
          ))}
        </View>
      )}

      {hasEducation && (
        <View>
          {heading("Education")}
          {education.map((edu, i) => (
            <EducationEntry key={edu.id} edu={edu} v={eduVariant} index={i} />
          ))}
        </View>
      )}

      {skillsFirst ? null : skillsSection}

      {(hasLanguages || hasCertifications) && (
        // Live: a two-column grid with a 24px gap and NO margin of its own —
        // each column's heading carries the section gap.
        <View style={{ flexDirection: "row", gap: pt(24) }}>
          {hasLanguages && (
            <View style={{ flex: 1 }}>
              {heading("Languages")}
              <Text style={{ ...body, textAlign: "center" }}>
                {data.languages.map((lang, i) => (
                  <Text key={lang.id}>
                    <Text style={bold}>{lang.name}</Text>
                    {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                    {i < data.languages.length - 1 ? "  •  " : ""}
                  </Text>
                ))}
              </Text>
            </View>
          )}
          {hasCertifications && (
            <View style={{ flex: 1 }}>
              {heading("Certifications")}
              {data.certifications.map((cert, i) => (
                <Text
                  key={cert.id}
                  style={{ fontSize: pt(11) * fs, lineHeight: 1.45 * ls, color: SLATE_700, textAlign: "center", marginTop: i > 0 ? pt(4) : 0 }}
                >
                  <Text style={bold}>{cert.name.trim()}</Text>
                  <Text style={{ color: SLATE_500 }}>
                    {cert.issuer?.trim() ? ` | ${cert.issuer.trim()}` : ""}
                    {cert.date?.trim() ? ` | ${cert.date.trim()}` : ""}
                  </Text>
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {hasProjects && (
        <View>
          {heading("Projects")}
          {projects.map((project, i) => (
            <View key={project.id} style={{ marginTop: i > 0 ? pt(8) : 0 }} wrap={false}>
              <Text style={{ ...bold, fontSize: pt(12) * fs, lineHeight: rootLine, color: SLATE_800 }}>
                {project.name?.trim() || "Project"}
                {shouldShowProjectLink(project.link) ? (
                  // Live: 10.5px normal slate-500, 4px after the name.
                  <Link
                    src={normalizeHref(project.link)}
                    style={{ ...regular, fontSize: pt(10.5) * fs, color: SLATE_500, textDecoration: "none" }}
                  >
                    {` ${shortenDisplayUrl(project.link!.trim())}`}
                  </Link>
                ) : null}
              </Text>
              <BulletList bullets={project.bullets ?? []} s={s} styles={bulletStyles} />
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

const OnyxPDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, "#262626");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const eduVariant: EducationVariant = {
    joiner: " \u2014 ",
    titleStyle: { fontSize: pt(11.5) * fs, fontFamily: fonts.bold, fontWeight: 700, color: "#111827", lineHeight: LH_NORMAL },
    dateStyle: { fontSize: pt(10) * fs, color: "#6B7280", lineHeight: LH_NORMAL },
    schoolStyle: { fontSize: pt(11) * fs, fontFamily: fonts.bold, fontWeight: 700, color: theme.accentText, lineHeight: LH_NORMAL },
    notesStyle: { fontSize: pt(10) * fs, color: "#6B7280", lineHeight: LH_NORMAL },
    attested: "line",
    attestedStyle: { fontSize: pt(9.5) * fs, color: GREEN_700, lineHeight: LH_NORMAL },
    attestedRequiresBody: true,
    notesAfterAttested: true,
    gap: pt(10),
  };
  const expVariant: ExperienceVariant = {
    roleStyle: { fontSize: pt(12) * fs, fontFamily: fonts.bold, fontWeight: 700, color: "#111827", lineHeight: LH_NORMAL },
    dateStyle: { fontSize: pt(10) * fs, color: "#6B7280", lineHeight: LH_NORMAL },
    companyStyle: { fontSize: pt(11) * fs, fontFamily: fonts.bold, fontWeight: 700, color: theme.accentText, lineHeight: LH_NORMAL },
    locationStyle: { fontSize: pt(11) * fs, fontFamily: fonts.regular, fontWeight: 400, color: "#6B7280", lineHeight: LH_NORMAL },
    separator: " \u00B7 ",
    bulletText: { fontSize: pt(11) * fs, lineHeight: 1.55 * theme.lineScale, color: "#374151" },
    bulletsMarginTop: pt(4),
    bulletsPaddingLeft: pt(14),
    gap: pt(12),
  };
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
    contactItems.push({ text: email, href: `mailto:${email}`, fontSize: email.length > 24 ? 6.4 * fs : undefined });
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

  // onyx.tsx SideLabel: 9px bold uppercase, 7px below; each sidebar section
  // carries 18px*sp BELOW it (Details, the last, none).
  const sideLabel = {
    fontSize: pt(9) * fs,
    fontFamily: fonts.bold, fontWeight: 700,
    color: onAccentMuted,
    letterSpacing: safeTracking(0.14 * pt(9) * fs, pt(9) * fs), // see Executive
    lineHeight: LH_NORMAL,
    marginBottom: pt(7),
    textTransform: "uppercase" as const,
  };
  const sideSection = { marginBottom: pt(18) * theme.spaceScale };
  // Live sidebar runs are 10px (7.5pt): About me × 1.6, Contact and
  // Languages × 1.5, Details × 1.45; the gaps are the live column gaps.
  const sideText = { fontSize: pt(10) * fs, color: onAccentMuted, lineHeight: 1.5 * ls };
  // onyx.tsx MainHeading: 11px bold 0.1em #1f2937 uppercase over a 1.5px
  // accent rule, pb 3px, mb 9px, mt 18px*sp except the first section.
  const firstMain = hasExperience
    ? "experience"
    : hasEducation
      ? "education"
      : hasSkills
        ? "skills"
        : hasCertifications
          ? "certifications"
          : hasProjects
            ? "projects"
            : null;
  const mainHeading = withTopGap<Omit<HeadingVariant, "marginTop">>(
    {
      fontSize: pt(11) * fs,
      lineHeight: LH_NORMAL,
      color: "#1F2937",
      letterSpacing: 0.1 * pt(11) * fs,
      uppercase: true,
      ruleColor: accentText,
      ruleWidth: 1.125,
      paddingBottom: pt(3),
      marginBottom: pt(9),
    },
    pt(18) * theme.spaceScale,
    firstMain,
  );
  const SIDEBAR_WIDTH = pt(220); // live onyx.tsx: 220px (PDF_FIDELITY.md rank 3)

  return (
    <>
      {/* Fixed band: edge to edge on every page (audit 2026-10 defect 19). */}
      <View
        fixed
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: SIDEBAR_WIDTH,
          backgroundColor: accent,
        }}
      />
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Charcoal sidebar (transparent over the fixed band; live padding 30px 22px) ── */}
      <View
        style={{
          width: SIDEBAR_WIDTH,
          marginTop: -27 * m,
          marginBottom: -27 * m,
          marginLeft: -24 * m,
          paddingTop: pt(30),
          paddingBottom: pt(30),
          paddingLeft: pt(22),
          paddingRight: pt(22),
          flexShrink: 0,
        }}
      >
        {showPhoto && data.personal.photo ? (
          <View style={{ alignItems: "center", marginBottom: pt(16) }}>
            <Image
              src={data.personal.photo}
              style={{
                width: pt(108),
                height: pt(108),
                borderRadius: data.settings.photoShape === "square" ? pt(10) : pt(54),
                objectFit: "cover",
                borderWidth: pt(3),
                borderColor: bandBorder,
              }}
            />
          </View>
        ) : null}

        <Text style={{ fontSize: pt(21) * theme.fontScale, fontFamily: fonts.bold, fontWeight: 700, color: onAccent, textAlign: "center", lineHeight: 1.15 * theme.lineScale, letterSpacing: safeTracking(0.02 * pt(21) * theme.fontScale, pt(21) * theme.fontScale) }}>
          {firstName} {lastName}
        </Text>
        {headline ? (
          <Text
            style={{
              fontSize: pt(11) * fs,
              lineHeight: 1.4 * ls,
              color: onAccentMuted,
              textAlign: "center",
              marginTop: pt(5),
              paddingBottom: pt(14),
              marginBottom: pt(14),
              borderBottomWidth: 0.75,
              borderBottomColor: bandBorder,
            }}
          >
            {headline}
          </Text>
        ) : null}

        {hasSummary && (
          <View style={sideSection}>
            <Text style={sideLabel}>ABOUT ME</Text>
            <Text style={{ ...sideText, lineHeight: 1.6 * ls }}>
              {data.personal.summary?.trim()}
            </Text>
          </View>
        )}

        {contactItems.length > 0 && (
          <View style={sideSection}>
            <Text style={sideLabel}>CONTACT</Text>
            {contactItems.map((item, i) =>
              item.href ? (
                <Link
                  key={i}
                  src={item.href}
                  style={{ ...sideText, marginTop: i > 0 ? pt(4) : 0, textDecoration: "none", ...(item.fontSize ? { fontSize: item.fontSize } : {}) }}
                >
                  {item.text}
                </Link>
              ) : (
                <Text key={i} style={{ ...sideText, marginTop: i > 0 ? pt(4) : 0 }}>
                  {item.text}
                </Text>
              ),
            )}
          </View>
        )}

        {hasLanguages && (
          <View style={sideSection}>
            <Text style={sideLabel}>LANGUAGES</Text>
            {data.languages.map((lang, i) => (
              <Text key={lang.id} style={{ ...sideText, marginTop: i > 0 ? pt(3) : 0 }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700, color: onAccent }}>{lang.name}</Text>
                {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
              </Text>
            ))}
          </View>
        )}

        {essentialChips.length > 0 && (
          <View>
            <Text style={sideLabel}>DETAILS</Text>
            {essentialChips.map((chip, i) => (
              <Text key={chip.label} style={{ ...sideText, lineHeight: 1.45 * ls, marginTop: i > 0 ? pt(4) : 0 }}>
                {/* Live: the label is bold in the band's full text colour. */}
                <Text style={{ color: onAccent, fontFamily: fonts.bold, fontWeight: 700 }}>{chip.label}: </Text>
                {chip.value}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* ── Main column: live padding 30px·m on every side, so pull the
          column up and out by the difference to the 27/24pt page padding ── */}
      <View style={{ flex: 1, paddingLeft: pt(30) * m, marginTop: (pt(30) - 27) * m, marginRight: (pt(30) - 24) * m }}>
        {hasExperience && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("experience")}>Experience</PdfHeading>
            {experience.map((role, i) => (
              <ExperienceEntry key={role.id} role={role} v={expVariant} index={i} s={s} />
            ))}
          </View>
        )}

        {hasEducation && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("education")}>Education</PdfHeading>
            {education.map((edu, i) => (
              <EducationEntry key={edu.id} edu={edu} v={eduVariant} index={i} />
            ))}
          </View>
        )}

        {hasSkills && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("skills")}>Skills</PdfHeading>
            <PdfChips
              items={data.skills.map((sk) => ({ value: sk.name }))}
              v={{
                fontSize: pt(10.5) * fs,
                lineHeight: LH_NORMAL,
                color: "#374151",
                backgroundColor: "#F3F4F6",
                borderColor: "#E5E7EB",
                borderRadius: pt(4),
                paddingVertical: pt(2),
                paddingHorizontal: pt(9),
                gap: pt(6),
              }}
            />
          </View>
        )}

        {hasCertifications && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("certifications")}>Certifications</PdfHeading>
            {data.certifications.map((cert, i) => (
              <Text key={cert.id} style={{ fontSize: pt(11) * fs, lineHeight: 1.45 * ls, color: "#374151", marginTop: i > 0 ? pt(4) : 0 }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700, color: "#111827" }}>{cert.name.trim()}</Text>
                <Text style={{ color: "#6B7280" }}>
                  {cert.issuer?.trim() ? ` | ${cert.issuer.trim()}` : ""}
                  {cert.date?.trim() ? ` | ${cert.date.trim()}` : ""}
                </Text>
              </Text>
            ))}
          </View>
        )}

        {hasProjects && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("projects")}>Projects</PdfHeading>
            {projects.map((project, i) => (
              <View key={project.id} style={{ marginTop: i > 0 ? pt(10) : 0 }} wrap={false}>
                <Text style={{ fontSize: pt(11.5) * fs, lineHeight: LH_NORMAL, fontFamily: fonts.bold, fontWeight: 700, color: "#111827" }}>
                  {project.name?.trim() || "Project"}
                  {shouldShowProjectLink(project.link) ? (
                    // Live: 10px normal in the accent, 6px after the name.
                    <Link
                      src={normalizeHref(project.link)}
                      style={{
                        fontSize: pt(10) * fs,
                        fontFamily: fonts.regular,
                        fontWeight: 400,
                        color: accentText,
                        textDecoration: "none",
                      }}
                    >
                      {`  ${shortenDisplayUrl(project.link!.trim())}`}
                    </Link>
                  ) : null}
                </Text>
                <BulletList
                  bullets={project.bullets ?? []}
                  s={s}
                  styles={{
                    list: { marginTop: pt(3), paddingLeft: pt(14) - BULLET_DOT_WIDTH },
                    item: { marginBottom: 0 },
                    dot: { width: BULLET_DOT_WIDTH, fontSize: pt(11) * fs, color: "#374151" },
                    text: { fontSize: pt(11) * fs, lineHeight: 1.55 * ls, color: "#374151" },
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════
   SANDSTONE PDF LAYOUT (warm beige left sidebar + photo + personal details)
   ═══════════════════════════════════════════════════════════ */

const SandstonePDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, "#ECE3D2");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const eduVariant: EducationVariant = {
    joiner: " \u2014 ",
    titleStyle: { fontSize: pt(11.5) * fs, fontFamily: fonts.bold, fontWeight: 700, color: "#292524", lineHeight: LH_NORMAL },
    dateStyle: { fontSize: pt(10) * fs, color: "#78716C", lineHeight: LH_NORMAL },
    schoolStyle: { fontSize: pt(11) * fs, fontFamily: fonts.bold, fontWeight: 700, color: theme.accentText, lineHeight: LH_NORMAL },
    notesStyle: { fontSize: pt(10) * fs, color: "#78716C", lineHeight: LH_NORMAL },
    attested: "line",
    attestedStyle: { fontSize: pt(9.5) * fs, color: GREEN_700, lineHeight: LH_NORMAL },
    attestedRequiresBody: true,
    notesAfterAttested: true,
    gap: pt(10),
  };
  const expVariant: ExperienceVariant = {
    roleStyle: { fontSize: pt(12) * fs, fontFamily: fonts.bold, fontWeight: 700, color: "#292524", lineHeight: LH_NORMAL },
    dateStyle: { fontSize: pt(10) * fs, color: "#78716C", lineHeight: LH_NORMAL },
    companyStyle: { fontSize: pt(11) * fs, fontFamily: fonts.bold, fontWeight: 700, color: theme.accentText, lineHeight: LH_NORMAL },
    locationStyle: { fontSize: pt(11) * fs, fontFamily: fonts.regular, fontWeight: 400, color: "#78716C", lineHeight: LH_NORMAL },
    separator: " \u00B7 ",
    bulletText: { fontSize: pt(11) * fs, lineHeight: 1.55 * theme.lineScale, color: "#44403C" },
    bulletsMarginTop: pt(4),
    bulletsPaddingLeft: pt(14),
    gap: pt(12),
  };
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
  // sandstone.tsx SideLabel: 9px bold uppercase, 7px below; Personal Details
  // and Contact carry 18px*sp below them, Languages (last) none.
  const sideLabel = {
    fontSize: pt(9) * fs,
    fontFamily: fonts.bold, fontWeight: 700,
    color: SIDE_MUTED,
    letterSpacing: safeTracking(0.14 * pt(9) * fs, pt(9) * fs), // see Executive
    lineHeight: LH_NORMAL,
    marginBottom: pt(7),
    textTransform: "uppercase" as const,
  };
  const sideSection = { marginBottom: pt(18) * theme.spaceScale };
  // sandstone.tsx MainHeading: as Onyx in the stone ink (#292524).
  const firstMain = hasSummary
    ? "summary"
    : hasExperience
      ? "experience"
      : hasEducation
        ? "education"
        : hasSkills
          ? "skills"
          : hasCertifications
            ? "certifications"
            : hasProjects
              ? "projects"
              : null;
  const mainHeading = withTopGap<Omit<HeadingVariant, "marginTop">>(
    {
      fontSize: pt(11) * fs,
      lineHeight: LH_NORMAL,
      color: "#292524",
      letterSpacing: 0.1 * pt(11) * fs,
      uppercase: true,
      ruleColor: accentText,
      ruleWidth: 1.125,
      paddingBottom: pt(3),
      marginBottom: pt(9),
    },
    pt(18) * theme.spaceScale,
    firstMain,
  );
  const SIDEBAR_WIDTH = pt(230); // live sandstone.tsx: 230px (PDF_FIDELITY.md rank 3)

  return (
    <>
      {/* Fixed band: edge to edge on every page (audit 2026-10 defect 19). */}
      <View
        fixed
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: SIDEBAR_WIDTH,
          backgroundColor: accent,
        }}
      />
    <View style={{ flexDirection: "row", flex: 1 }}>
      {/* ── Warm sidebar (transparent over the fixed band; live padding 30px 22px) ── */}
      <View
        style={{
          width: SIDEBAR_WIDTH,
          marginTop: -27 * m,
          marginBottom: -27 * m,
          marginLeft: -24 * m,
          paddingTop: pt(30),
          paddingBottom: pt(30),
          paddingLeft: pt(22),
          paddingRight: pt(22),
          flexShrink: 0,
        }}
      >
        {showPhoto && data.personal.photo ? (
          <View style={{ alignItems: "center", marginBottom: pt(16) }}>
            <Image
              src={data.personal.photo}
              style={{
                width: pt(110),
                height: pt(110),
                borderRadius: data.settings.photoShape === "square" ? pt(10) : pt(55),
                objectFit: "cover",
                borderWidth: pt(3),
                borderColor: bandBorder,
              }}
            />
          </View>
        ) : null}

        <Text style={{ fontSize: pt(20) * theme.fontScale, fontFamily: fonts.bold, fontWeight: 700, color: onAccent, textAlign: "center", lineHeight: 1.2 * theme.lineScale }}>
          {firstName} {lastName}
        </Text>
        {headline ? (
          <Text
            style={{
              fontSize: pt(11) * fs,
              lineHeight: 1.4 * ls,
              color: onAccentMuted,
              fontFamily: fonts.bold, fontWeight: 700,
              textAlign: "center",
              marginTop: pt(4),
              paddingBottom: pt(14),
              marginBottom: pt(14),
              borderBottomWidth: 0.75,
              borderBottomColor: bandBorder,
            }}
          >
            {headline}
          </Text>
        ) : null}

        {personalDetails.length > 0 && (
          <View style={sideSection}>
            <Text style={sideLabel}>PERSONAL DETAILS</Text>
            {personalDetails.map((d, i) => (
              <View key={d.label} style={{ marginTop: i > 0 ? pt(6) : 0 }}>
                <Text style={{ fontSize: pt(8.5) * fs, lineHeight: 1.4 * ls, fontFamily: fonts.bold, fontWeight: 700, color: SIDE_MUTED, letterSpacing: 0.04 * pt(8.5) * fs }}>
                  {d.label.toUpperCase()}
                </Text>
                <Text style={{ fontSize: pt(10) * fs, color: SIDE_TEXT, lineHeight: 1.4 * ls }}>{d.value}</Text>
              </View>
            ))}
          </View>
        )}

        {contactItems.length > 0 && (
          <View style={sideSection}>
            <Text style={sideLabel}>CONTACT</Text>
            {contactItems.map((item, i) =>
              item.href ? (
                <Link
                  key={i}
                  src={item.href}
                  style={{ fontSize: (item.fontSize ?? pt(10)) * fs, color: SIDE_MUTED, lineHeight: 1.5 * ls, marginTop: i > 0 ? pt(4) : 0, textDecoration: "none" }}
                >
                  {item.text}
                </Link>
              ) : (
                <Text key={i} style={{ fontSize: pt(10) * fs, color: SIDE_MUTED, lineHeight: 1.5 * ls, marginTop: i > 0 ? pt(4) : 0 }}>
                  {item.text}
                </Text>
              ),
            )}
          </View>
        )}

        {hasLanguages && (
          <View>
            <Text style={sideLabel}>LANGUAGES</Text>
            {data.languages.map((lang, i) => (
              <Text key={lang.id} style={{ fontSize: pt(10) * fs, color: SIDE_MUTED, lineHeight: 1.5 * ls, marginTop: i > 0 ? pt(3) : 0 }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700, color: SIDE_TEXT }}>{lang.name}</Text>
                {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* ── Main column: live padding 30px·m on every side, so pull the
          column up and out by the difference to the 27/24pt page padding ── */}
      <View style={{ flex: 1, paddingLeft: pt(30) * m, marginTop: (pt(30) - 27) * m, marginRight: (pt(30) - 24) * m }}>
        {hasSummary && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("summary")}>About Me</PdfHeading>
            <Text style={{ fontSize: pt(11) * fs, lineHeight: 1.6 * ls, color: "#44403C" }}>{data.personal.summary?.trim()}</Text>
          </View>
        )}

        {hasExperience && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("experience")}>Work Experience</PdfHeading>
            {experience.map((role, i) => (
              <ExperienceEntry key={role.id} role={role} v={expVariant} index={i} s={s} />
            ))}
          </View>
        )}

        {hasEducation && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("education")}>Education</PdfHeading>
            {education.map((edu, i) => (
              <EducationEntry key={edu.id} edu={edu} v={eduVariant} index={i} />
            ))}
          </View>
        )}

        {hasSkills && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("skills")}>Skills</PdfHeading>
            <PdfChips
              items={data.skills.map((sk) => ({ value: sk.name }))}
              v={{
                fontSize: pt(10.5) * fs,
                lineHeight: LH_NORMAL,
                color: "#44403C",
                backgroundColor: "#F5F0E6",
                borderColor: "#E2D8C4",
                borderRadius: pt(4),
                paddingVertical: pt(2),
                paddingHorizontal: pt(9),
                gap: pt(6),
              }}
            />
          </View>
        )}

        {hasCertifications && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("certifications")}>Certifications</PdfHeading>
            {data.certifications.map((cert, i) => (
              <Text key={cert.id} style={{ fontSize: pt(11) * fs, lineHeight: 1.45 * ls, color: "#44403C", marginTop: i > 0 ? pt(4) : 0 }}>
                <Text style={{ fontFamily: fonts.bold, fontWeight: 700, color: "#292524" }}>{cert.name.trim()}</Text>
                <Text style={{ color: "#78716C" }}>
                  {cert.issuer?.trim() ? ` | ${cert.issuer.trim()}` : ""}
                  {cert.date?.trim() ? ` | ${cert.date.trim()}` : ""}
                </Text>
              </Text>
            ))}
          </View>
        )}

        {hasProjects && (
          <View>
            <PdfHeading fonts={fonts} v={mainHeading("projects")}>Projects</PdfHeading>
            {projects.map((project, i) => (
              <View key={project.id} style={{ marginTop: i > 0 ? pt(10) : 0 }} wrap={false}>
                <Text style={{ fontSize: pt(11.5) * fs, lineHeight: LH_NORMAL, fontFamily: fonts.bold, fontWeight: 700, color: "#292524" }}>
                  {project.name?.trim() || "Project"}
                  {shouldShowProjectLink(project.link) ? (
                    // Live: 10px normal in the accent, 6px after the name.
                    <Link
                      src={normalizeHref(project.link)}
                      style={{
                        fontSize: pt(10) * fs,
                        fontFamily: fonts.regular,
                        fontWeight: 400,
                        color: accentText,
                        textDecoration: "none",
                      }}
                    >
                      {`  ${shortenDisplayUrl(project.link!.trim())}`}
                    </Link>
                  ) : null}
                </Text>
                <BulletList
                  bullets={project.bullets ?? []}
                  s={s}
                  styles={{
                    list: { marginTop: pt(3), paddingLeft: pt(14) - BULLET_DOT_WIDTH },
                    item: { marginBottom: 0 },
                    dot: { width: BULLET_DOT_WIDTH, fontSize: pt(11) * fs, color: "#44403C" },
                    text: { fontSize: pt(11) * fs, lineHeight: 1.55 * ls, color: "#44403C" },
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════
   BANNER PDF LAYOUT (accent band + essentials strip over a
   single column) — mirrors lib/templates/banner.tsx section by
   section; px → pt × 0.75 throughout.
   ═══════════════════════════════════════════════════════════ */

const BannerPDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, "#1e5b54");
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const { accent, accentText, accentSoft, onAccent, onAccentMuted } = theme;
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  const m = theme.marginScale;
  // Opaque blends only — an alpha colour here renders as neon green.
  const photoRing = mix(onAccent, accent, 0.75);
  const headingRule = mix(accentSoft, accentText, 0.25);

  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() ||
    "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );
  const essentials = bannerEssentials(data.personal);
  const contactItems = bannerContactItems(data.personal);

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = experience.length > 0;
  const hasSkills = generalSkills.length > 0 || technicalSkills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasEducation = education.length > 0;
  const hasProjects = projects.length > 0;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const roundPhoto = data.settings.photoShape !== "square";

  const bold: Style = { fontFamily: fonts.bold, fontWeight: 700 };
  const bodyText: Style = {
    fontFamily: fonts.regular,
    fontSize: 8.6 * fs,
    lineHeight: 1.5 * ls,
    color: SLATE_700,
  };
  const entryTitle: Style = {
    ...bold,
    fontSize: 9 * fs,
    lineHeight: 1.35 * ls,
    color: SLATE_800,
  };
  const entryDate: Style = {
    fontFamily: fonts.regular,
    fontSize: 8.25 * fs,
    lineHeight: 1.35 * ls,
    color: SLATE_500,
    textAlign: "right",
    flexShrink: 0,
  };
  const subLine: Style = {
    fontFamily: fonts.regular,
    fontSize: 8.25 * fs,
    lineHeight: 1.4 * ls,
    color: SLATE_600,
  };
  const contactStyle: Style = {
    fontFamily: fonts.regular,
    fontSize: 8.25 * fs,
    lineHeight: 1.6 * ls,
    color: onAccent,
  };

  // First visible section has no top gap; every later one gets 16pt × spaceScale.
  let sectionIndex = 0;
  const heading = (label: string) => {
    const isFirst = sectionIndex === 0;
    sectionIndex += 1;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: isFirst ? 0 : 16 * sp,
          marginBottom: 6,
        }}
        // Keep the heading with its first entry: education/project entries
        // are unbreakable (~50pt), so 40pt still left orphan headings.
        minPresenceAhead={60}
      >
        <Text
          style={{
            ...bold,
            fontSize: 9 * fs,
            lineHeight: 1.2 * ls,
            color: accentText,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <View
          style={{ flex: 1, height: 1, backgroundColor: headingRule, marginLeft: 8 }}
        />
      </View>
    );
  };

  const bullets = (items: string[]) => {
    const list = items.map((b) => b.trim()).filter(Boolean);
    if (list.length === 0) return null;
    return (
      <View style={{ marginTop: 3, paddingLeft: 10 }}>
        {list.map((bullet, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
            <Text style={{ ...bodyText, width: 10, color: SLATE_400 }}>•</Text>
            <Text style={{ ...bodyText, flex: 1 }}>{bullet}</Text>
          </View>
        ))}
      </View>
    );
  };

  const skillLine = (skills: typeof generalSkills) =>
    skills.map((sk) => sk.name.trim()).filter(Boolean).join(" · ");
  const showSkillLabels = generalSkills.length > 0 && technicalSkills.length > 0;

  return (
    <View>
      {/* ── Accent band: page 1 only, so the negative-margin bleed is safe.
          The page padding is 27/24 × marginScale, so the
          negative margins scale the same way to still reach the edge. ── */}
      <View
        style={{
          backgroundColor: accent,
          marginTop: -27 * m,
          marginLeft: -24 * m,
          marginRight: -24 * m,
          paddingTop: 20,
          paddingBottom: 20,
          paddingLeft: 24 * m,
          paddingRight: 24 * m,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {showPhoto && data.personal.photo && (
          <Image
            src={data.personal.photo}
            style={{
              width: 96,
              height: roundPhoto ? 96 : 119,
              borderRadius: roundPhoto ? 48 : 3,
              objectFit: "cover",
              borderWidth: 1.5,
              borderColor: photoRing,
              marginRight: 18,
            }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...bold,
              fontSize: 22 * fs,
              lineHeight: 1.15 * ls,
              color: onAccent,
              letterSpacing: -0.2,
            }}
          >
            {name}
          </Text>
          {headline ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 11 * fs,
                lineHeight: 1.35 * ls,
                color: onAccentMuted,
                marginTop: 3,
              }}
            >
              {headline}
            </Text>
          ) : null}
          {contactItems.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 7,
              }}
            >
              {contactItems.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                  {item.href ? (
                    <Link src={item.href} style={{ ...contactStyle, textDecoration: "none" }}>
                      {item.text}
                    </Link>
                  ) : (
                    <Text style={contactStyle}>{item.text}</Text>
                  )}
                  {i < contactItems.length - 1 && (
                    <Text style={{ ...contactStyle, marginHorizontal: 4 }}>{"·"}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ── UAE essentials strip (plain text, bold labels, " · " joins) ── */}
      {essentials.length > 0 && (
        <View
          style={{
            backgroundColor: accentSoft,
            marginLeft: -24 * m,
            marginRight: -24 * m,
            paddingLeft: 24 * m,
            paddingRight: 24 * m,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 7.5 * fs,
              lineHeight: 1.5 * ls,
              color: accentText,
            }}
          >
            {essentials.map((item, i) => (
              <Text key={item.label}>
                {i > 0 ? "  ·  " : ""}
                <Text style={bold}>{`${item.label}: `}</Text>
                {item.value}
              </Text>
            ))}
          </Text>
        </View>
      )}

      {/* ── Single-column body. Sections are fragments, not Views: react-pdf
          only honours minPresenceAhead on a node that has previous siblings,
          so a heading wrapped as the first child of a section View could never
          move to the next page and was left orphaned at the page foot. ── */}
      <View style={{ paddingTop: 16 }}>
        {hasSummary && (
          <>
            {heading("Profile")}
            <Text style={bodyText}>{data.personal.summary?.trim()}</Text>
          </>
        )}

        {hasExperience && (
          <>
            {heading("Work Experience")}
            {experience.map((role, idx) => {
              const company = role.company?.trim();
              const location = role.location?.trim();
              return (
                <View
                  key={role.id}
                  style={{ marginBottom: idx < experience.length - 1 ? 8 : 0 }}
                  minPresenceAhead={48}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <Text style={{ ...entryTitle, flex: 1 }}>
                      {role.role?.trim() || "Role"}
                    </Text>
                    <Text style={entryDate}>
                      {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                    </Text>
                  </View>
                  {company || location ? (
                    <Text style={{ ...subLine, marginTop: 1 }}>
                      {company ? <Text style={{ color: accentText }}>{company}</Text> : null}
                      {company && location ? " · " : ""}
                      {location ?? ""}
                    </Text>
                  ) : null}
                  {bullets(role.bullets ?? [])}
                </View>
              );
            })}
          </>
        )}

        {hasSkills && (
          <>
            {heading("Skills")}
            {generalSkills.length > 0 && (
              <View style={{ marginBottom: technicalSkills.length > 0 ? 5 : 0 }}>
                {showSkillLabels && (
                  <Text style={{ ...subLine, ...bold, color: SLATE_800, marginBottom: 1 }}>
                    General
                  </Text>
                )}
                <Text style={bodyText}>{skillLine(generalSkills)}</Text>
              </View>
            )}
            {technicalSkills.length > 0 && (
              <View>
                {showSkillLabels && (
                  <Text style={{ ...subLine, ...bold, color: SLATE_800, marginBottom: 1 }}>
                    Technical
                  </Text>
                )}
                <Text style={bodyText}>{skillLine(technicalSkills)}</Text>
              </View>
            )}
          </>
        )}

        {hasLanguages && (
          <>
            {heading("Languages")}
            {data.languages.map((lang) => (
              <Text key={lang.id} style={bodyText}>
                <Text style={{ ...bold, color: SLATE_800 }}>{lang.name.trim()}</Text>
                {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
              </Text>
            ))}
          </>
        )}

        {hasCertifications && (
          <>
            {heading("Certifications")}
            {data.certifications.map((cert, idx) => (
              <Text
                key={cert.id}
                style={{
                  ...bodyText,
                  marginBottom: idx < data.certifications.length - 1 ? 2 : 0,
                }}
              >
                <Text style={{ ...bold, color: SLATE_800 }}>{cert.name.trim()}</Text>
                <Text style={{ color: SLATE_500 }}>
                  {cert.issuer?.trim() ? ` | ${cert.issuer.trim()}` : ""}
                  {cert.date?.trim() ? ` | ${cert.date.trim()}` : ""}
                </Text>
              </Text>
            ))}
          </>
        )}

        {hasEducation && (
          <>
            {heading("Education")}
            {education.map((edu, idx) => {
              const school = edu.school?.trim();
              const notes = edu.notes?.trim();
              const attestingBody = edu.attestingBody?.trim();
              return (
                <View
                  key={edu.id}
                  style={{ marginBottom: idx < education.length - 1 ? 8 : 0 }}
                  wrap={false}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <Text style={{ ...entryTitle, flex: 1 }}>
                      {bannerEducationTitle(edu)}
                      {school ? (
                        <Text
                          style={{
                            fontFamily: fonts.regular,
                            fontWeight: 400,
                            color: SLATE_700,
                          }}
                        >
                          {` | ${school}`}
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={entryDate}>
                      {formatDateRange(edu.startDate, edu.endDate)}
                    </Text>
                  </View>
                  {notes ? (
                    <Text style={{ ...subLine, color: SLATE_500, marginTop: 1 }}>{notes}</Text>
                  ) : null}
                  {edu.attested && attestingBody ? (
                    <Text style={{ ...subLine, marginTop: 1 }}>
                      {`Attested — ${attestingBody}`}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </>
        )}

        {hasProjects && (
          <>
            {heading("Projects")}
            {projects.map((project, idx) => {
              const showLink = shouldShowProjectLink(project.link);
              return (
                <View
                  key={project.id}
                  style={{ marginBottom: idx < projects.length - 1 ? 8 : 0 }}
                  wrap={false}
                >
                  <Text style={entryTitle}>{project.name?.trim() || "Project"}</Text>
                  {showLink && project.link ? (
                    <Link
                      src={normalizeHref(project.link)}
                      style={{ ...subLine, marginTop: 1, textDecoration: "underline" }}
                    >
                      {shortenDisplayUrl(project.link)}
                    </Link>
                  ) : null}
                  {bullets(project.bullets ?? [])}
                </View>
              );
            })}
          </>
        )}
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   GULF STANDARD PDF LAYOUT (single column, passport photo,
   labelled Personal Details grid)
   Mirrors lib/templates/gulf-standard.tsx section by section — same
   order, same text, same empty-state rules, same photo gating. Sizes are
   the live px × 0.75. Own heading/experience/education blocks (the shared
   EducationEntry and "Role | Company" row do not match the Gulf spec).
   ═══════════════════════════════════════════════════════════ */

const GulfStandardPDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, GULF_STANDARD_ACCENT);
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  // Accent is text/rule only on a white page → the contrast-guarded form.
  const accent = theme.accentText;

  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const summary = data.personal.summary?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const certifications = data.certifications.filter(
    (cert) => cert.name?.trim() || cert.issuer?.trim(),
  );
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills.filter((skill) => skill.name?.trim()),
  );
  const detailRows = gulfDetailRows(data);
  const detailColumns = gulfDetailColumns(detailRows);

  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const roundPhoto = data.settings.photoShape === "round";
  // 85 × 108 pt passport box (3.5 : 4.5); "round" is an 85 pt circle in both
  // renderers because a single corner radius cannot draw an ellipse here.
  const PHOTO_W = 85;
  const photoHeight = roundPhoto ? PHOTO_W : 108;

  type ContactItem = { text: string; href?: string };
  const contacts: ContactItem[] = [];
  const phone = data.personal.phone?.trim() || "";
  const email = data.personal.email?.trim() || "";
  const locationText = data.personal.location?.trim() || "";
  const linkedin = data.personal.linkedin?.trim() || "";
  const website = data.personal.website?.trim() || "";
  if (phone) contacts.push({ text: phone, href: `tel:${phone}` });
  if (email) contacts.push({ text: email, href: `mailto:${email}` });
  if (locationText) contacts.push({ text: locationText });
  if (linkedin)
    contacts.push({ text: shortenDisplayUrl(linkedin), href: normalizeHref(linkedin) });
  if (website)
    contacts.push({ text: shortenDisplayUrl(website), href: normalizeHref(website) });

  const hasDetails = detailRows.length > 0;
  const hasSummary = summary.length > 0;
  const hasSkills = generalSkills.length > 0 || technicalSkills.length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasCertifications = certifications.length > 0;
  const hasProjects = projects.length > 0;

  // First rendered section gets marginTop 0; spaceScale touches ONLY the
  // gap between sections (16pt at level 3), never the spacing inside one.
  const sectionOrder: Array<[string, boolean]> = [
    ["details", hasDetails],
    ["profile", hasSummary],
    ["skills", hasSkills],
    ["experience", hasExperience],
    ["education", hasEducation],
    ["certifications", hasCertifications],
    ["projects", hasProjects],
  ];
  const firstSection = sectionOrder.find(([, present]) => present)?.[0] ?? null;

  const bold: Style = { fontFamily: fonts.bold, fontWeight: 700 };
  const body: Style = { fontSize: 8.6 * fs, lineHeight: 1.45 * ls, color: SLATE_700 };
  const small: Style = { fontSize: 8.25 * fs, lineHeight: 1.45 * ls, color: SLATE_600 };
  const dateStyle: Style = {
    fontSize: 8.25 * fs,
    lineHeight: 1.45 * ls,
    color: SLATE_500,
    textAlign: "right",
    flexShrink: 0,
  };
  const entryTitle: Style = {
    flex: 1,
    fontSize: 9 * fs,
    lineHeight: 1.35 * ls,
    ...bold,
    color: SLATE_900,
  };
  const entryRow: Style = {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 9,
  };
  const detailText: Style = { fontSize: 8.25 * fs, lineHeight: 1.45 * ls };
  // Spec: 4pt bullet indent (the shared sheet uses 12pt); quieter dot.
  const bulletStyles: Record<string, Style> = {
    ...s,
    bulletList: { ...s.bulletList, paddingLeft: 4, marginTop: 2 },
    bulletItem: { ...s.bulletItem, marginBottom: 1.5 },
    bulletDot: { ...s.bulletDot, color: SLATE_500 },
  };

  // A render helper, not a component declared inside render
  // (react-hooks/static-components).
  // 64pt keeps a heading with at least an entry title row and a bullet or
  // two: at 40pt the PROJECTS heading was orphaned at the foot of page 1
  // while its first (unwrappable) entry opened page 2.
  const heading = (id: string, label: string) => (
    <View
      minPresenceAhead={64}
      style={{
        marginTop: firstSection === id ? 0 : 16 * sp,
        marginBottom: 5,
        paddingBottom: 2,
        borderBottomWidth: 0.75,
        borderBottomColor: accent,
      }}
    >
      <Text
        style={{
          fontSize: 8.5 * fs,
          lineHeight: 1.3 * ls,
          ...bold,
          letterSpacing: 0.6,
          color: accent,
        }}
      >
        {label}
      </Text>
    </View>
  );

  const skillLine = (skills: typeof generalSkills) =>
    skills.map((skill) => skill.name.trim()).join(" · ");
  // Sub-labels only when BOTH groups exist (same rule as the live template).
  const showSkillLabels = generalSkills.length > 0 && technicalSkills.length > 0;
  const skillLabel: Style = { ...small, ...bold, color: SLATE_800 };

  return (
    <View>
      {/* ── Header: text block + in-flow passport photo ── */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 10.5 }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            // Keep the text block at least as tall as the photo so a short
            // header never leaves the 108pt photo hanging below it.
            minHeight: showPhoto ? photoHeight : undefined,
          }}
        >
          <Text style={{ fontSize: 20 * fs, lineHeight: 1.15 * ls, ...bold, color: SLATE_900 }}>
            {name}
          </Text>
          {headline ? (
            <Text style={{ fontSize: 11 * fs, lineHeight: 1.3 * ls, color: accent, marginTop: 1.5 }}>
              {headline}
            </Text>
          ) : null}
          {contacts.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 4.5 }}>
              {contacts.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                  {item.href ? (
                    <Link src={item.href} style={{ ...small, textDecoration: "none" }}>
                      {item.text}
                    </Link>
                  ) : (
                    <Text style={small}>{item.text}</Text>
                  )}
                  {i < contacts.length - 1 ? (
                    <Text style={{ ...small, color: SLATE_400, marginHorizontal: 4.5 }}>|</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {showPhoto && data.personal.photo ? (
          <Image
            src={data.personal.photo}
            style={{
              width: PHOTO_W,
              height: photoHeight,
              objectFit: "cover",
              borderWidth: 0.75,
              borderColor: SLATE_300,
              // react-pdf's shorthand resolver throws on a falsy radius, so
              // the square frame omits the key instead of passing 0.
              ...(roundPhoto ? { borderRadius: PHOTO_W / 2 } : {}),
            }}
          />
        ) : null}
      </View>

      {/* ── Personal Details: one row per label/value pair, column stacks ── */}
      {hasDetails ? (
        <View wrap={false}>
          {heading("details", "PERSONAL DETAILS")}
          <View style={{ flexDirection: "row", gap: 14 }}>
            {detailColumns.map((column, ci) => (
              <View key={ci} style={{ flex: 1 }}>
                {column.map((row) => (
                  <View key={row.label} style={{ flexDirection: "row", gap: 6, marginBottom: 2 }}>
                    <Text style={{ ...detailText, width: "38%", ...bold, color: SLATE_800 }}>
                      {row.label}
                    </Text>
                    <Text style={{ ...detailText, flex: 1, color: SLATE_700 }}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Sections are fragments, not Views: react-pdf only honours a
          heading's minPresenceAhead when the heading has previous siblings
          in the same parent, so headings and entries sit directly under the
          root View (a heading wrapped as the first child of a section View
          is always orphaned at a page foot). */}
      {/* ── Profile ── */}
      {hasSummary ? (
        <>
          {heading("profile", "PROFILE")}
          <Text style={body}>{summary}</Text>
        </>
      ) : null}

      {/* ── Core Skills: text lines under bold sub-labels, no chips ── */}
      {hasSkills ? (
        <>
          {heading("skills", "CORE SKILLS")}
          {generalSkills.length > 0 ? (
            <View>
              {showSkillLabels ? <Text style={skillLabel}>General</Text> : null}
              <Text style={body}>{skillLine(generalSkills)}</Text>
            </View>
          ) : null}
          {technicalSkills.length > 0 ? (
            <View style={{ marginTop: generalSkills.length > 0 ? 4 : 0 }}>
              {showSkillLabels ? <Text style={skillLabel}>Technical</Text> : null}
              <Text style={body}>{skillLine(technicalSkills)}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {/* ── Work Experience ── */}
      {hasExperience ? (
        <>
          {heading("experience", "WORK EXPERIENCE")}
          {experience.map((role, i) => {
            const companyLine = [role.company?.trim(), role.location?.trim()]
              .filter(Boolean)
              .join(" | ");
            return (
              <View
                key={role.id}
                style={{ marginBottom: i < experience.length - 1 ? 9 : 0 }}
                minPresenceAhead={48}
              >
                <View style={entryRow}>
                  <Text style={entryTitle}>{role.role?.trim() || "Role"}</Text>
                  <Text style={dateStyle}>
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                  </Text>
                </View>
                {companyLine ? (
                  <Text style={{ ...small, marginTop: 0.75 }}>{companyLine}</Text>
                ) : null}
                <BulletList bullets={role.bullets ?? []} s={bulletStyles} />
              </View>
            );
          })}
        </>
      ) : null}

      {/* ── Education ── */}
      {hasEducation ? (
        <>
          {heading("education", "EDUCATION")}
          {education.map((edu, i) => {
            const school = edu.school?.trim() || "";
            const notes = edu.notes?.trim() || "";
            const attestingBody = edu.attestingBody?.trim() || "";
            return (
              <View
                key={edu.id}
                style={{ marginBottom: i < education.length - 1 ? 9 : 0 }}
                wrap={false}
              >
                <View style={entryRow}>
                  <Text style={entryTitle}>
                    {gulfDegreeTitle(edu)}
                    {school ? (
                      <Text style={{ fontFamily: fonts.regular, fontWeight: 400, color: SLATE_700 }}>
                        {` | ${school}`}
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={dateStyle}>{formatDateRange(edu.startDate, edu.endDate)}</Text>
                </View>
                {notes ? <Text style={{ ...small, marginTop: 0.75 }}>{notes}</Text> : null}
                {edu.attested && attestingBody ? (
                  <Text style={{ ...small, marginTop: 0.75 }}>{`Attested — ${attestingBody}`}</Text>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

      {/* ── Certifications ── */}
      {hasCertifications ? (
        <>
          {heading("certifications", "CERTIFICATIONS")}
          {certifications.map((cert, i) => {
            const certName = cert.name?.trim() || "";
            const tail = [cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).join(" | ");
            return (
              <Text
                key={cert.id}
                style={{ ...body, marginBottom: i < certifications.length - 1 ? 2 : 0 }}
              >
                <Text style={{ ...bold, color: SLATE_800 }}>{certName || tail}</Text>
                {certName && tail ? (
                  <Text style={{ color: SLATE_600 }}>{` | ${tail}`}</Text>
                ) : null}
              </Text>
            );
          })}
        </>
      ) : null}

      {/* ── Projects ── */}
      {hasProjects ? (
        <>
          {heading("projects", "PROJECTS")}
          {projects.map((project, i) => {
            const link = project.link?.trim() || "";
            const showLink = shouldShowProjectLink(link);
            return (
              <View
                key={project.id}
                style={{ marginBottom: i < projects.length - 1 ? 9 : 0 }}
                wrap={false}
              >
                <Text style={{ ...entryTitle, flex: undefined }}>
                  {project.name?.trim() || "Project"}
                </Text>
                {showLink ? (
                  <Link
                    src={normalizeHref(link)}
                    style={{ ...small, marginTop: 0.75, textDecoration: "underline" }}
                  >
                    {shortenDisplayUrl(link)}
                  </Link>
                ) : null}
                <BulletList bullets={project.bullets ?? []} s={bulletStyles} />
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   CHRONICLE PDF LAYOUT (single-column timeline: date gutter,
   per-entry accent rail with a dot, content to the right)
   Mirrors lib/templates/chronicle.tsx section by section — same order,
   same text, same empty-state rules, same photo gating. Sizes are the
   live px × 0.75. The rail is drawn PER ENTRY (a left border on the rail
   track plus an absolutely positioned dot), never as one full-height
   element, so it breaks cleanly between entries across pages; the last
   entry of a section ends its rail at the dot. Short entries carry
   wrap={false} so a rail gap from a split entry only ever shows on a
   long one.
   ═══════════════════════════════════════════════════════════ */

type ChroniclePdfEntry = {
  key: string;
  /** Gutter text; empty for undated entries (projects) — the dot still shows. */
  date: string;
  title: string;
  subtitle: ReactNode;
  lines: ReactNode[];
  bullets: string[];
};

const ChroniclePDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings, CHRONICLE_ACCENT);
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  // Accent is text/rail only on a white page → the contrast-guarded form.
  const accent = theme.accentText;
  const { dot: dotColor, rail: railColor } = chronicleRailColors(accent);

  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const summary = data.personal.summary?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const certifications = data.certifications.filter(
    (cert) => cert.name?.trim() || cert.issuer?.trim(),
  );
  const languages = data.languages.filter((lang) => lang.name?.trim());
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills.filter((skill) => skill.name?.trim()),
  );
  const contactItems = chronicleContactItems(data.personal);
  const essentials = chronicleEssentials(data.personal);

  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const roundPhoto = data.settings.photoShape !== "square";
  const PHOTO = 54;

  const hasSummary = summary.length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasProjects = projects.length > 0;
  const hasSkills = generalSkills.length > 0 || technicalSkills.length > 0;
  const hasLanguages = languages.length > 0;
  const hasCertifications = certifications.length > 0;

  // First rendered section gets marginTop 0; spaceScale touches ONLY the
  // gap between sections (16pt at level 3), never the spacing inside one.
  const sectionOrder: Array<[string, boolean]> = [
    ["profile", hasSummary],
    ["experience", hasExperience],
    ["education", hasEducation],
    ["projects", hasProjects],
    ["skills", hasSkills],
    ["languages", hasLanguages],
    ["certifications", hasCertifications],
  ];
  const firstSection = sectionOrder.find(([, present]) => present)?.[0] ?? null;

  const bold: Style = { fontFamily: fonts.bold, fontWeight: 700 };
  const body: Style = {
    fontFamily: fonts.regular,
    fontSize: 8.6 * fs,
    lineHeight: 1.5 * ls,
    color: SLATE_700,
  };
  const small: Style = {
    fontFamily: fonts.regular,
    fontSize: 8.25 * fs,
    lineHeight: 1.4 * ls,
    color: SLATE_600,
  };
  const entryTitle: Style = {
    ...bold,
    fontSize: 9.5 * fs,
    lineHeight: 1.35 * ls,
    color: SLATE_900,
  };
  const dateText: Style = {
    fontFamily: fonts.regular,
    fontSize: 7.5 * fs,
    lineHeight: 1.35 * ls,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: SLATE_500,
    textAlign: "right",
  };
  // The gutter scales with the font so the uppercase date stays on one line.
  const dateTrack = CHRONICLE_DATE_TRACK_PT * fs;

  // A render helper, not a component declared inside render
  // (react-hooks/static-components). 60pt keeps a heading with its first
  // entry's title row and a bullet or two.
  const heading = (id: string, label: string) => (
    <View
      minPresenceAhead={60}
      style={{ marginTop: firstSection === id ? 0 : 16 * sp, marginBottom: 6 }}
    >
      <Text
        style={{
          ...bold,
          fontSize: 8.5 * fs,
          lineHeight: 1.3 * ls,
          // 0.6pt: wider tracking makes pdf.js (and ATS extractors) read the
          // heading as spaced letters ("P R O F I L E").
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {label}
      </Text>
    </View>
  );

  const bullets = (items: string[]) => {
    const list = items.map((b) => b.trim()).filter(Boolean);
    if (list.length === 0) return null;
    return (
      <View style={{ marginTop: 2, paddingLeft: 10 }}>
        {list.map((bullet, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 1.5 }}>
            <Text style={{ ...body, width: 10, color: SLATE_400 }}>•</Text>
            <Text style={{ ...body, flex: 1 }}>{bullet}</Text>
          </View>
        ))}
      </View>
    );
  };

  /**
   * One timeline row: date track | rail track | content. The rail is this
   * row's own left border (or, on the last entry, a stub down to the dot),
   * and the entry gap lives inside the content track so the row — and the
   * rail — stretches across it.
   */
  const entry = (e: ChroniclePdfEntry, last: boolean) => (
    <View
      key={e.key}
      wrap={e.bullets.length > 6}
      minPresenceAhead={48}
      style={{ flexDirection: "row" }}
    >
      <View style={{ width: dateTrack, paddingRight: CHRONICLE_DATE_GAP_PT, paddingTop: 1.5 }}>
        <Text style={dateText}>{e.date}</Text>
      </View>
      <View
        style={{
          width: CHRONICLE_RAIL_TRACK_PT,
          ...(last
            ? {}
            : { borderLeftWidth: CHRONICLE_RAIL_WIDTH_PT, borderLeftColor: railColor }),
        }}
      >
        {last ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CHRONICLE_RAIL_WIDTH_PT,
              height: CHRONICLE_DOT_TOP_PT + CHRONICLE_DOT_PT / 2,
              backgroundColor: railColor,
            }}
          />
        ) : null}
        <View
          style={{
            position: "absolute",
            top: CHRONICLE_DOT_TOP_PT,
            left: CHRONICLE_RAIL_WIDTH_PT / 2 - CHRONICLE_DOT_PT / 2,
            width: CHRONICLE_DOT_PT,
            height: CHRONICLE_DOT_PT,
            borderRadius: CHRONICLE_DOT_PT / 2,
            backgroundColor: dotColor,
          }}
        />
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 9 }}>
        <Text style={entryTitle}>{e.title}</Text>
        {e.subtitle}
        {e.lines}
        {bullets(e.bullets)}
      </View>
    </View>
  );

  const timeline = (entries: ChroniclePdfEntry[]) =>
    entries.map((e, i) => entry(e, i === entries.length - 1));

  const companyLine = (company: string, location: string): ReactNode =>
    company || location ? (
      <Text style={{ ...small, marginTop: 0.75 }}>
        {company ? <Text style={{ color: accent }}>{company}</Text> : null}
        {company && location ? " · " : ""}
        {location}
      </Text>
    ) : null;

  const experienceEntries: ChroniclePdfEntry[] = experience.map((role) => ({
    key: role.id,
    date: formatDateRange(role.startDate, role.endDate, role.isCurrent),
    title: role.role?.trim() || "Role",
    subtitle: companyLine(role.company?.trim() ?? "", role.location?.trim() ?? ""),
    lines: [],
    bullets: role.bullets ?? [],
  }));

  const educationEntries: ChroniclePdfEntry[] = education.map((edu) => {
    const notes = edu.notes?.trim() || "";
    const attestingBody = edu.attestingBody?.trim() || "";
    const lines: ReactNode[] = [];
    if (notes)
      lines.push(
        <Text key="notes" style={{ ...small, marginTop: 0.75 }}>
          {notes}
        </Text>,
      );
    if (edu.attested && attestingBody)
      lines.push(
        <Text key="attested" style={{ ...small, marginTop: 0.75 }}>
          {`Attested — ${attestingBody}`}
        </Text>,
      );
    return {
      key: edu.id,
      date: formatDateRange(edu.startDate, edu.endDate),
      title: chronicleDegreeTitle(edu),
      subtitle: companyLine(edu.school?.trim() ?? "", ""),
      lines,
      bullets: [],
    };
  });

  const projectEntries: ChroniclePdfEntry[] = projects.map((project) => {
    const link = project.link?.trim() || "";
    const lines: ReactNode[] = [];
    if (shouldShowProjectLink(link))
      lines.push(
        <Link
          key="link"
          src={normalizeHref(link)}
          style={{ ...small, marginTop: 0.75, textDecoration: "underline" }}
        >
          {shortenDisplayUrl(link)}
        </Link>,
      );
    return {
      key: project.id,
      date: "",
      title: project.name?.trim() || "Project",
      subtitle: null,
      lines,
      bullets: project.bullets ?? [],
    };
  });

  const skillLine = (skills: typeof generalSkills) =>
    skills.map((skill) => skill.name.trim()).join(" · ");
  // Sub-labels only when BOTH groups exist (same rule as the live template).
  const showSkillLabels = generalSkills.length > 0 && technicalSkills.length > 0;
  const skillLabel: Style = { ...small, ...bold, color: SLATE_800 };

  return (
    <View>
      {/* ── Header: name / headline / contact / essentials + optional photo ── */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 13.5 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...bold,
              fontSize: 22 * fs,
              lineHeight: 1.15 * ls,
              letterSpacing: -0.2,
              color: SLATE_900,
            }}
          >
            {name}
          </Text>
          {headline ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 10.5 * fs,
                lineHeight: 1.3 * ls,
                color: accent,
                marginTop: 2,
              }}
            >
              {headline}
            </Text>
          ) : null}
          {contactItems.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 5 }}>
              {contactItems.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                  {item.href ? (
                    <Link src={item.href} style={{ ...small, textDecoration: "none" }}>
                      {item.text}
                    </Link>
                  ) : (
                    <Text style={small}>{item.text}</Text>
                  )}
                  {i < contactItems.length - 1 ? (
                    <Text style={{ ...small, color: SLATE_400, marginHorizontal: 4.5 }}>|</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {essentials.length > 0 ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 7.5 * fs,
                lineHeight: 1.45 * ls,
                color: SLATE_600,
                marginTop: 2,
              }}
            >
              {essentials.map((item, i) => (
                <Text key={item.label}>
                  {i > 0 ? " · " : ""}
                  <Text style={bold}>{`${item.label}: `}</Text>
                  {item.value}
                </Text>
              ))}
            </Text>
          ) : null}
        </View>
        {showPhoto && data.personal.photo ? (
          <Image
            src={data.personal.photo}
            style={{
              width: PHOTO,
              height: PHOTO,
              objectFit: "cover",
              borderWidth: 0.75,
              borderColor: SLATE_300,
              borderRadius: roundPhoto ? PHOTO / 2 : 3,
            }}
          />
        ) : null}
      </View>

      {/* Sections are fragments, not Views: react-pdf only honours a
          heading's minPresenceAhead when the heading has previous siblings
          in the same parent (a heading wrapped as the first child of a
          section View is always orphaned at a page foot). */}
      {hasSummary ? (
        <>
          {heading("profile", "Profile")}
          <Text style={body}>{summary}</Text>
        </>
      ) : null}

      {hasExperience ? (
        <>
          {heading("experience", "Experience")}
          {timeline(experienceEntries)}
        </>
      ) : null}

      {hasEducation ? (
        <>
          {heading("education", "Education")}
          {timeline(educationEntries)}
        </>
      ) : null}

      {hasProjects ? (
        <>
          {heading("projects", "Projects")}
          {timeline(projectEntries)}
        </>
      ) : null}

      {hasSkills ? (
        <>
          {heading("skills", "Skills")}
          {generalSkills.length > 0 ? (
            <View>
              {showSkillLabels ? <Text style={skillLabel}>General</Text> : null}
              <Text style={body}>{skillLine(generalSkills)}</Text>
            </View>
          ) : null}
          {technicalSkills.length > 0 ? (
            <View style={{ marginTop: generalSkills.length > 0 ? 4 : 0 }}>
              {showSkillLabels ? <Text style={skillLabel}>Technical</Text> : null}
              <Text style={body}>{skillLine(technicalSkills)}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {hasLanguages ? (
        <>
          {heading("languages", "Languages")}
          {languages.map((lang) => (
            <Text key={lang.id} style={body}>
              <Text style={{ ...bold, color: SLATE_800 }}>{lang.name.trim()}</Text>
              {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
            </Text>
          ))}
        </>
      ) : null}

      {hasCertifications ? (
        <>
          {heading("certifications", "Certifications")}
          {certifications.map((cert, i) => {
            const certName = cert.name?.trim() || "";
            const tail = [cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).join(" | ");
            return (
              <Text
                key={cert.id}
                style={{ ...body, marginBottom: i < certifications.length - 1 ? 2 : 0 }}
              >
                <Text style={{ ...bold, color: SLATE_800 }}>{certName || tail}</Text>
                {certName && tail ? <Text style={{ color: SLATE_600 }}>{` | ${tail}`}</Text> : null}
              </Text>
            );
          })}
        </>
      ) : null}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   HARVARD PDF LAYOUT (zero-colour serif single column, centred
   header, education first, label-prefixed skills lines, no photo)
   Mirrors lib/templates/harvard.tsx section by section. Sizes are the
   live px × 0.75 on a 22/20pt sheet (CVDocument applies that padding).
   Serif = the embedded Instrument Serif once fonts are registered, else
   the PDF-standard Times pair (Node smoke); the body is the user's face.
   Instrument Serif has no bold cut, so hierarchy is size and caps only.
   ═══════════════════════════════════════════════════════════ */

const HarvardPDFLayout = ({ data }: { data: CvData }) => {
  const theme = resolveTheme(data.settings);
  const ready = pdfFontsReady();
  const fonts = pdfFontPair(data.settings.fontFamily, ready);
  const serif: Style = ready ? { fontFamily: PDF_FAMILY.serif } : { fontFamily: "Times-Roman" };
  const serifItalic: Style = ready
    ? { fontFamily: PDF_FAMILY.serif, fontStyle: "italic" }
    : { fontFamily: "Times-Italic" };
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;

  const name =
    `${data.personal.firstName} ${data.personal.lastName}`.trim() || "Your Name";
  const summary = data.personal.summary?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const contactItems = harvardContactItems(data.personal);
  const essentials = harvardEssentials(data.personal);
  const skillLines = harvardSkillLines(data);

  const hasObjective = summary.length > 0;
  const hasEducation = education.length > 0;
  const hasExperience = experience.length > 0;
  const hasProjects = projects.length > 0;
  const hasSkills = skillLines.length > 0;

  // Education-first; an empty education list falls through to experience
  // first. First rendered section gets marginTop 0; later ones 10pt × sp.
  const sectionOrder: Array<[string, boolean]> = [
    ["objective", hasObjective],
    ["education", hasEducation],
    ["experience", hasExperience],
    ["projects", hasProjects],
    ["skills", hasSkills],
  ];
  const firstSection = sectionOrder.find(([, present]) => present)?.[0] ?? null;

  const bold: Style = { fontFamily: fonts.bold, fontWeight: 700 };
  const body: Style = {
    fontFamily: fonts.regular,
    fontSize: 10 * fs,
    lineHeight: 1.35 * ls,
    color: HARVARD_INK,
  };
  const boldText: Style = { ...body, ...bold };
  // Serif italic is the only true italic both renderers can draw; a touch
  // larger than the sans body because Instrument Serif's x-height is smaller.
  const italic: Style = { ...serifItalic, fontSize: 10.5 * fs, lineHeight: 1.3 * ls, color: HARVARD_INK };
  const right: Style = { ...body, textAlign: "right", flexShrink: 0 };
  const row: Style = {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 9,
  };
  const soft: Style = { fontFamily: fonts.regular, color: HARVARD_INK_SOFT };

  const heading = (id: string, label: string) => (
    <View
      minPresenceAhead={56}
      style={{
        marginTop: firstSection === id ? 0 : 10 * sp,
        marginBottom: 4.5,
        paddingBottom: 1.5,
        borderBottomWidth: 0.5,
        borderBottomColor: HARVARD_RULE,
      }}
    >
      <Text style={{ ...serif, fontSize: 9 * fs, lineHeight: 1.25 * ls, letterSpacing: 0.5, color: HARVARD_INK }}>
        {label}
      </Text>
    </View>
  );

  const bullets = (items: string[]) => {
    const list = items.map((b) => b.trim()).filter(Boolean);
    if (list.length === 0) return null;
    return (
      <View style={{ marginTop: 1.5, paddingLeft: 12 }}>
        {list.map((bullet, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 0.75 }}>
            <Text style={{ ...body, width: 9 }}>•</Text>
            <Text style={{ ...body, flex: 1 }}>{bullet}</Text>
          </View>
        ))}
      </View>
    );
  };

  const bar = <Text style={{ ...soft, color: "#999999" }}>{"  |  "}</Text>;

  return (
    <View>
      {/* ── Header, all centred: serif name, pipe contact line, essentials ── */}
      <View style={{ alignItems: "center", marginBottom: 9 }}>
        <Text style={{ ...serif, fontSize: 20 * fs, lineHeight: 1.15 * ls, color: HARVARD_INK, textAlign: "center" }}>
          {name}
        </Text>
        {contactItems.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 3 }}>
            {contactItems.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                {i > 0 ? <Text style={{ ...soft, fontSize: 8.25 * fs, lineHeight: 1.45 * ls, color: "#999999", marginHorizontal: 4.5 }}>|</Text> : null}
                {item.href ? (
                  <Link src={item.href} style={{ ...soft, fontSize: 8.25 * fs, lineHeight: 1.45 * ls, textDecoration: "none" }}>
                    {item.text}
                  </Link>
                ) : (
                  <Text style={{ ...soft, fontSize: 8.25 * fs, lineHeight: 1.45 * ls }}>{item.text}</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
        {essentials.length > 0 ? (
          <Text style={{ ...soft, fontSize: 7.5 * fs, lineHeight: 1.45 * ls, textAlign: "center", marginTop: 1.5 }}>
            {essentials.map((item, i) => (
              <Text key={item.label}>
                {i > 0 ? bar : null}
                {`${item.label}: ${item.value}`}
              </Text>
            ))}
          </Text>
        ) : null}
      </View>

      {/* Sections are fragments so headings honour minPresenceAhead. */}
      {hasObjective ? (
        <>
          {heading("objective", "CAREER OBJECTIVE")}
          <Text style={body}>{summary}</Text>
        </>
      ) : null}

      {hasEducation ? (
        <>
          {heading("education", "EDUCATION")}
          {education.map((edu, i) => {
            const school = edu.school?.trim() || "";
            const notes = edu.notes?.trim() || "";
            const attestingBody = edu.attestingBody?.trim() || "";
            return (
              <View key={edu.id} style={{ marginBottom: i < education.length - 1 ? 5 : 0 }} wrap={false}>
                <View style={row}>
                  <Text style={{ ...boldText, flex: 1 }}>{harvardDegreeTitle(edu)}</Text>
                  <Text style={right}>{formatDateRange(edu.startDate, edu.endDate)}</Text>
                </View>
                {school ? <Text style={italic}>{school}</Text> : null}
                {notes ? <Text style={body}>{notes}</Text> : null}
                {edu.attested && attestingBody ? (
                  <Text style={body}>{`Attested — ${attestingBody}`}</Text>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

      {hasExperience ? (
        <>
          {heading("experience", "EXPERIENCE & INTERNSHIPS")}
          {experience.map((role, i) => {
            const company = role.company?.trim() || "";
            const location = role.location?.trim() || "";
            const title = role.role?.trim() || "";
            const dates = formatDateRange(role.startDate, role.endDate, role.isCurrent);
            return (
              <View
                key={role.id}
                style={{ marginBottom: i < experience.length - 1 ? 5 : 0 }}
                minPresenceAhead={48}
              >
                <View style={row}>
                  <Text style={{ ...boldText, flex: 1 }}>{company || title || "Role"}</Text>
                  {location ? <Text style={right}>{location}</Text> : null}
                </View>
                {company && (title || dates) ? (
                  <View style={row}>
                    <Text style={{ ...italic, flex: 1 }}>{title}</Text>
                    {dates ? <Text style={right}>{dates}</Text> : null}
                  </View>
                ) : dates ? (
                  <View style={row}>
                    <View style={{ flex: 1 }} />
                    <Text style={right}>{dates}</Text>
                  </View>
                ) : null}
                {bullets(role.bullets ?? [])}
              </View>
            );
          })}
        </>
      ) : null}

      {hasProjects ? (
        <>
          {heading("projects", "PROJECTS")}
          {projects.map((project, i) => {
            const link = project.link?.trim() || "";
            return (
              <View key={project.id} style={{ marginBottom: i < projects.length - 1 ? 5 : 0 }} wrap={false}>
                <Text style={boldText}>{project.name?.trim() || "Project"}</Text>
                {shouldShowProjectLink(link) ? (
                  <Link src={normalizeHref(link)} style={{ ...body, color: HARVARD_INK_SOFT, textDecoration: "underline" }}>
                    {shortenDisplayUrl(link)}
                  </Link>
                ) : null}
                {bullets(project.bullets ?? [])}
              </View>
            );
          })}
        </>
      ) : null}

      {hasSkills ? (
        <>
          {heading("skills", "SKILLS & INTERESTS")}
          {skillLines.map((line, i) => (
            <Text key={line.label} style={{ ...body, marginBottom: i < skillLines.length - 1 ? 1.5 : 0 }}>
              <Text style={bold}>{`${line.label}: `}</Text>
              {line.value}
            </Text>
          ))}
        </>
      ) : null}
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
  // Page Margins (theme.marginScale) scales the page padding for EVERY
  // template (audit 2026-10 defect 19 — it used to skip the sidebar layouts).
  // The edge-bleed sidebars (executive / corp-sidebar / onyx / sandstone)
  // paint their band as a fixed, absolutely positioned layer that reaches the
  // physical page edges on every page, and pull a transparent column over it
  // with negative margins that are themselves scaled, so the band keeps its
  // fixed inner padding (as live) while the main column's margins breathe.
  // Exec Split's page-1 header bleeds the same way.
  const theme = resolveTheme(data.settings);
  const fonts = pdfFontPair(data.settings.fontFamily, pdfFontsReady());
  const s = buildStyles(theme, fonts);
  const marginScale = theme.marginScale;
  // Harvard runs a tighter sheet (22pt top/bottom, 20pt sides) than the
  // shared 27/24 — the one-page graduate format (template audit 2026-10).
  const pagePadding =
    templateId === "harvard"
      ? HARVARD_PAGE_PADDING_PT
      : { vertical: 27, horizontal: 24 };
  const pageStyle = {
    ...s.page,
    paddingTop: pagePadding.vertical * marginScale,
    paddingBottom: pagePadding.vertical * marginScale,
    paddingLeft: pagePadding.horizontal * marginScale,
    paddingRight: pagePadding.horizontal * marginScale,
  };

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
      case "banner":
        return <BannerPDFLayout data={data} />;
      case "gulf-standard":
        return <GulfStandardPDFLayout data={data} />;
      case "chronicle":
        return <ChroniclePDFLayout data={data} />;
      case "harvard":
        return <HarvardPDFLayout data={data} />;
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
