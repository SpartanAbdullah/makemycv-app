"use client";

import { splitPlaceholders } from "../../lib/ai/placeholders";

/**
 * Renders AI-written text with every unresolved placeholder ({{number}},
 * [X]) highlighted, so the user sees exactly where a real figure is still
 * needed before the text can be inserted (audit F31 / WP-4).
 */
export const PlaceholderText = ({ text }: { text: string }) => (
  <>
    {splitPlaceholders(text).map((part, i) =>
      part.placeholder ? (
        <mark
          key={i}
          style={{
            background: "var(--ff-warn-soft)",
            color: "var(--ff-warn)",
            borderRadius: 4,
            padding: "0 4px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85em",
            fontWeight: 600,
          }}
        >
          {part.text}
        </mark>
      ) : (
        <span key={i}>{part.text}</span>
      ),
    )}
  </>
);

/** The one-line explanation shown wherever a placeholder blocks insertion. */
export const PLACEHOLDER_HINT =
  "Replace {{number}} with your real figure — AI suggestions never invent numbers.";
