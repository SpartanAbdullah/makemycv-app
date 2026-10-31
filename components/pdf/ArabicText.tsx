/**
 * Arabic-aware `Text` / `Link` for the PDF layouts (session 4, 2026-10-31;
 * multi-run and paragraph direction session 6).
 *
 * `components/pdf/CVDocument.tsx` imports these instead of react-pdf's own,
 * so every one of its ~300 text runs — in all 14 layouts — gets the same
 * treatment without touching the layouts:
 *
 *   - Latin-only text is returned as the untouched react-pdf element, so the
 *     fidelity baseline (scripts/pdf-fidelity-baseline.json) cannot move.
 *   - Text that contains Arabic is (1) shaped into presentation forms
 *     (lib/pdf/arabicText.ts — the fix for textkit's ligature and mark
 *     defects), all runs of the line together so letters join across a run
 *     boundary; (2) set in the Arabic family with letter-spacing removed
 *     (tracking pulls cursive letters apart); (3) given an RTL base and right
 *     alignment when its first strong character is Arabic (E8.2).
 *   - Nested <Text> / <Link> children stay their own runs (E8.5): a bold role
 *     next to a regular company keeps both weights, and a link keeps its
 *     hyperlink. Session 4 had to flatten them into one run because textkit's
 *     bidi reorder drew glyphs with a neighbouring run's font; the textkit
 *     patch (scripts/patch-react-pdf-textkit.mjs) keeps every glyph in its
 *     own run, which makes this safe. A child of any other element type falls
 *     back to the flattened single run.
 *
 * Known, accepted limit (docs/arabic-pdf.md): Latin words inside an
 * Arabic-bearing line are set in Vazirmatn's Latin rather than Inter /
 * Bricolage / Instrument Serif.
 */
import { isValidElement, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import {
  Link as PdfLink,
  Text as PdfText,
  type LinkProps as PdfLinkProps,
  type TextProps as PdfTextProps,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { containsArabic, firstStrongDirection, shapeArabicSegments } from "../../lib/pdf/arabicText";
import { pdfArabicFamily } from "../../lib/pdf/fonts";

type TextProps = PropsWithChildren<PdfTextProps>;
type LinkProps = PropsWithChildren<PdfLinkProps>;
type StyleProp = Style | Style[] | undefined;
type RunProps = { children?: ReactNode; style?: StyleProp };

/** Plain text of a react-pdf children tree (strings, numbers, nested runs). */
export function textOfChildren(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOfChildren).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOfChildren(node.props.children);
  return "";
}

const asArray = (style: StyleProp): Style[] => (Array.isArray(style) ? style : style ? [style] : []);

/* The run types a line may nest; resolved lazily because Text / Link below are those types. */
const isTextRun = (el: ReactElement): boolean => el.type === Text || el.type === PdfText;
const isLinkRun = (el: ReactElement): boolean => el.type === Link || el.type === PdfLink;

/** Leaf strings of the children tree in order; null when it nests anything but Text / Link runs. */
function leavesOf(node: ReactNode, out: string[]): boolean {
  if (node === null || node === undefined || typeof node === "boolean") return true;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return true;
  }
  if (Array.isArray(node)) return node.every((n) => leavesOf(n, out));
  if (isValidElement<RunProps>(node) && (isTextRun(node) || isLinkRun(node))) return leavesOf(node.props.children, out);
  return false;
}

/** Rebuild the tree with shaped leaves; nested runs become react-pdf runs in the Arabic family. */
function rebuild(node: ReactNode, shaped: string[], cursor: { i: number }, runStyle: Style, key?: string): ReactNode {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") {
    const s = shaped[cursor.i];
    cursor.i += 1;
    return s;
  }
  if (Array.isArray(node)) return node.map((n, k) => rebuild(n, shaped, cursor, runStyle, `r${k}`));
  if (!isValidElement<RunProps & Record<string, unknown>>(node)) return null;
  const { children, style, ...rest } = node.props;
  const inner = rebuild(children, shaped, cursor, runStyle);
  const childStyle = [...asArray(style), runStyle];
  return isLinkRun(node) ? (
    <PdfLink key={key} {...(rest as PdfLinkProps)} style={childStyle}>
      {inner}
    </PdfLink>
  ) : (
    <PdfText key={key} {...(rest as PdfTextProps)} style={childStyle}>
      {inner}
    </PdfText>
  );
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
): { children: ReactNode; style: Style[] } | null {
  if (hasRender) return null;
  const family = pdfArabicFamily();
  if (!family) return null;
  const text = textOfChildren(children);
  if (!containsArabic(text)) return null;
  const base = asArray(style);
  // E8.2 (session 6): an Arabic-first paragraph gets an RTL base, as the
  // preview's `unicode-bidi: plaintext` gives it (app/globals.css). textkit
  // then orders a mid-line "(Power BI)" / "12%" correctly, mirrors brackets,
  // and the run aligns right — unless the layout set textAlign (a centred
  // header stays centred, as `text-align: center` does in the preview).
  // The right alignment is set EXPLICITLY: @react-pdf/layout's measure step
  // compensates a shrink-wrapped Text (a contact item in a flex row) only for
  // `style.textAlign`, so the implicit right alignment `direction: "rtl"`
  // implies pushed such a run's glyphs out of its box (the location vanished
  // from Classic's contact row). Latin-first and letterless runs are untouched.
  const rtl = firstStrongDirection(text) === "rtl";
  const hasAlign = base.some((s) => s && s.textAlign !== undefined);
  const runStyle: Style = { fontFamily: family, letterSpacing: 0, ...(rtl ? { direction: "rtl" } : {}) };
  const paragraphStyle: Style = { ...runStyle, ...(rtl && !hasAlign ? { textAlign: "right" } : {}) };
  const leaves: string[] = [];
  const nestedOnlyRuns = leavesOf(children, leaves);
  const shaped = shapeArabicSegments(nestedOnlyRuns ? leaves : [text]);
  return {
    children: nestedOnlyRuns ? rebuild(children, shaped, { i: 0 }, runStyle) : shaped[0],
    style: [...base, paragraphStyle],
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
      {run.children}
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
      {run.children}
    </PdfLink>
  );
};
