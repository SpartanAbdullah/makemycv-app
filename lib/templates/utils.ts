import type { CvData } from "../types/cv";

export const formatRange = (start?: string, end?: string, current?: boolean) => {
  if (!start && !end) return "";
  if (current) return `${start || ""} - Present`;
  if (start && end) return `${start} - ${end}`;
  return start || end || "";
};

export const getFullName = (data: CvData) =>
  `${data.personal.firstName} ${data.personal.lastName}`.trim();

