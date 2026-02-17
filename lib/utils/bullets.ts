export const MAX_BULLETS = 8;

const LEADING_MARKER_REGEX = /^\s*(?:•|-)\s+/;

export const splitPastedBulletText = (
  value: string,
  limit = MAX_BULLETS,
): string[] => {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  let parts: string[];

  if (normalized.includes("\n")) {
    parts = normalized.split("\n");
  } else if (normalized.includes("•")) {
    parts = normalized.split("•");
  } else if (normalized.includes(";")) {
    parts = normalized.split(";");
  } else {
    parts = [normalized];
  }

  return parts
    .map((part) => part.replace(LEADING_MARKER_REGEX, "").trim())
    .filter(Boolean)
    .slice(0, limit);
};
