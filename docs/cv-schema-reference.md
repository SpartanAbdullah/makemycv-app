# CV Data Schema Reference — MakeMyCV

> **Audit-only document.** Extracted from source on 2026-05-11. No code modified.
> All field names, types, and constraints below come directly from the files cited
> at the top of each section — nothing is inferred.

---

## 1. Source-of-truth files

| Concern | File |
| --- | --- |
| TypeScript types | [lib/types/cv.ts](../lib/types/cv.ts) |
| Zod validation schemas | [lib/schemas/cvSchemas.ts](../lib/schemas/cvSchemas.ts) |
| Default empty document | [lib/store/cvStore.ts:89](../lib/store/cvStore.ts) (`defaultCvData`) |
| Zustand store + persistence | [lib/store/cvStore.ts](../lib/store/cvStore.ts) |
| Step config | [lib/utils/steps.ts](../lib/utils/steps.ts) |
| Step completion check | [lib/utils/stepValidation.ts](../lib/utils/stepValidation.ts) |
| Templates (HTML/React) | [lib/templates/index.tsx](../lib/templates/index.tsx) + 6 sibling files |
| PDF renderer | [components/pdf/CVDocument.tsx](../components/pdf/CVDocument.tsx) |
| DOCX export | [lib/utils/docxExport.ts](../lib/utils/docxExport.ts) |
| Photo upload constraints | [lib/utils/imageUtils.ts](../lib/utils/imageUtils.ts), [components/builder/PhotoUpload.tsx](../components/builder/PhotoUpload.tsx) |
| Bullet count cap | [lib/utils/bullets.ts](../lib/utils/bullets.ts) |
| Date format helper | [lib/utils/format.ts](../lib/utils/format.ts) |
| Sanitize / validate inputs | [lib/sanitize.ts](../lib/sanitize.ts) |
| Language level enum | [lib/language.ts](../lib/language.ts) |
| RTL detection (import-only) | [lib/utils/rtl.ts](../lib/utils/rtl.ts) |
| Import pipeline types | [lib/importers/adapter.ts](../lib/importers/adapter.ts), [lib/importers/fieldMapper.ts](../lib/importers/fieldMapper.ts) |

---

## 2. Complete TypeScript interface

Paste-ready block — copied verbatim from [lib/types/cv.ts](../lib/types/cv.ts).

```ts
export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type LanguageLevel =
  | "elementary"
  | "conversational"
  | "professional"
  | "full_professional"
  | "native"
  // legacy fallbacks (still accepted by Zod + formatLanguageLevel)
  | "beginner"
  | "intermediate"
  | "advanced";

export type PlanTier = "free" | "pro";
export type PhotoShape = "round" | "square";

export type CvPersonal = {
  firstName: string;       // required (Zod min 1)
  lastName: string;        // required (Zod min 1)
  headline: string;        // optional in Zod
  email: string;           // required, must be valid email
  phone: string;           // optional in Zod (UI labels MANDATORY — gap)
  location: string;        // optional
  website: string;         // optional
  linkedin: string;        // optional (UI warns if not linkedin.com/in/)
  summary: string;         // optional in Zod; summarySchema requires min 30 chars when present
  photo?: string;          // base64 data URL (JPEG, 200x200 after auto-crop)
  showPhoto?: boolean;     // photo only renders when BOTH set
  nationality?: string;
  country?: string;        // present in type, NOT rendered by any template
  dateOfBirth?: string;    // freeform string; UI placeholder "15/03/1990"
  drivingLicense?: string;
};

export type CvExperience = {
  id: string;              // crypto.randomUUID() / createId()
  company: string;         // required
  role: string;            // required
  location: string;        // optional
  startDate: string;       // required; freeform (see §6 for accepted formats)
  endDate: string;         // optional
  isCurrent: boolean;      // when true, templates render "Present" regardless of endDate
  bullets: string[];       // min 1; each bullet min 3 chars; max 8 (MAX_BULLETS)
};

export type CvEducation = {
  id: string;
  school: string;          // required
  degree: string;          // required
  field: string;           // optional
  startDate: string;       // required
  endDate: string;         // optional
  notes?: string;          // catch-all (no dedicated GPA / honours field)
  attested?: boolean;      // when true, templates show "✓ Attested — {body}"
  attestingBody?: string;  // only displayed when attested === true
};

export type CvSkill = {
  id: string;
  name: string;            // required
  level?: SkillLevel;      // optional; only `beginner|intermediate|advanced`
};

export type CvLanguage = {
  id: string;
  name: string;            // required
  level?: LanguageLevel;   // optional; CEFR-aligned (see §6)
};

export type CvCertification = {
  id: string;
  name: string;            // required
  issuer: string;          // required
  date?: string;           // optional, freeform
};

export type CvProject = {
  id: string;
  name: string;            // required
  link?: string;           // optional; sentinel "no link was pasted" hides the link in all templates
  bullets: string[];       // min 1; each bullet min 3 chars
};

export type CvSettings = {
  templateId: string;       // one of: classic | modern | executive | ats-clean | exec-split | corp-sidebar
  accentColor?: string;     // hex; default "#1e5b54"; not currently consumed by templates
  fontScale?: number;       // default 1; not currently consumed by templates
  sectionOrder?: string[];  // default order below; not currently consumed by templates
  photoShape?: PhotoShape;  // "round" | "square"; default "round"
};

export type CvData = {
  personal: CvPersonal;
  experience: CvExperience[];
  education: CvEducation[];
  skills: CvSkill[];
  languages: CvLanguage[];
  certifications: CvCertification[];
  projects: CvProject[];
  settings: CvSettings;
};
```

**Default `sectionOrder`** ([lib/store/cvStore.ts:111](../lib/store/cvStore.ts)):

```
["summary", "experience", "education", "skills", "languages", "certifications", "projects"]
```

---

## 3. Field-by-field reference

### 3.1 `personal`

| Field | Type | Required (Zod) | Default | Notes |
| --- | --- | --- | --- | --- |
| `firstName` | string | ✅ min 1 | `""` | Sanitiser strips digits/symbols; preserves Unicode letters |
| `lastName` | string | ✅ min 1 | `""` | Same sanitiser as firstName |
| `headline` | string | optional | `""` | Sanitised as job title (letters, digits, `-,&./`) |
| `email` | string | ✅ valid email | `""` | Auto-lowercased + whitespace stripped |
| `phone` | string | optional in Zod | `""` | **UI label says MANDATORY but Zod doesn't enforce — see Gotchas** |
| `location` | string | optional | `""` | Sanitised location chars |
| `website` | string | optional | `""` | Auto-prepends `https://` on blur if scheme missing |
| `linkedin` | string | optional | `""` | UI warns if not `linkedin.com/in/...` |
| `summary` | string | optional, min 30 chars when present | `""` | Word-count warnings <30 / >120 |
| `photo` | base64 string | optional | `undefined` | Always JPEG, 200×200 — see §6 |
| `showPhoto` | boolean | optional | `undefined` (treated as false) | Photo renders only when both `photo` AND `showPhoto` are truthy |
| `nationality` | string | optional | `undefined` | UAE-friendly field |
| `country` | string | optional | `undefined` | **Defined in type & schema, not rendered by any template — dead field** |
| `dateOfBirth` | string | optional | `undefined` | Freeform; templates prefix with "DOB:" |
| `drivingLicense` | string | optional | `undefined` | Templates prefix with "DL:" in ATS Clean / Exec Split |

### 3.2 `experience` (array)

| Field | Type | Required (Zod) | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | UUID — generated client-side |
| `company` | string | ✅ min 1 | Sanitised company chars |
| `role` | string | ✅ min 1 | Sanitised job-title chars |
| `location` | string | optional | |
| `startDate` | string | ✅ min 1 | Freeform (see §6) |
| `endDate` | string | optional | Hidden when `isCurrent` is true |
| `isCurrent` | boolean | required | When true, formatter renders `"{startDate} – Present"` and ignores endDate |
| `bullets` | string[] | ≥1 entry, each ≥3 chars | Capped at 8 (`MAX_BULLETS`) — UI prevents adding more |

Array minimum: 1 role.

### 3.3 `education` (array)

| Field | Type | Required (Zod) | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | |
| `school` | string | ✅ min 1 | |
| `degree` | string | ✅ min 1 | |
| `field` | string | optional | "Field of study" |
| `startDate` | string | ✅ min 1 | |
| `endDate` | string | optional | |
| `notes` | string | optional | Generic notes — only catch-all for GPA/honours |
| `attested` | boolean | optional | UAE-attestation flag |
| `attestingBody` | string | optional | Only displayed when `attested === true` |

Array minimum: 1 entry.

### 3.4 `skills` (array)

| Field | Type | Required (Zod) | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | |
| `name` | string | ✅ min 1 | |
| `level` | enum / optional | optional | Only `beginner` \| `intermediate` \| `advanced` |

Array minimum: 1 skill.

### 3.5 `languages` (array)

| Field | Type | Required (Zod) | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | |
| `name` | string | ✅ min 1 | |
| `level` | enum / optional | optional | CEFR-aligned: see §6 |

Array minimum: **0** at the schema level. (Step UI marks step "complete" only with ≥1 entry — see [stepValidation.ts:31](../lib/utils/stepValidation.ts).)

### 3.6 `certifications` (array)

| Field | Type | Required (Zod) | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | |
| `name` | string | ✅ min 1 | |
| `issuer` | string | ✅ min 1 | |
| `date` | string | optional | Freeform |

Array minimum: 0 (same step-validation pattern as languages).

### 3.7 `projects` (array)

| Field | Type | Required (Zod) | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | |
| `name` | string | ✅ min 1 | |
| `link` | string | optional | Sentinel `"no link was pasted"` (case-insensitive) → templates hide |
| `bullets` | string[] | ≥1 entry, each ≥3 chars | No explicit cap in schema (UI uses MAX_BULLETS=8) |

### 3.8 `settings`

| Field | Type | Required (Zod) | Default | Currently consumed? |
| --- | --- | --- | --- | --- |
| `templateId` | string | ✅ min 1 | `"classic"` | Yes — selects template + PDF layout |
| `accentColor` | string | optional | `"#1e5b54"` | **No** — declared but no template reads it |
| `fontScale` | number | optional | `1` | **No** |
| `sectionOrder` | string[] | optional | (see above) | **No** — section order is hard-coded per template |
| `photoShape` | `"round" \| "square"` | **missing from `settingsSchema`** | `"round"` | Yes — read by every template that renders the photo |

---

## 4. Conditional / derived fields

| Rule | Where enforced |
| --- | --- |
| `isCurrent: true` ⇒ `endDate` is ignored (rendered as "Present") | [`formatDateRange`](../lib/utils/format.ts), [`formatRange`](../lib/templates/utils.ts), DOCX export |
| `isCurrent` and `endDate` are **not mutually exclusive in the schema** — Zod allows both. UI typically clears endDate via the checkbox but does not force it. | [cvSchemas.ts:25](../lib/schemas/cvSchemas.ts) |
| Photo renders only when `personal.photo && personal.showPhoto` | All 6 templates (classic, modern, executive, ats-clean, exec-split, corp-sidebar) and `CVDocument` |
| `attestingBody` text shown only when `attested === true` | All templates that render education |
| Project link hidden when value is empty OR equals `"no link was pasted"` (case-insensitive) | All templates' `shouldShowProjectLink()` |
| Headline auto-seeded on import from current/most-recent role's title (never `role + company`) | [fieldMapper.ts:21 `seedHeadline()`](../lib/importers/fieldMapper.ts) |
| Free plan watermark in PDF + HTML preview | [`CVDocument`](../components/pdf/CVDocument.tsx) (`plan === "free"` shows fixed footer text); [classic.tsx:112](../lib/templates/classic.tsx) renders translucent diagonal "MakeMyCV \| Free" — only Classic does this in HTML |

---

## 5. Templates and their props

All templates live in [lib/templates/](../lib/templates) and expose the same React signature:

```ts
type TemplateProps = { data: CvData; plan?: PlanTier };
type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  badge?: string;
  Thumbnail: () => React.ReactElement;
  Render: (props: TemplateProps) => React.ReactElement;
};
```

Registered in [`templates`](../lib/templates/index.tsx) array:

| `id` | Name | Description | Notes |
| --- | --- | --- | --- |
| `classic` | Classic | Single-column layout for traditional roles | Only template that renders the free-plan diagonal watermark in HTML preview |
| `modern` | Modern | Two-column with refined accent section | Aside is fixed 200px; renders skills as pills |
| `executive` | Executive | Navy sidebar + main column for senior roles | Sidebar 200px wide; uses emoji contact icons |
| `ats-clean` | ATS Clean *(badge: "ATS Optimised")* | Single column; plain text only, no emoji, middle-dot separators, link as plain text | Targets max ATS pass-rate |
| `exec-split` | Executive Split | Dark header band + two-column body | |
| `corp-sidebar` | Corporate | Right dark sidebar + structured left content | |

The `plan` prop is currently **only** wired into `classic.tsx` (HTML watermark) and `CVDocument.tsx` (PDF watermark). The other 5 HTML templates accept `plan` but never read it.

`templateId` lookup is forgiving: [`getTemplateById`](../lib/templates/index.tsx) falls back to `templates[0]` (classic) for unknown IDs.

---

## 6. Render pipeline (form → state → output)

```
┌──────────────────┐     react-hook-form      ┌──────────────────┐
│  Step components │ ───── + zodResolver ───▶ │  useCvStore      │
│  (PersonalStep,  │                          │  (Zustand)       │
│   ExperienceStep │                          │                  │
│   ...)           │ ◀──── default values ─── │  data: CvData    │
└──────────────────┘                          └────────┬─────────┘
                                                       │
                              subscribe (debounced 500ms)
                                                       ▼
                                            ┌──────────────────────┐
                                            │ saveCvToStorage()    │
                                            │ localStorage key:    │
                                            │ "makemycv:data"      │
                                            └──────────────────────┘
                                                       │
                            ┌──────────────────────────┼─────────────────────────┐
                            │                          │                         │
                            ▼                          ▼                         ▼
                ┌──────────────────────┐   ┌────────────────────────┐  ┌─────────────────────────┐
                │ PreviewPanel /       │   │ downloadCV() →         │  │ exportToDocx(data)      │
                │ PreviewClient        │   │   @react-pdf/renderer  │  │   uses `docx` package   │
                │ → template.Render({  │   │   → CVDocument         │  │ → Blob → <a download>   │
                │     data })          │   │   → pdf().toBlob()     │  │   "{First}-{Last}-CV    │
                │ (live HTML preview)  │   │   → "CV_First_Last.pdf"│  │    .docx"               │
                └──────────────────────┘   └────────────────────────┘  └─────────────────────────┘
```

Concrete steps:

1. **Form input** — each builder step uses `react-hook-form` + `zodResolver`, debounced 250ms before pushing to the store via `updateSection(key, value)` ([PersonalStep.tsx:77](../components/builder/steps/PersonalStep.tsx)).
2. **Store** — `useCvStore` (Zustand). Initial hydration from localStorage happens in `bindCvStorage()`.
3. **Persistence** — store subscribes to its own state; `saveCvToStorage` is debounced 500ms. Storage key: `makemycv:data`. Free-download flag, Pro flag, and applied coupon live under separate keys.
4. **Live preview** — `PreviewPanel` reads `data` from the store + `getTemplateById(templateId)` and renders the React template directly into the page. No serialisation in between.
5. **Print/preview page** — `app/preview/page.tsx` (`/preview`) renders the same template at full width inside a Suspense boundary. **Note:** memory says "PDF export = window.print() via /preview?print=1&autoprint=1" — that path no longer exists. There is no `window.print()` call anywhere in `app/`, `components/`, or `lib/`. PDF export now goes through `@react-pdf/renderer`.
6. **PDF export** — `BuilderHeader.handleExportPdf` → `downloadCV(data, plan, templateId)` ([hooks/useDownloadCV.ts:19](../hooks/useDownloadCV.ts)) → dynamic-imports `@react-pdf/renderer` + `CVDocument` → `pdf(doc).toBlob()` → triggers `<a download>`. `CVDocument` is one ~1900-line file with six layout components (`ClassicPDFLayout`, `ModernPDFLayout`, etc.) chosen by `templateId`.
7. **DOCX export** — `exportToDocx(data)` ([lib/utils/docxExport.ts](../lib/utils/docxExport.ts)) builds a `Document` via the `docx` package, packs to a Blob, and triggers download as `{Name}-CV.docx`. Single visual style — does not vary by `templateId`.

---

## 7. Sample data (validates against the full schema)

```json
{
  "personal": {
    "firstName": "Layla",
    "lastName": "Al-Rashidi",
    "headline": "Senior Operations Manager",
    "email": "layla.alrashidi@example.com",
    "phone": "+971 50 123 4567",
    "location": "Dubai, UAE",
    "website": "https://laylaops.example.com",
    "linkedin": "https://linkedin.com/in/layla-alrashidi",
    "summary": "Operations leader with 9+ years scaling fit-out and interior projects across the GCC. Built supplier networks across UAE, KSA and Oman; cut average project lead time by 22% and improved on-time delivery to 97% in 2025.",
    "photo": "data:image/jpeg;base64,/9j/REPLACE_WITH_BASE64_JPEG",
    "showPhoto": true,
    "nationality": "Emirati",
    "country": "United Arab Emirates",
    "dateOfBirth": "15/03/1990",
    "drivingLicense": "UAE Light Vehicle License"
  },
  "experience": [
    {
      "id": "exp-01",
      "company": "Interior360 General Trading LLC",
      "role": "Head of Operations",
      "location": "Dubai, UAE",
      "startDate": "Jan 2023",
      "endDate": "",
      "isCurrent": true,
      "bullets": [
        "Led a 24-person ops team across procurement, logistics and on-site delivery for AED 60M+ annual fit-out portfolio.",
        "Re-negotiated 18 supplier contracts, reducing direct material cost by 11% (AED 4.2M) without changing spec.",
        "Rolled out Odoo-based job-cost tracking; eliminated month-end reconciliation gap of ~AED 800K and shortened close from 11 to 3 days."
      ]
    },
    {
      "id": "exp-02",
      "company": "Depa Interiors",
      "role": "Senior Project Manager",
      "location": "Abu Dhabi, UAE",
      "startDate": "2019-06",
      "endDate": "2022-12",
      "isCurrent": false,
      "bullets": [
        "Delivered 7 hospitality fit-outs (3- to 5-star) across UAE and KSA, all within ±3% of budget.",
        "Introduced weekly subcontractor scorecards; on-time milestone hit rate climbed from 71% to 94%."
      ]
    }
  ],
  "education": [
    {
      "id": "edu-01",
      "school": "American University of Sharjah",
      "degree": "BSc",
      "field": "Industrial Engineering",
      "startDate": "2011",
      "endDate": "2015",
      "notes": "GPA 3.7 / 4.0 — Dean's List 2013–2015",
      "attested": true,
      "attestingBody": "UAE Ministry of Foreign Affairs"
    }
  ],
  "skills": [
    { "id": "sk-01", "name": "Operations strategy", "level": "advanced" },
    { "id": "sk-02", "name": "Procurement & vendor management", "level": "advanced" },
    { "id": "sk-03", "name": "Odoo ERP", "level": "intermediate" },
    { "id": "sk-04", "name": "PMP methodology" },
    { "id": "sk-05", "name": "Power BI" }
  ],
  "languages": [
    { "id": "lg-01", "name": "Arabic", "level": "native" },
    { "id": "lg-02", "name": "English", "level": "full_professional" },
    { "id": "lg-03", "name": "French", "level": "conversational" }
  ],
  "certifications": [
    { "id": "cert-01", "name": "PMP", "issuer": "Project Management Institute", "date": "2021" },
    { "id": "cert-02", "name": "Lean Six Sigma — Green Belt", "issuer": "ASQ", "date": "2019" }
  ],
  "projects": [
    {
      "id": "proj-01",
      "name": "Atlantis The Royal — F&B fit-out",
      "link": "https://laylaops.example.com/case-studies/atlantis",
      "bullets": [
        "Coordinated 9 specialist subcontractors and 140+ on-site workers over a 14-week build-out.",
        "Closed handover with a zero-defect snag list — first time in the venue for this contractor."
      ]
    }
  ],
  "settings": {
    "templateId": "classic",
    "accentColor": "#1e5b54",
    "fontScale": 1,
    "sectionOrder": [
      "summary",
      "experience",
      "education",
      "skills",
      "languages",
      "certifications",
      "projects"
    ],
    "photoShape": "round"
  }
}
```

---

## 8. Constraints and gotchas

### Hard constraints (enforced in code)

| Constraint | Value | Where |
| --- | --- | --- |
| Photo file types | `image/jpeg`, `image/png`, `image/webp` | [imageUtils.ts:62](../lib/utils/imageUtils.ts) |
| Photo max upload size | 5 MB | [imageUtils.ts:67](../lib/utils/imageUtils.ts) |
| Photo output | center-cropped to 200×200 JPEG @ 0.85 quality (base64 stored in state) | [imageUtils.ts:7](../lib/utils/imageUtils.ts) |
| Bullets per role | hard cap of 8 (`MAX_BULLETS`) | [bullets.ts:1](../lib/utils/bullets.ts), enforced in [ExperienceStep.tsx:150](../components/builder/steps/ExperienceStep.tsx) |
| Bullet min length | 3 chars (Zod) | [cvSchemas.ts:36](../lib/schemas/cvSchemas.ts) |
| Summary min length | 30 chars (Zod, when present) | [cvSchemas.ts:22](../lib/schemas/cvSchemas.ts) |
| Email format | RFC-ish `z.string().email()` | [cvSchemas.ts:7](../lib/schemas/cvSchemas.ts) |
| Skill levels | `beginner \| intermediate \| advanced` | [cvSchemas.ts:66](../lib/schemas/cvSchemas.ts) |
| Language levels | `elementary \| conversational \| professional \| full_professional \| native` (+ legacy `beginner \| intermediate \| advanced`) | [cvSchemas.ts:78](../lib/schemas/cvSchemas.ts), [language.ts:1](../lib/language.ts) |
| Page size (PDF) | A4 (`<Page size="A4">`) | [CVDocument.tsx:1901](../components/pdf/CVDocument.tsx) |
| HTML template canvas | `width: 794px; minHeight: 1123px` (≈ A4 @ 96dpi) — used by all templates except classic which uses Tailwind padding instead | e.g. [ats-clean.tsx:114](../lib/templates/ats-clean.tsx) |

### Soft warnings (UI hints, not enforced)

| Warning | Threshold | Where |
| --- | --- | --- |
| "Consider splitting into 2 bullets" | bullet >180 chars | [ExperienceStep.tsx:321](../components/builder/steps/ExperienceStep.tsx) |
| "Summary is quite short" | <30 words | [sanitize.ts:148](../lib/sanitize.ts) |
| "Summary is too long" | >120 words | [sanitize.ts:151](../lib/sanitize.ts) |
| "LinkedIn URL should look like..." | doesn't contain `linkedin.com/in/` | [sanitize.ts:106](../lib/sanitize.ts) |
| Year validation (when used) | 1950 ≤ year ≤ current+2 | [sanitize.ts:113](../lib/sanitize.ts) |

### Date format

`startDate` / `endDate` / certification `date` are **freeform strings**. The format helper ([`formatDateRange`](../lib/utils/format.ts)) recognises and normalises:

- `YYYY` (e.g. `2019`) → kept as-is
- `YYYY-MM` or `YYYY/MM` (e.g. `2024-01`) → `Jan 2024`
- `MM-YYYY` or `MM/YYYY` (e.g. `06-2019`) → `Jun 2019`
- `MMM YYYY` (e.g. `Jan 2024`) → `Jan 2024`
- Anything else → returned unchanged

UI placeholders in the form steps suggest `e.g. Jan 2024`. There is no `Date` object anywhere in the schema.

### Gotchas to know before designing a template

1. **Phone is optional in Zod, mandatory in the UI label.** [PersonalStep.tsx:238](../components/builder/steps/PersonalStep.tsx) labels phone "PHONE (MANDATORY)" but [`personalSchema`](../lib/schemas/cvSchemas.ts) does not require it. A schema-valid CV may have an empty phone.
2. **`personal.country` is dead.** Field exists in `CvPersonal` and is captured by [PersonalStep.tsx:347](../components/builder/steps/PersonalStep.tsx) but **no template renders it**. The user-visible `location` field is the only place locations actually surface.
3. **`isCurrent` does not nullify `endDate`.** Both can hold a value at once. Templates and exports treat `isCurrent` as the source of truth and render "Present", but a downstream consumer should not assume `endDate` is empty when `isCurrent === true`.
4. **`settings.photoShape` is missing from the Zod schema.** It exists on the TS type and is read by every template, but [`settingsSchema`](../lib/schemas/cvSchemas.ts) doesn't include it. A round-trip through `settingsSchema.parse()` would drop it.
5. **`accentColor`, `fontScale`, `sectionOrder` are stored but never consumed** by any template, the PDF renderer, or the DOCX exporter. They are essentially placeholders today.
6. **The `plan` prop only does something in 2 of 6 templates (HTML).** Only `ClassicTemplate` renders the diagonal "Free" watermark. The other five HTML templates accept the prop and ignore it. The PDF watermark in `CVDocument` runs for all templates via the shared `Page` wrapper.
7. **Skill ID coercion on hydration.** Skills loaded from older localStorage payloads run through [`ensureSkillIds`](../lib/store/cvStore.ts) which can accept a plain string and synthesise an ID. New templates should never assume `id` was server-generated.
8. **Project `link === "no link was pasted"` is a sentinel.** Set by some import paths to mean "user explicitly skipped". All templates hide the link in this case (case-insensitive). Don't render it raw.
9. **`ATSCleanTemplate` is intentionally bare.** No emoji in contact line, links rendered as plain text (no `<a>`), middle-dot separators. Any pattern that adds emoji or rich link decoration must be skipped on this template.
10. **No i18n.** All section headings ("Experience", "Education", …) are hard-coded English strings inside each template. There is no translation layer, no locale switch, no message catalogue. The `lang` attribute on `<html>` is hard-coded `"en"` ([app/layout.tsx:114](../app/layout.tsx)).
11. **RTL is detection-only.** [`lib/utils/rtl.ts`](../lib/utils/rtl.ts) (`containsRtl`, `getDir`) is consumed only by [components/import/MappingReview.tsx](../components/import/MappingReview.tsx) so Arabic/Hebrew text in import previews displays right-to-left. Templates do **not** apply `dir="rtl"` based on content. An Arabic-only CV will currently render LTR.
12. **`languages` schema doesn't enforce min 1 — step gating does.** `languagesSchema` accepts an empty array; the step validator additionally checks `length > 0`. Same for `certifications`, `projects`. Treat `[]` as valid input.
13. **`importCvVersion(partial, "merge")` only fills empty personal fields** — strict equality `=== ""`. A field with a single space won't be overwritten.
14. **DOCX export is template-agnostic.** [`exportToDocx`](../lib/utils/docxExport.ts) ignores `settings.templateId` and produces one minimal style. New visual templates won't show up in DOCX.

---

## 9. Schema gaps (fields a strong CV template would want, but don't exist)

These are gaps relative to common CV expectations — flagged for product discussion, **not** changes to be made:

### Missing sections
- **Awards / Honours** — currently has to be jammed into education `notes` or a project bullet.
- **Publications** — common for academic, research, healthcare CVs.
- **Volunteer experience** — handled today by misusing `experience` with no marker.
- **References** (or a structured "References available on request" toggle).
- **Interests / Hobbies** — light section, but expected on graduate CVs.
- **Custom / extra section** — no escape hatch for "Speaking engagements", "Patents", "Memberships", etc.

### Missing fields on existing sections
- **Education**
  - No `gpa` / `grade` / `honours` / `classOfDegree` — `notes` is the catch-all.
  - No `location` for the institution.
  - No `attestation date` — only the body is captured.
- **Experience**
  - No `employmentType` (full-time / contract / freelance) — important for UAE residency-status decisions.
  - No `industry` tag.
- **Certifications**
  - No `expiryDate` — critical for safety/compliance certs (NEBOSH, OSHA, etc.).
  - No `credentialId` / `credentialUrl` — needed to make the cert verifiable.
- **Skills**
  - No `category` / `group` (e.g. "Languages", "Tools", "Software", "Soft skills"). Some templates would group; today everything is a flat list.
  - No "featured / primary" flag for a top-skills callout.
- **Projects**
  - No date range (start/end).
  - No `role` field (your role on the project).
  - No `tech stack` / `tools used` separate from bullets.
- **Personal**
  - No structured address (street/city/emirate) — only freeform `location`.
  - No `gender`, `maritalStatus`, `visaStatus`, `passportCountry` — UAE recruiters sometimes expect these (collect with care; many international employers reject CVs that include them).
  - `country` exists but is unused — either wire it in or remove.

### Settings / theming
- `accentColor`, `fontScale`, `sectionOrder` are persisted but **no template reads them**. Either remove or wire into a real customisation surface.
- No `dateFormat` preference (e.g. `MMM YYYY` vs `MM/YYYY`).
- No `pageSize` toggle (A4 vs Letter) — currently A4-only.
- No `showWatermark` override — implicit in `plan`.

### Schema hygiene
- `settingsSchema` is missing `photoShape` — bring it back in line with the TS type.
- `LanguageLevel` includes legacy `beginner | intermediate | advanced` *and* the CEFR set, so the same level can be expressed three ways. A migration could collapse to CEFR-only.
- `personal.summary` is duplicated as both a personal field and a separate "summary" step. The data model treats it as a `personal` field, but the UI presents it as a step in its own right — a future consumer reading by step name will look for `data.summary` and find nothing.
