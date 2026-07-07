"use client";

/**
 * ModalCloseButton — the one shared close affordance for light-surface
 * dialogs (2026-06 audit: close buttons had four different fills,
 * glyphs, and icon sizes across the modal set).
 *
 * Standardises VISUALS only: a 32px transparent circle with a single
 * 16px X (strokeWidth 2.4, round caps), slate-400 at rest, slate-600 on
 * a slate-100 hover circle. Placement is deliberately NOT baked in —
 * each modal positions it via className/style (absolute inset, static
 * flex item, wrapper overlay…), so the component stays a pure visual
 * primitive.
 *
 * Dark-toolbar surfaces (e.g. TemplatePreviewModal) are out of scope —
 * this gray-on-white treatment would vanish there.
 */

type Props = {
  onClick: () => void;
  /** Defaults to "Close"; override where the action is more specific
      (e.g. "Cancel import"). */
  "aria-label"?: string;
  /** Placement/layout classes from the caller (e.g. "absolute right-3
      top-3" or "ml-4 flex-shrink-0"). */
  className?: string;
  /** Inline placement for inline-style-authored modals. */
  style?: React.CSSProperties;
  /** React 19 ref-as-prop — lets hosts focus the button on mount
      (focus-trap entry point). */
  ref?: React.Ref<HTMLButtonElement>;
};

export const ModalCloseButton = ({
  onClick,
  "aria-label": ariaLabel = "Close",
  className,
  style,
  ref,
}: Props) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className={`flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 ${className ?? ""}`}
    style={style}
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
);

export default ModalCloseButton;
