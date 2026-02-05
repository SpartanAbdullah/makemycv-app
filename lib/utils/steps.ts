export type BuilderStep = {
  id:
    | "personal"
    | "summary"
    | "experience"
    | "education"
    | "skills"
    | "languages"
    | "certifications"
    | "projects"
    | "review";
  title: string;
  required?: boolean;
  atsTip: string;
};

export const builderSteps: BuilderStep[] = [
  {
    id: "personal",
    title: "Personal Info",
    required: true,
    atsTip: "Match the name and email you use on applications.",
  },
  {
    id: "summary",
    title: "Professional Summary",
    atsTip: "Use 2-3 lines that align with the job posting keywords.",
  },
  {
    id: "experience",
    title: "Work Experience",
    required: true,
    atsTip: "Start bullets with strong verbs and add measurable results.",
  },
  {
    id: "education",
    title: "Education",
    required: true,
    atsTip: "List the most recent degree first with dates.",
  },
  {
    id: "skills",
    title: "Skills",
    required: true,
    atsTip: "Mirror the skills listed in the job description.",
  },
  {
    id: "languages",
    title: "Languages",
    atsTip: "Include proficiency levels for clarity.",
  },
  {
    id: "certifications",
    title: "Certifications",
    atsTip: "Add only recent or relevant certifications.",
  },
  {
    id: "projects",
    title: "Projects",
    atsTip: "Highlight tools and outcomes, not just tasks.",
  },
  {
    id: "review",
    title: "Review",
    atsTip: "Aim for a balanced, one-page structure.",
  },
];

export const totalSteps = builderSteps.length;
