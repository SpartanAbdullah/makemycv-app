const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const normalizeDatePart = (value?: string) => {
  const raw = value?.trim();
  if (!raw) return "";

  const yearOnly = raw.match(/^\d{4}$/);
  if (yearOnly) return raw;

  const yearMonth = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonth) {
    const [, year, month] = yearMonth;
    const monthIndex = Number(month) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${MONTHS[monthIndex]} ${year}`;
    }
  }

  const monthYear = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthYear) {
    const [, month, year] = monthYear;
    const monthIndex = Number(month) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${MONTHS[monthIndex]} ${year}`;
    }
  }

  const namedMonth = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (namedMonth) {
    const [, monthName, year] = namedMonth;
    const monthIndex = MONTHS.findIndex(
      (month) => month.toLowerCase() === monthName.slice(0, 3).toLowerCase()
    );
    if (monthIndex >= 0) {
      return `${MONTHS[monthIndex]} ${year}`;
    }
  }

  return raw;
};

export const formatDateRange = (
  start?: string,
  end?: string,
  isCurrent?: boolean
) => {
  const safeStart = normalizeDatePart(start);
  const safeEnd = normalizeDatePart(end);
  if (!safeStart && !safeEnd) return "";
  if (isCurrent) return `${safeStart || ""} – Present`.trim();
  if (safeStart && safeEnd) return `${safeStart} – ${safeEnd}`;
  return safeStart || safeEnd || "";
};

export const compactContact = (items: Array<string | undefined | null>) =>
  items
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .join(" • ");
