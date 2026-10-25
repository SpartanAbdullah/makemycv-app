import type React from "react";
import type { CvData, PlanTier } from "../types/cv";
import { ATSCleanTemplate } from "./ats-clean";
import { BannerTemplate } from "./banner";
import { ClassicTemplate } from "./classic";
import { CorpSidebarTemplate } from "./corp-sidebar";
import { ExecSplitTemplate } from "./exec-split";
import { ExecutiveTemplate } from "./executive";
import { GulfStandardTemplate } from "./gulf-standard";
import { ModernTemplate } from "./modern";
import { OnyxTemplate } from "./onyx";
import { ProfessionalPhotoTemplate, ProfessionalTemplate } from "./professional";
import { SandstoneTemplate } from "./sandstone";

/**
 * Badge tones drive both meaning and color in the template picker:
 *  - "recommended": filled accent, highest emphasis — the safe default we
 *    steer the indecisive majority toward (only ONE template should carry it).
 *  - "ats": green, reassures the #1 user fear ("will a bot reject my CV?").
 *    Only honest for genuinely single-column, parseable layouts.
 *  - "neutral": quiet grey for design-led (two-column) templates.
 *  - "new": blue "New" ribbon for freshly-added templates (cvtoolspro-style).
 */
export type TemplateBadgeTone = "recommended" | "ats" | "neutral" | "new";
export type TemplateBadge = { label: string; tone: TemplateBadgeTone };

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  badges?: TemplateBadge[];
  Thumbnail: () => React.ReactElement;
  Render: ({ data, plan }: { data: CvData; plan?: PlanTier }) => React.ReactElement;
};

const ClassicThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
    {/* Live header: name, headline and a LEFT-aligned contact row, photo top-right */}
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-slate-300" />
        <div className="h-2 w-20 rounded bg-slate-200" />
        <div className="flex gap-1">
          <div className="h-1.5 w-10 rounded bg-slate-200" />
          <div className="h-1.5 w-8 rounded bg-slate-200" />
          <div className="h-1.5 w-6 rounded bg-slate-200" />
        </div>
      </div>
      <div className="h-8 w-8 flex-shrink-0 rounded-full border border-slate-200 bg-slate-300" />
    </div>
    <div className="mt-4 space-y-2">
      <div className="h-2 w-16 rounded bg-slate-300" />
      <div className="h-2 w-full rounded bg-slate-200" />
      <div className="h-2 w-5/6 rounded bg-slate-200" />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="h-6 rounded bg-slate-100" />
      <div className="h-6 rounded bg-slate-100" />
    </div>
  </div>
);

const ModernThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 bg-white p-3">
    {/* Live header: name + headline over a slate rule — no accent band */}
    <div className="space-y-1.5 border-b border-slate-200 pb-2">
      <div className="h-3 w-20 rounded bg-slate-800" />
      <div className="h-1.5 w-14 rounded bg-slate-300" />
    </div>
    {/* 2fr/1fr body: bordered experience card left, education + pills right */}
    <div className="mt-2 grid grid-cols-[2fr_1fr] gap-2">
      <div className="space-y-1.5">
        <div className="h-1.5 w-10 rounded bg-slate-400" />
        <div className="space-y-1 rounded-md border border-slate-200 p-1.5">
          <div className="h-1.5 w-full rounded bg-slate-200" />
          <div className="h-1.5 w-5/6 rounded bg-slate-200" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-1.5 w-8 rounded bg-slate-400" />
        <div className="flex flex-wrap gap-1">
          <div className="h-2 w-6 rounded-full bg-slate-100" />
          <div className="h-2 w-8 rounded-full bg-slate-100" />
          <div className="h-2 w-5 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  </div>
);

const ExecutiveThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 overflow-hidden flex">
    <div className="w-10 bg-[#1E2A4A] p-1.5 flex flex-col gap-1.5 flex-shrink-0">
      <div className="h-2 w-full rounded bg-white/30" />
      <div className="h-1.5 w-4/5 rounded bg-white/20" />
      <div className="mt-1 h-1 w-full rounded bg-white/15" />
      <div className="h-1 w-4/5 rounded bg-white/15" />
      <div className="h-1 w-3/5 rounded bg-white/15" />
      <div className="mt-1 h-1 w-full rounded bg-white/15" />
      <div className="h-1 w-4/5 rounded bg-white/15" />
    </div>
    <div className="flex-1 p-2 space-y-2 bg-gradient-to-br from-slate-50 to-white">
      <div className="h-1.5 w-12 rounded bg-[#1E2A4A]/40" />
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-5/6 rounded bg-slate-200" />
      <div className="mt-1.5 h-1.5 w-14 rounded bg-[#1E2A4A]/40" />
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-4/5 rounded bg-slate-200" />
    </div>
  </div>
);

const ATSCleanThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 bg-white p-3">
    {/* Header block */}
    <div className="space-y-1 mb-2">
      <div className="h-2.5 w-20 rounded bg-slate-800" />
      <div className="h-1.5 w-16 rounded bg-slate-400" />
      <div className="h-1 w-full rounded bg-slate-200" />
    </div>
    {/* Divider */}
    <div className="h-px w-full bg-slate-800 mb-2" />
    {/* Section heading */}
    <div className="h-1.5 w-14 rounded bg-slate-700 mb-1.5" />
    {/* Content lines */}
    <div className="space-y-1">
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-5/6 rounded bg-slate-200" />
      <div className="h-1 w-4/6 rounded bg-slate-200" />
    </div>
  </div>
);

const GulfStandardThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 bg-white p-3">
    {/* Header: name block left, passport-ratio photo top-right */}
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 space-y-1 pt-0.5">
        <div className="h-2.5 w-20 rounded bg-slate-800" />
        <div className="h-1.5 w-14 rounded bg-[#1E3A5F]" />
        <div className="h-1 w-full rounded bg-slate-200" />
      </div>
      <div className="h-9 w-7 flex-shrink-0 border border-slate-400 bg-slate-300" />
    </div>
    {/* Personal Details: accent heading on a rule, two-column label/value rows */}
    <div className="mt-2 h-1.5 w-14 rounded bg-[#1E3A5F]" />
    <div className="mt-1 h-px w-full bg-[#1E3A5F]" />
    <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
      <div className="flex gap-1">
        <div className="h-1 w-5 rounded bg-slate-500" />
        <div className="h-1 flex-1 rounded bg-slate-200" />
      </div>
      <div className="flex gap-1">
        <div className="h-1 w-5 rounded bg-slate-500" />
        <div className="h-1 flex-1 rounded bg-slate-200" />
      </div>
      <div className="flex gap-1">
        <div className="h-1 w-5 rounded bg-slate-500" />
        <div className="h-1 flex-1 rounded bg-slate-200" />
      </div>
      <div className="flex gap-1">
        <div className="h-1 w-5 rounded bg-slate-500" />
        <div className="h-1 flex-1 rounded bg-slate-200" />
      </div>
    </div>
    {/* Profile */}
    <div className="mt-2 h-1.5 w-10 rounded bg-[#1E3A5F]" />
    <div className="mt-1 h-px w-full bg-[#1E3A5F]" />
    <div className="mt-1.5 space-y-1">
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-5/6 rounded bg-slate-200" />
    </div>
  </div>
);

const ExecSplitThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
    {/* Dark header */}
    <div className="bg-[#1B2A4A] p-2 flex-shrink-0">
      <div className="h-2 w-20 rounded bg-white/40" />
      <div className="h-1.5 w-14 rounded bg-white/20 mt-1" />
      <div className="h-1 w-full rounded bg-white/10 mt-1" />
    </div>
    {/* Two-column body */}
    <div className="flex flex-1 p-1.5 gap-1.5 bg-white">
      <div className="flex-1 space-y-1.5">
        <div className="h-1 w-10 rounded bg-[#1B2A4A]/40" />
        <div className="h-1 w-full rounded bg-slate-200" />
        <div className="h-1 w-5/6 rounded bg-slate-200" />
        <div className="h-1 w-8 rounded bg-[#1B2A4A]/40 mt-1" />
        <div className="h-1 w-full rounded bg-slate-200" />
      </div>
      <div className="w-8 flex-shrink-0 space-y-1.5">
        <div className="h-1 w-full rounded bg-slate-300" />
        <div className="h-1 w-4/5 rounded bg-slate-200" />
        <div className="h-1 w-full rounded bg-slate-200" />
      </div>
    </div>
  </div>
);

const CorpSidebarThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 overflow-hidden flex">
    {/* Light left content */}
    <div className="flex-1 p-2 space-y-1.5 bg-white">
      <div className="h-2 w-16 rounded bg-slate-800" />
      <div className="h-1 w-10 rounded bg-slate-400" />
      <div className="h-px w-full bg-slate-800 mt-1" />
      <div className="h-1 w-full rounded bg-slate-200 mt-1" />
      <div className="h-1 w-5/6 rounded bg-slate-200" />
      <div className="h-1 w-12 rounded bg-slate-400 mt-1" />
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-4/5 rounded bg-slate-200" />
    </div>
    {/* Dark right sidebar */}
    <div className="w-12 bg-[#0F172A] p-1.5 flex flex-col gap-1.5 flex-shrink-0">
      <div className="h-1 w-full rounded bg-white/20" />
      <div className="h-1 w-4/5 rounded bg-white/15" />
      <div className="h-1 w-full rounded bg-white/15" />
      <div className="mt-1 h-1 w-full rounded bg-white/20" />
      <div className="h-1 w-3/5 rounded bg-white/15" />
      <div className="mt-1 h-1 w-full rounded bg-white/20" />
      <div className="h-1 w-4/5 rounded bg-white/15" />
    </div>
  </div>
);

const OnyxThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 overflow-hidden flex">
    <div className="w-14 flex-shrink-0 bg-[#262626] p-1.5 flex flex-col items-center gap-1.5">
      <div className="h-6 w-6 rounded-full bg-white/25" />
      <div className="h-1 w-10 rounded bg-white/30" />
      <div className="mt-1 h-1 w-full rounded bg-white/15" />
      <div className="h-1 w-4/5 rounded bg-white/15" />
      <div className="h-1 w-full rounded bg-white/15" />
    </div>
    <div className="flex-1 space-y-1.5 bg-white p-2">
      <div className="h-1.5 w-14 rounded bg-slate-700" />
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-5/6 rounded bg-slate-200" />
      <div className="mt-1 h-1.5 w-12 rounded bg-slate-700" />
      <div className="h-1 w-full rounded bg-slate-200" />
    </div>
  </div>
);

const SandstoneThumb = () => (
  <div className="flex h-32 overflow-hidden rounded-xl border border-slate-200">
    <div className="flex w-16 flex-shrink-0 flex-col items-center gap-1.5 bg-[#ECE3D2] p-1.5">
      <div className="h-6 w-6 rounded-full bg-black/15" />
      <div className="h-1 w-10 rounded bg-stone-500/60" />
      <div className="mt-1 h-1 w-full rounded bg-stone-400/50" />
      <div className="h-1 w-4/5 rounded bg-stone-400/50" />
      <div className="h-1 w-full rounded bg-stone-400/50" />
    </div>
    <div className="flex-1 space-y-1.5 bg-white p-2">
      <div className="h-1.5 w-14 rounded bg-stone-700" />
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-5/6 rounded bg-slate-200" />
      <div className="mt-1 h-1.5 w-12 rounded bg-stone-700" />
      <div className="h-1 w-full rounded bg-slate-200" />
    </div>
  </div>
);

const BannerThumb = () => (
  <div className="flex h-32 flex-col overflow-hidden rounded-xl border border-slate-200">
    {/* Accent band: square portrait left, name block right */}
    <div className="flex flex-shrink-0 items-center gap-2 bg-[#1e5b54] p-2">
      <div className="h-9 w-7 flex-shrink-0 rounded-sm border border-white/40 bg-white/25" />
      <div className="flex-1 space-y-1">
        <div className="h-2 w-20 rounded bg-white/80" />
        <div className="h-1.5 w-14 rounded bg-white/40" />
        <div className="h-1 w-full rounded bg-white/25" />
      </div>
    </div>
    {/* Essentials strip */}
    <div className="flex h-2.5 flex-shrink-0 items-center gap-1 bg-[#1e5b54]/10 px-2">
      <div className="h-1 w-8 rounded bg-[#1e5b54]/50" />
      <div className="h-1 w-10 rounded bg-[#1e5b54]/35" />
    </div>
    {/* Single-column body with ruled headings */}
    <div className="flex-1 space-y-1.5 bg-white p-2">
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-10 rounded bg-[#1e5b54]" />
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-5/6 rounded bg-slate-200" />
      <div className="flex items-center gap-1 pt-0.5">
        <div className="h-1.5 w-8 rounded bg-[#1e5b54]" />
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="h-1 w-full rounded bg-slate-200" />
    </div>
  </div>
);

const ProfessionalThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex flex-col items-center gap-1">
      <div className="h-3 w-24 rounded bg-slate-800" />
      <div className="h-1.5 w-32 rounded bg-slate-300" />
      <div className="h-1 w-20 rounded bg-slate-200" />
    </div>
    <div className="mt-3 h-px w-full bg-slate-300" />
    <div className="mt-2 space-y-1">
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="mx-auto h-1 w-5/6 rounded bg-slate-200" />
    </div>
    <div className="mt-2 h-px w-full bg-slate-300" />
    <div className="mt-2 space-y-1">
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="h-1 w-4/6 rounded bg-slate-200" />
    </div>
  </div>
);

const ProfessionalPhotoThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex flex-col items-center gap-1">
      <div className="h-8 w-8 rounded-full bg-slate-300" />
      <div className="h-2.5 w-24 rounded bg-slate-800" />
      <div className="h-1.5 w-28 rounded bg-slate-300" />
    </div>
    <div className="mt-2 h-px w-full bg-slate-300" />
    <div className="mt-2 space-y-1">
      <div className="h-1 w-full rounded bg-slate-200" />
      <div className="mx-auto h-1 w-5/6 rounded bg-slate-200" />
      <div className="h-1 w-4/6 rounded bg-slate-200" />
    </div>
  </div>
);

export const templates: TemplateDefinition[] = [
  /* Badges are an honest ATS-safety signal (audit UI-10): single-column
     text-first layouts get the green "ATS-Friendly" badge; sidebar/two-column
     structures get a quiet "Design-led" badge because older ATS parsers can
     interleave their columns — fine for direct email, riskier for online
     application portals. Exactly ONE template ("Classic", the default) also
     carries "Recommended" to anchor the indecisive majority.

     The badge speaks to COLUMN STRUCTURE, not to the photo (template audit
     2026-10 defect 26): an in-flow photo does not change reading order, and
     ATS Clean / Gulf Standard / Banner already show one while keeping the
     badge, so Professional Photo carries ATS-Friendly like Professional. The
     "New" ribbon is additive — the picker shows one badge by priority, so New
     never displaces the structural badge. */
  {
    id: "classic",
    name: "Classic",
    description: "Clean single-column layout for traditional roles.",
    badges: [
      { label: "Recommended", tone: "recommended" },
      { label: "ATS-Friendly", tone: "ats" },
    ],
    Thumbnail: ClassicThumb,
    Render: ClassicTemplate,
  },
  {
    id: "modern",
    name: "Modern",
    // Has a 2fr/1fr two-column body (the grid in modern.tsx) — NOT
    // ATS-Friendly-badged, whatever earlier notes claimed. The template draws
    // no accent element: slate headings, emerald essentials chips, slate pills.
    description:
      "Two-column layout: experience cards on the left, education and skill pills on the right.",
    badges: [{ label: "Design-led", tone: "neutral" }],
    Thumbnail: ModernThumb,
    Render: ModernTemplate,
  },
  {
    id: "executive",
    name: "Executive",
    description:
      "Left sidebar with stacked name, contact and skills; two-column. For senior profiles sent straight to a hiring manager.",
    badges: [{ label: "Design-led", tone: "neutral" }],
    Thumbnail: ExecutiveThumb,
    Render: ExecutiveTemplate,
  },
  {
    id: "ats-clean",
    name: "ATS Clean",
    description:
      "Single-column, text-first layout built for applicant tracking systems.",
    badges: [{ label: "ATS-Friendly", tone: "ats" }],
    Thumbnail: ATSCleanThumb,
    Render: ATSCleanTemplate,
  },
  {
    id: "gulf-standard",
    name: "Gulf Standard",
    // Single column, every detail a flex row, DOM order = reading order, so
    // the ATS badge is honest (template audit 2026-10, shortlist item 1).
    description:
      "The UAE format: labelled personal details, passport photo, single column.",
    badges: [
      { label: "New", tone: "new" },
      { label: "ATS-Friendly", tone: "ats" },
    ],
    Thumbnail: GulfStandardThumb,
    Render: GulfStandardTemplate,
  },
  {
    id: "exec-split",
    name: "Executive Split",
    description: "Dark header with two-column body for senior professionals.",
    badges: [{ label: "Design-led", tone: "neutral" }],
    Thumbnail: ExecSplitThumb,
    Render: ExecSplitTemplate,
  },
  {
    id: "corp-sidebar",
    name: "Corporate",
    description:
      "Right-hand sidebar carries contact, visa and skills; the main column stays plain. Best emailed direct to a recruiter.",
    badges: [{ label: "Design-led", tone: "neutral" }],
    Thumbnail: CorpSidebarThumb,
    Render: CorpSidebarTemplate,
  },
  {
    id: "onyx",
    name: "Onyx",
    description:
      "Charcoal sidebar with a bold profile photo — modern and confident.",
    badges: [
      { label: "New", tone: "new" },
      { label: "Design-led", tone: "neutral" },
    ],
    Thumbnail: OnyxThumb,
    Render: OnyxTemplate,
  },
  {
    id: "sandstone",
    name: "Sandstone",
    description:
      "Warm sidebar with a UAE personal-details panel and profile photo.",
    badges: [
      { label: "New", tone: "new" },
      { label: "Design-led", tone: "neutral" },
    ],
    Thumbnail: SandstoneThumb,
    Render: SandstoneTemplate,
  },
  {
    id: "banner",
    name: "Banner",
    // Full-width accent band over a pure single-column body: the one
    // photo-forward layout whose body parses linearly (template audit 2026-10,
    // shortlist item 2), hence the ATS badge alongside "New".
    description: "Accent header band with a photo over a single-column body.",
    badges: [
      { label: "New", tone: "new" },
      { label: "ATS-Friendly", tone: "ats" },
    ],
    Thumbnail: BannerThumb,
    Render: BannerTemplate,
  },
  {
    id: "professional",
    name: "Professional",
    description:
      "Centered name, headline and contacts over full-width ruled sections. Conservative and recruiter-safe.",
    badges: [{ label: "ATS-Friendly", tone: "ats" }],
    Thumbnail: ProfessionalThumb,
    Render: ProfessionalTemplate,
  },
  {
    id: "professional-photo",
    name: "Professional Photo",
    description:
      "The Professional layout with a profile photo — polished and recruiter-ready.",
    badges: [
      { label: "New", tone: "new" },
      { label: "ATS-Friendly", tone: "ats" },
    ],
    Thumbnail: ProfessionalPhotoThumb,
    Render: ProfessionalPhotoTemplate,
  },
];

export const getTemplateById = (id: string) =>
  templates.find((template) => template.id === id) ?? templates[0];
