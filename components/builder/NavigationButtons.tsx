"use client";

export const NavigationButtons = ({
  onBack,
  onNext,
  backLabel = "← Back",
  nextLabel = "Continue →",
  disableNext,
  showSkip,
  onSkip,
}: {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  disableNext?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
}) => (
  <div
    style={{
      display: "flex",
      gap: 12,
      marginTop: 32,
      paddingTop: 24,
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
        type="button"
        onClick={onNext}
        disabled={disableNext}
        className="cv-btn-primary"
        style={{ flex: 1, padding: "14px 24px", fontSize: 15 }}
      >
        {nextLabel}
      </button>
    )}
  </div>
);
