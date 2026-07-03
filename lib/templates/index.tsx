import type React from "react";
import type { CvData, PlanTier } from "../types/cv";
import { ATSCleanTemplate } from "./ats-clean";
import { ClassicTemplate } from "./classic";
import { CorpSidebarTemplate } from "./corp-sidebar";
import { ExecSplitTemplate } from "./exec-split";
import { ExecutiveTemplate } from "./executive";
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
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-slate-300" />
        <div className="h-2 w-20 rounded bg-slate-200" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-2 w-16 rounded bg-slate-200" />
        <div className="h-2 w-12 rounded bg-slate-200" />
      </div>
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
  <div className="h-32 rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-3">
    <div className="h-4 w-16 rounded bg-emerald-200" />
    <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-slate-200" />
        <div className="h-2 w-5/6 rounded bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-emerald-100" />
        <div className="h-2 w-4/6 rounded bg-emerald-100" />
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
     carries "Recommended" to anchor the indecisive majority. */
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
    // Has a 2fr/1fr two-column body (modern.tsx:154) — NOT ATS-Friendly-badged,
    // whatever earlier notes claimed. Verified against the template source.
    description: "Two-column layout with a refined accent section.",
    badges: [{ label: "Design-led", tone: "neutral" }],
    Thumbnail: ModernThumb,
    Render: ModernTemplate,
  },
  {
    id: "executive",
    name: "Executive",
    description:
      "Navy sidebar, two-column. Best for direct email to a recruiter.",
    badges: [{ label: "Design-led", tone: "neutral" }],
    Thumbnail: ExecutiveThumb,
    Render: ExecutiveTemplate,
  },
  {
    id: "ats-clean",
    name: "ATS Clean",
    description: "Single-column layout engineered for maximum ATS pass rate.",
    badges: [{ label: "ATS-Friendly", tone: "ats" }],
    Thumbnail: ATSCleanThumb,
    Render: ATSCleanTemplate,
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
      "Right dark sidebar. Best for direct email to a recruiter.",
    badges: [{ label: "Design-led", tone: "neutral" }],
    Thumbnail: CorpSidebarThumb,
    Render: CorpSidebarTemplate,
  },
  {
    id: "onyx",
    name: "Onyx",
    description:
      "Charcoal sidebar with a bold profile photo — modern and confident.",
    badges: [{ label: "New", tone: "new" }],
    Thumbnail: OnyxThumb,
    Render: OnyxTemplate,
  },
  {
    id: "sandstone",
    name: "Sandstone",
    description:
      "Warm sidebar with a UAE personal-details panel and profile photo.",
    badges: [{ label: "New", tone: "new" }],
    Thumbnail: SandstoneThumb,
    Render: SandstoneTemplate,
  },
  {
    id: "professional",
    name: "Professional",
    description:
      "Centered single-column with a clean headline strip. ATS-friendly.",
    badges: [{ label: "ATS-Friendly", tone: "ats" }],
    Thumbnail: ProfessionalThumb,
    Render: ProfessionalTemplate,
  },
  {
    id: "professional-photo",
    name: "Professional Photo",
    description:
      "The Professional layout with a profile photo — polished and recruiter-ready.",
    badges: [{ label: "New", tone: "new" }],
    Thumbnail: ProfessionalPhotoThumb,
    Render: ProfessionalPhotoTemplate,
  },
];

export const getTemplateById = (id: string) =>
  templates.find((template) => template.id === id) ?? templates[0];
