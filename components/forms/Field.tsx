import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type FocusEvent,
  type FocusEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { Icon, type IconName } from "../builder/Icon";

/** Read .value defensively — only real form controls have one. */
const readControlValue = (el: unknown): string =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement
    ? el.value
    : "";

export type FieldFeedback = {
  state: "valid" | "invalid" | "neutral";
  /** Helper text shown when state === "invalid" (and no `error` prop). */
  message?: string;
};

type Props = {
  label: string;
  /** Sub-line shown under the input — for ATS hints like "Mirrors the role you want." */
  hint?: string;
  /** Validation error message. Rendered red, supersedes hint visually. */
  error?: string;
  /** Right-aligned score badge in the label row, e.g. "+5". */
  score?: string;
  /** Inline "required" label next to the field name (muted, smaller). */
  required?: boolean;
  /** Inline "· optional" label next to the field name. */
  optional?: boolean;
  /** Left-anchored icon name shown inside the input pill. */
  leftIcon?: IconName;
  /**
   * Blur-time validity feedback (guided-feedback work, 2026-06).
   * "valid" draws a green border + a small check badge inside the input
   * (the glyph carries meaning — not color alone); "invalid" draws a red
   * border, sets aria-invalid, and shows `message` as the helper line.
   * Drive it with useBlurFeedback — never per keystroke.
   */
  feedback?: FieldFeedback;
  /**
   * Decorative "has content" tint (founder request B7, 2026-06): once the
   * field blurs with text in it, the border takes a light green tint.
   * Border-only ON PURPOSE — no check badge: the check glyph is reserved
   * for validity claims (see `feedback`), and this tier makes none.
   * Defaults on for single input/select/textarea children; explicit
   * feedback (valid/invalid) always wins. Pass false to opt out.
   */
  filledTint?: boolean;
  children: ReactNode;
};

/**
 * Form field wrapper used by every builder step. Renders a label row + the
 * input (children) + an optional hint or error. The `leftIcon` option draws
 * an icon overlay inside the input — the consuming step is responsible for
 * adding left padding to make room.
 *
 * The component supports the legacy two-prop signature (label + children) used
 * across older steps; new props are all optional and additive.
 *
 * The label is programmatically associated with the input (audit UI-6):
 * when children is a single element without its own id, we assign a
 * useId()-generated id and point the label's htmlFor at it — tapping the
 * label focuses the input, and screen readers stop announcing every field
 * as unlabeled.
 */
export const Field = ({
  label,
  hint,
  error,
  score,
  required,
  optional,
  leftIcon,
  feedback,
  filledTint = true,
  children,
}: Props) => {
  const fieldId = useId();
  const childArray = Children.toArray(children);
  const single =
    childArray.length === 1 && isValidElement(childArray[0])
      ? (childArray[0] as ReactElement<{
          id?: string;
          className?: string;
          "aria-invalid"?: boolean;
          ref?: Ref<HTMLElement>;
          onBlur?: FocusEventHandler<HTMLElement>;
          onChange?: ChangeEventHandler<HTMLElement>;
        }>)
      : null;
  const assignedId = single && !single.props.id ? fieldId : single?.props.id;

  // ── Decorative "filled" tier (B7) ──
  // Only host form controls participate; composite children (e.g. the
  // City/Emirate div in PersonalStep) keep their behavior untouched.
  const tintEnabled =
    filledTint &&
    single !== null &&
    (single.type === "input" ||
      single.type === "select" ||
      single.type === "textarea");
  const [filled, setFilled] = useState(false);
  const controlRef = useRef<HTMLElement | null>(null);

  // Seed from the DOM whenever the field is NOT focused (runs every render
  // on purpose): localStorage hydration and imports repopulate the form
  // AFTER mount, so a mount-only check missed restored values. The focus
  // guard preserves the blur contract — a field never gains the tint
  // mid-typing; the blur/change wrappers own it while focused.
  useEffect(() => {
    const el = controlRef.current;
    if (!el || document.activeElement === el) return;
    const hasContent = readControlValue(el).trim() !== "";
    if (hasContent !== filled) setFilled(hasContent);
  });

  const showInvalid = Boolean(error) || feedback?.state === "invalid";
  const showValid = !showInvalid && feedback?.state === "valid";
  // Filled is the lowest tier: any explicit validity claim suppresses it.
  const showFilled = tintEnabled && filled && !showInvalid && !showValid;
  const stateClass = showValid
    ? "cv-input-valid"
    : showInvalid && feedback
      ? "cv-input-error"
      : showFilled
        ? "cv-input-filled"
        : "";

  // cloneElement REPLACES the child's ref/handlers, so each wrapper calls
  // the original first (sanitize-on-blur mutates e.target.value before we
  // read it — order matters). React 19: the child's ref lives in props.
  const childRef = single?.props.ref;
  const childOnBlur = single?.props.onBlur;
  const childOnChange = single?.props.onChange;
  const tintProps = tintEnabled
    ? {
        ref: (node: HTMLElement | null) => {
          controlRef.current = node;
          if (typeof childRef === "function") childRef(node);
          else if (childRef) childRef.current = node;
        },
        onBlur: (e: FocusEvent<HTMLElement>) => {
          childOnBlur?.(e);
          setFilled(readControlValue(e.target).trim() !== "");
        },
        onChange: (e: ChangeEvent<HTMLElement>) => {
          childOnChange?.(e);
          // Clear-only: emptying the field drops the tint right away, but
          // typing never GAINS it mid-edit — the blur contract holds.
          if (readControlValue(e.target).trim() === "") setFilled(false);
        },
      }
    : undefined;

  // react-hooks/refs below is a FALSE POSITIVE, verified rather than assumed.
  // The rule fires because tintProps carries a `ref` into cloneElement and it
  // cannot tell whether a ref VALUE is read during render. It is not: the
  // child's ref is only CAPTURED at `const childRef = single?.props.ref`, and
  // the sole `.current` access sits inside the callback ref, which React
  // invokes at commit — never during render. Restructuring to satisfy the rule
  // would mean giving up the wrapper-calls-original ordering that the
  // sanitize-on-blur contract above depends on. Re-check if ref merging changes.
  const content = single
    ? // eslint-disable-next-line react-hooks/refs
      cloneElement(single, {
        id: single.props.id ?? fieldId,
        className: stateClass
          ? `${single.props.className ?? ""} ${stateClass}`.trim()
          : single.props.className,
        "aria-invalid": showInvalid || undefined,
        ...tintProps,
      })
    : children;

  const helperError = error ?? (feedback?.state === "invalid" ? feedback.message : undefined);

  return (
  <div className="cv-field" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
        gap: 8,
      }}
    >
      <label
        htmlFor={assignedId}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--ff-ink-2)",
        }}
      >
        {label}
        {required && (
          <span
            style={{
              color: "var(--ff-muted)",
              marginLeft: 6,
              fontSize: 12,
              fontWeight: 400,
            }}
          >
            required
          </span>
        )}
        {optional && (
          <span
            style={{
              color: "var(--ff-faint)",
              marginLeft: 6,
              fontSize: 11,
              fontWeight: 400,
            }}
          >
            · optional
          </span>
        )}
      </label>
      {score && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ff-accent)",
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          {score}
        </span>
      )}
    </div>
    {leftIcon || showValid ? (
      <div style={{ position: "relative" }}>
        {leftIcon && (
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ff-faint)",
              display: "inline-flex",
              pointerEvents: "none",
            }}
          >
            <Icon name={leftIcon} size={15} />
          </span>
        )}
        {content}
        {showValid && (
          /* Quiet success badge — the check GLYPH carries the meaning, not
             just the green (a11y rule). aria-hidden: success is decorative
             reassurance, not something to announce over the user. */
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--ff-accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Icon name="check" size={9} color="white" strokeWidth={3.5} />
          </span>
        )}
      </div>
    ) : (
      content
    )}
    {hint && !helperError && (
      <span
        style={{
          fontSize: 12,
          color: "var(--ff-muted)",
          marginTop: 6,
        }}
      >
        {hint}
      </span>
    )}
    {helperError && (
      <span
        style={{
          fontSize: 12,
          color: "var(--ff-red)",
          marginTop: 6,
        }}
      >
        {helperError}
      </span>
    )}
  </div>
  );
};
