"use client";

import { useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BuilderShell } from "../../components/builder/BuilderShell";
import ImportFromReportBanner from "../../components/builder/ImportFromReportBanner";
import { PersonalStep } from "../../components/builder/steps/PersonalStep";
import { UAEEssentialsStep } from "../../components/builder/steps/UAEEssentialsStep";
import { SummaryStep } from "../../components/builder/steps/SummaryStep";
import { ExperienceStep } from "../../components/builder/steps/ExperienceStep";
import { EducationStep } from "../../components/builder/steps/EducationStep";
import { SkillsStep } from "../../components/builder/steps/SkillsStep";
import { LanguagesStep } from "../../components/builder/steps/LanguagesStep";
import { CertificationsStep } from "../../components/builder/steps/CertificationsStep";
import { ProjectsStep } from "../../components/builder/steps/ProjectsStep";
import { ReviewStep } from "../../components/builder/steps/ReviewStep";
import { ScorePanel } from "../../components/ScorePanel";
import { builderSteps } from "../../lib/utils/steps";

const stepIds = builderSteps.map((step) => step.id);

export const BuilderClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("step") || "personal";
  const stepId =
    stepIds.includes(current as never) || current === "score"
      ? current
      : "personal";

  const stepIndex = useMemo(
    () => builderSteps.findIndex((step) => step.id === stepId),
    [stepId],
  );

  const goToStep = (id: string) => {
    router.push(`/builder?step=${id}`);
  };

  const nextStep = builderSteps[stepIndex + 1]?.id;
  const prevStep = builderSteps[stepIndex - 1]?.id;

  // ScorePanel now hands us an already-resolved builder step id (via its
  // internal CATEGORY_TO_STEP table). We just forward it to the router.
  const handleSectionClick = useCallback(
    (stepTarget: string) => {
      const targetStep = stepIds.includes(stepTarget as never)
        ? stepTarget
        : "personal";
      goToStep(targetStep);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <ImportFromReportBanner />
      <BuilderShell stepId={stepId} onStepChange={goToStep}>
      {stepId === "personal" && (
        <PersonalStep onNext={() => goToStep(nextStep || "uaeEssentials")} />
      )}
      {stepId === "uaeEssentials" && (
        <UAEEssentialsStep
          onNext={() => goToStep(nextStep || "summary")}
          onBack={() => goToStep(prevStep || "personal")}
          onSkip={() => goToStep(nextStep || "summary")}
        />
      )}
      {stepId === "summary" && (
        <SummaryStep
          onNext={() => goToStep(nextStep || "experience")}
          onBack={() => goToStep(prevStep || "uaeEssentials")}
          onSkip={() => goToStep(nextStep || "experience")}
        />
      )}
      {stepId === "experience" && (
        <ExperienceStep
          onNext={() => goToStep(nextStep || "education")}
          onBack={() => goToStep(prevStep || "summary")}
        />
      )}
      {stepId === "education" && (
        <EducationStep
          onNext={() => goToStep(nextStep || "skills")}
          onBack={() => goToStep(prevStep || "experience")}
        />
      )}
      {stepId === "skills" && (
        <SkillsStep
          onNext={() => goToStep(nextStep || "languages")}
          onBack={() => goToStep(prevStep || "education")}
        />
      )}
      {stepId === "languages" && (
        <LanguagesStep
          onNext={() => goToStep(nextStep || "certifications")}
          onBack={() => goToStep(prevStep || "skills")}
          onSkip={() => goToStep(nextStep || "certifications")}
        />
      )}
      {stepId === "certifications" && (
        <CertificationsStep
          onNext={() => goToStep(nextStep || "projects")}
          onBack={() => goToStep(prevStep || "languages")}
          onSkip={() => goToStep(nextStep || "projects")}
        />
      )}
      {stepId === "projects" && (
        <ProjectsStep
          onNext={() => goToStep(nextStep || "review")}
          onBack={() => goToStep(prevStep || "certifications")}
          onSkip={() => goToStep(nextStep || "review")}
        />
      )}
      {stepId === "review" && (
        <ReviewStep onBack={() => goToStep(prevStep || "projects")} onJump={goToStep} />
      )}
      {stepId === "score" && <ScorePanel onSectionClick={handleSectionClick} />}
      </BuilderShell>
    </>
  );
};
