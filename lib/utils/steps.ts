export type BuilderStep = {
  id:
    | "personal"
    | "uaeEssentials"
    | "summary"
    | "experience"
    | "education"
    | "skills"
    | "languages"
    | "certifications"
    | "projects"
    | "review";
  title: string;
  /** One plain-English line under the title — written for non-native
   *  speakers: short sentences, no idioms. Rendered by StepHeader. */
  subtitle?: string;
  required?: boolean;
  atsTip: string;
};

export const builderSteps: BuilderStep[] = [
  {
    id: "personal",
    title: "Personal Info",
    subtitle: "Your name and how employers can reach you.",
    required: true,
    atsTip: "Match the name and email you use on applications.",
  },
  {
    id: "uaeEssentials",
    title: "UAE Essentials",
    subtitle:
      "Visa status, notice period, and driving licence let UAE recruiters pre-screen in seconds. All optional, all valuable.",
    atsTip:
      "Visa status and notice period let UAE recruiters pre-screen in seconds.",
  },
  {
    id: "summary",
    title: "Professional Summary",
    subtitle: "Write 2–3 lines about who you are and what you do best.",
    atsTip: "Use 2-3 lines that align with the job posting keywords.",
  },
  {
    id: "experience",
    title: "Work Experience",
    subtitle: "Your work history. Start with your most recent job.",
    required: true,
    atsTip: "Start bullets with strong verbs and add measurable results.",
  },
  {
    id: "education",
    title: "Education",
    subtitle: "Your degrees and where you studied. Most recent first.",
    required: true,
    atsTip: "List the most recent degree first with dates.",
  },
  {
    id: "skills",
    title: "Skills",
    subtitle: "The tools and abilities you want employers to find.",
    required: true,
    atsTip: "Mirror the skills listed in the job description.",
  },
  {
    id: "languages",
    title: "Languages",
    subtitle: "The languages you speak, and how well.",
    atsTip: "Include proficiency levels for clarity.",
  },
  {
    id: "certifications",
    title: "Certifications",
    subtitle: "Courses and certificates that back up your skills.",
    atsTip: "Add only recent or relevant certifications.",
  },
  {
    id: "projects",
    title: "Projects",
    subtitle: "Work you are proud of — side projects count too.",
    atsTip: "Highlight tools and outcomes, not just tasks.",
  },
  {
    id: "review",
    title: "Review",
    atsTip: "Aim for a balanced, one-page structure.",
  },
];

export const totalSteps = builderSteps.length;

/** One counter format everywhere ("Step 06 / 10") — StepBeads' context line
 *  and StepHeader's inline counter previously disagreed ("STEP 06 / 10" vs
 *  "Step 6 of 10") while both were visible at once. */
export const formatStepCounter = (index: number, total: number) =>
  `Step ${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
