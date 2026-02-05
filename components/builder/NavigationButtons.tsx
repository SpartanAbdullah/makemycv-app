"use client";

export const NavigationButtons = ({
  onBack,
  onNext,
  backLabel = "Back",
  nextLabel = "Next",
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
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
        >
          {backLabel}
        </button>
      )}
      {showSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500"
        >
          Skip for now
        </button>
      )}
    </div>
    {onNext && (
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        className="rounded-full bg-slate-900 px-5 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {nextLabel}
      </button>
    )}
  </div>
);
