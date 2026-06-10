import { builderSteps } from "../../lib/utils/steps";
import type { BuilderStep } from "../../lib/utils/steps";

/**
 * Step title block mounted at the top of every builder step (audit
 * UI-3/UX-7: 8 of 10 steps had no heading at all — the only wayfinding
 * was a 12px bead label that scrolls off-screen on phones).
 *
 * Gives every step: a "Step X of 10" position counter, an h1 landmark
 * for screen readers, a one-line plain-English purpose statement, and
 * the step's ATS tip (written in lib/utils/steps.ts but previously
 * rendered nowhere).
 */
export const StepHeader = ({ stepId }: { stepId: BuilderStep["id"] }) => {
  const index = builderSteps.findIndex((s) => s.id === stepId);
  const step = builderSteps[index];
  if (!step) return null;

  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ff-faint)",
        }}
      >
        Step {index + 1} of {builderSteps.length}
      </p>
      <h1 className="cv-step-heading" style={{ marginTop: 4 }}>
        {step.title}
      </h1>
      {step.subtitle && (
        <p className="cv-step-subtitle" style={{ marginTop: 6 }}>
          {step.subtitle}
        </p>
      )}
      <p
        style={{
          marginTop: 8,
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--ff-accent)",
          fontWeight: 500,
        }}
      >
        ATS tip: {step.atsTip}
      </p>
    </div>
  );
};
