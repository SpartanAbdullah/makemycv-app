// RTL detection: Arabic (U+0600-U+06FF, U+0750-U+077F, U+08A0-U+08FF) and Hebrew (U+0590-U+05FF)
const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export const containsRtl = (text: string): boolean => RTL_RE.test(text);

export const getDir = (text: string): "ltr" | "rtl" =>
  containsRtl(text) ? "rtl" : "ltr";
