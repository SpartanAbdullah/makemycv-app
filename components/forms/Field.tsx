import { ReactNode } from "react";
import { Icon, type IconName } from "../builder/Icon";

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
 */
export const Field = ({
  label,
  hint,
  error,
  score,
  required,
  optional,
  leftIcon,
  children,
}: Props) => (
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
    {leftIcon ? (
      <div style={{ position: "relative" }}>
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
        {children}
      </div>
    ) : (
      children
    )}
    {hint && !error && (
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
    {error && (
      <span
        style={{
          fontSize: 12,
          color: "var(--ff-red)",
          marginTop: 6,
        }}
      >
        {error}
      </span>
    )}
  </div>
);
