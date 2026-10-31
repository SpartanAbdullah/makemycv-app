/**
 * Arabic-aware `Text` / `Link` for the PDF layouts (session 4, 2026-10-31).
 *
 * `components/pdf/CVDocument.tsx` imports these instead of react-pdf's own,
 * so every one of its ~300 text runs — in all 14 layouts — gets the same
 * treatment without touching the layouts:
 *
 *   - Latin-only text is returned as the untouched react-pdf element, so the
 *     fidelity baseline (scripts/pdf-fidelity-baseline.json) cannot move.
 *   - Text that contains Arabic is (1) flattened to ONE string — nested
 *     <Text>/<Link> children become plain text, because a second run on the
 *     line (another weight, a link) is what textkit's bidi reorder corrupts;
 *     (2) shaped into presentation forms (lib/pdf/arabicText.ts — the fix for
 *     textkit's ligature and mark defects); (3) set in the Arabic family
 *     with letter-spacing removed (tracking pulls cursive letters apart).
 *     The run's size, weight, colour and line box come through unchanged.
 *
 * Known, accepted limits of the single-run rule, listed in docs/arabic-pdf.md:
 * inside an Arabic-bearing run a bold label loses its weight, a link loses
 * its hyperlink (the text stays), and Latin words are set in Vazirmatn's
 * Latin rather than Inter / Bricolage / Instrument Serif.
 */
import { isValidElement, type PropsWithChildren, type ReactNode } from "react";
import {
  Link as PdfLink,
  Text as PdfText,
  type LinkProps as PdfLinkProps,
  type TextProps as PdfTextProps,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { containsArabic, shapeArabic } from "../../lib/pdf/arabicText";
import { pdfArabicFamily } from "../../lib/pdf/fonts";

type TextProps = PropsWithChildren<PdfTextProps>;
type LinkProps = PropsWithChildren<PdfLinkProps>;
type StyleProp = Style | Style[] | undefined;

/** Plain text of a react-pdf children tree (strings, numbers, nested runs). */
export function textOfChildren(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOfChildren).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOfChildren(node.props.children);
  return "";
}

/**
 * The Arabic override, or null when this run needs none: no Arabic in it,
 * no Arabic family registered (Helvetica fallback — nothing we can do), or a
 * `render` callback (its output is not a children tree).
 */
function arabicRun(
  children: ReactNode,
  style: StyleProp,
  hasRender: boolean,
): { text: string; style: Style[] } | null {
  if (hasRender) return null;
  const family = pdfArabicFamily();
  if (!family) return null;
  const text = textOfChildren(children);
  if (!containsArabic(text)) return null;
  const base = Array.isArray(style) ? style : style ? [style] : [];
  return {
    text: shapeArabic(text),
    style: [...base, { fontFamily: family, letterSpacing: 0 }],
  };
}

export const Text = (props: TextProps) => {
  const run = arabicRun(props.children, props.style as StyleProp, typeof props.render === "function");
  if (!run) return <PdfText {...props} />;
  const { children: _children, style: _style, ...rest } = props;
  void _children;
  void _style;
  return (
    <PdfText {...rest} style={run.style}>
      {run.text}
    </PdfText>
  );
};

export const Link = (props: LinkProps) => {
  const run = arabicRun(props.children, props.style as StyleProp, false);
  if (!run) return <PdfLink {...props} />;
  const { children: _children, style: _style, ...rest } = props;
  void _children;
  void _style;
  return (
    <PdfLink {...rest} style={run.style}>
      {run.text}
    </PdfLink>
  );
};
