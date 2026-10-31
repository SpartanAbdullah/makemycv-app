import type { CSSProperties } from "react";
import type { CvData } from "../types/cv";
import { firstStrongDirection } from "../pdf/arabicText";

export const getFullName = (data: CvData) =>
  `${data.personal.firstName} ${data.personal.lastName}`.trim();


/**
 * Props for a bullet <li> (session 6, E8.2 follow-up). An Arabic-first bullet
 * aligns right (`unicode-bidi: plaintext`, app/globals.css), so its marker
 * must sit on the right, right before the text in reading order: `dir="rtl"`
 * puts the outside marker on the right, and the list's left padding `pad`
 * is mirrored onto the right (margin -pad / +pad) so the marker keeps the
 * same distance from the edge and from its text as an LTR marker, and the
 * text keeps its width. The PDF does the same (components/pdf/CVDocument.tsx
 * `bulletRowDir`). Latin bullets get their style back untouched.
 */
export function bulletLiProps(
  text: string,
  pad: string | number | undefined,
  style?: CSSProperties,
): { dir?: "rtl"; style?: CSSProperties } {
  if (firstStrongDirection(text) !== "rtl") return style ? { style } : {};
  const p = typeof pad === "number" ? `${pad}px` : pad || "1rem";
  return { dir: "rtl", style: { ...style, marginLeft: `calc(-1 * ${p})`, marginRight: p } };
}
