import { builderSteps } from "../../lib/utils/steps";
import type { BuilderStep } from "../../lib/utils/steps";

/**
 * Step title block mounted at the top of every builder step (audit
 * UI-3/UX-7: 8 of 10 steps had no heading at all — the only wayfinding
 * was a 12px bead label that scrolls off-screen on phones).
 *
 * Gives every step: an h1 landmark for screen readers with the
 * "Step X of 10" counter inline on its right (kept for phone wayfinding,
 * but no longer costing a line of vertical space), a one-line
 * plain-English purpose statement, and the step's ATS tip.
 *
 * The h1 carries tabIndex={-1} so BuilderShell can move focus here on
 * step change (keyboard/SR users land on the new step's heading instead
 * of being dropped on <body>).
 */
export const StepHeader = ({ stepId }: { stepId: BuilderStep["id"] }) => {
  const index = builderSteps.findIndex((s) => s.id === stepId);
  const step = builderSteps[index];
  if (!step) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 className="cv-step-heading" tabIndex={-1} style={{ outline: "none" }}>
          {step.title}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            // Functional wayfinding text — muted, not faint (contrast floor).
            color: "var(--ff-muted)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Step {index + 1} of {builderSteps.length}
        </p>
      </div>
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
