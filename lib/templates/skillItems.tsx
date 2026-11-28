import type { CSSProperties, ReactNode } from "react";
import { skillListDirection } from "../utils/skills";

/**
 * A skills list printed as separate items (backlog F3, user feedback
 * 2026-11-26: "skills look like one continuous sentence").
 *
 * The inline templates used to print `names.join(" · ")` as one paragraph, so
 * a two-word skill could break across lines ("Cross-" / "cultural
 * Communication") and the small separator read like punctuation. Here each
 * skill is one flex item that only wraps as a whole, and the separator sits
 * in its own lighter colour with half an em of space on each side.
 *
 * ATS: still real text in reading order, with a separator character between
 * the names. The PDF twin is `PdfSkillItems` in components/pdf/CVDocument.tsx
 * and must draw the same items, separator and spacing.
 *
 * Direction: the whole list flows in the direction its joined text used to
 * have (`skillListDirection`); each name is isolated so it keeps its own.
 * The item sets `unicode-bidi: isolate` inline because `.cv-bidi` gives flex
 * children `plaintext`, which would let a lone Arabic name flip its own
 * separator to the wrong side.
 */
export const SkillItems = ({
  names,
  separator,
  separatorColor,
  style,
  lead,
}: {
  names: string[];
  /** The template's own list separator: "·", "|" or "•". */
  separator: string;
  separatorColor: string;
  /** Text style of the list (font size, line height, colour). */
  style: CSSProperties;
  /** Optional run before the first item, e.g. Harvard's bold "Skills:". */
  lead?: ReactNode;
}) => {
  if (names.length === 0) return null;
  const rtl = skillListDirection(names) === "rtl";
  const gap = "0.5em";
  return (
    <div
      dir={rtl ? "rtl" : undefined}
      style={{ ...style, display: "flex", flexWrap: "wrap", columnGap: gap, margin: 0 }}
    >
      {lead}
      {names.map((name, i) => (
        <span key={`${i}-${name}`} style={{ unicodeBidi: "isolate" }}>
          <bdi>{name}</bdi>
          {i < names.length - 1 ? (
            <span style={{ color: separatorColor, marginInlineStart: gap }}>{separator}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
};
