"use client";

export const NavigationButtons = ({
  onBack,
  onNext,
  backLabel = "← Back",
  nextLabel = "Continue →",
  disableNext,
  showSkip,
  onSkip,
  nextType = "button",
}: {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  disableNext?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
  /** "submit" when rendered inside a <form> so Enter still implicitly
   *  submits (react-hook-form's handleSubmit preventDefaults the click,
   *  so onNext never double-fires). */
  nextType?: "button" | "submit";
}) => (
  <div
    style={{
      display: "flex",
      gap: 12,
      marginTop: 16,
      paddingTop: 14,
      borderTop: "1px solid var(--border-soft)",
      alignItems: "center",
    }}
  >
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="cv-btn-secondary"
        style={{ flexShrink: 0 }}
      >
        {backLabel}
      </button>
    )}
    {showSkip && onSkip && (
      <button
        type="button"
        onClick={onSkip}
        className="cv-btn-secondary"
        style={{ flexShrink: 0, color: "var(--text-muted)" }}
      >
        Skip for now
      </button>
    )}
    {onNext && (
      <button
        type={nextType}
        onClick={onNext}
        disabled={disableNext}
        className="cv-btn-primary"
        style={{ flex: 1 }}
      >
        {nextLabel}
      </button>
    )}
  </div>
);
