import type { CvData } from "../types/cv";

export const getFullName = (data: CvData) =>
  `${data.personal.firstName} ${data.personal.lastName}`.trim();

