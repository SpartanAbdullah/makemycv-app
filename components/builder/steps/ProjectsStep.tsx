"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectsSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { Repeater } from "../../forms/Repeater";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { MAX_BULLETS, splitPastedBulletText } from "../../../lib/utils/bullets";
import { Icon } from "../Icon";
import type { CvProject } from "../../../lib/types/cv";

type ProjectsForm = { projects: CvProject[] };

export const ProjectsStep = ({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) => {
  const projects = useCvStore((state) => state.data.projects);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(projects));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    reset,
    formState: { isDirty, errors },
  } = useForm<ProjectsForm>({
    resolver: zodResolver(projectsSchema),
    defaultValues: { projects },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "projects",
  });

  const [focusedBullet, setFocusedBullet] = useState<{
    itemIndex: number;
    bulletIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!isDirty) reset({ projects });
  }, [projects, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(projects);
  }, [projects]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.projects) {
        const next = (value.projects ?? []).filter(
          (project): project is CvProject => Boolean(project && project.id),
        );
        const nextSerialized = JSON.stringify(next);
        if (nextSerialized === lastSerializedRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("projects", next);
          }
        }, 250);
      }
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      subscription.unsubscribe();
    };
  }, [watch, updateSection]);

  const addBullet = (index: number) => {
    const currentItem = getValues(`projects.${index}`);
    if (!currentItem) return;
    const currentBullets = currentItem.bullets || [];
    if (currentBullets.length >= MAX_BULLETS) return;
    update(index, { ...currentItem, bullets: [...currentBullets, ""] });
  };

  const removeBullet = (index: number, bulletIndex: number) => {
    const currentItem = getValues(`projects.${index}`);
    if (!currentItem) return;
    const currentBullets = currentItem.bullets || [];
    const next = currentBullets.filter((_, i) => i !== bulletIndex);
    update(index, { ...currentItem, bullets: next.length ? next : [""] });
  };

  const splitFocusedBullet = (index: number) => {
    if (!focusedBullet || focusedBullet.itemIndex !== index) return;
    const currentItem = getValues(`projects.${index}`);
    if (!currentItem) return;
    const currentBullets = currentItem.bullets || [];
    const rawValue = currentBullets[focusedBullet.bulletIndex] || "";
    const split = splitPastedBulletText(rawValue, MAX_BULLETS);
    if (split.length <= 1) return;
    const before = currentBullets.slice(0, focusedBullet.bulletIndex);
    const after = currentBullets.slice(focusedBullet.bulletIndex + 1);
    const availableSlots = Math.max(1, MAX_BULLETS - before.length - after.length);
    const next = [...before, ...split.slice(0, availableSlots), ...after];
    update(index, { ...currentItem, bullets: next.length ? next : [""] });
  };

  return (
    <form
      onSubmit={handleSubmit(onNext)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <StepHeader stepId="projects" />
      <section className="cv-step-card">
        <div>
          {/* Empty-state value framing (audit UX-20). */}
          {fields.length === 0 && (
            <p
              style={{
                marginBottom: 12,
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--ff-muted)",
              }}
            >
              A project is any work you can point to: a fit-out you managed, a
              dashboard you built, an event you ran. One strong project with
              tools and results beats an empty section — or skip this step.
            </p>
          )}
          <Repeater
            title="Projects"
            action={
              <button
                type="button"
                onClick={() => append(createEmptyItems.project())}
                className="cv-btn-ghost"
                style={{ width: "auto", padding: "10px 14px" }}
              >
                <Icon name="plus" size={14} />
                Add project
              </button>
            }
          >
            {fields.map((field, index) => (
              <div key={field.id} className="cv-entry-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>
                    Project {index + 1}
                  </h4>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="cv-btn-danger">
                      <Icon name="trash" size={12} />
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Project name"
                    error={errors.projects?.[index]?.name?.message}
                  >
                    <input className="cv-input" placeholder="e.g. Dubai Mall Fit-Out Project" {...register(`projects.${index}.name`)} />
                  </Field>
                  <Field label="Link">
                    <input className="cv-input" placeholder="e.g. www.projectsite.com" {...register(`projects.${index}.link`)} />
                  </Field>
                </div>

                <div className="mt-4 space-y-3">
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-heading)" }}>Highlights</p>
                  <div className="cv-tip-box">
                    <p>Tip: Use 3-5 bullets. Keep each 1-2 lines. Start with an action verb + result/metric.</p>
                    <p style={{ marginTop: 4 }}>Example: Built a search feature that cut average lookup time by 40%.</p>
                    <p style={{ marginTop: 4 }}>Example: Increased daily active users by 15% after launching onboarding improvements.</p>
                  </div>
                  {(watch(`projects.${index}.bullets`) || []).map((_, bulletIndex) => (
                    <div key={bulletIndex} className="space-y-1">
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          className="cv-input flex-1"
                          {...register(`projects.${index}.bullets.${bulletIndex}`)}
                          onFocus={() => setFocusedBullet({ itemIndex: index, bulletIndex })}
                        />
                        <button type="button" onClick={() => removeBullet(index, bulletIndex)} className="cv-btn-danger">
                          <Icon name="trash" size={12} />
                          Remove
                        </button>
                      </div>
                      {errors.projects?.[index]?.bullets?.[bulletIndex]?.message && (
                        <p style={{ fontSize: 12, color: "var(--ff-red)" }}>
                          {errors.projects?.[index]?.bullets?.[bulletIndex]?.message}
                        </p>
                      )}
                      {(watch(`projects.${index}.bullets.${bulletIndex}`) || "").length > 180 && (
                        <p style={{ fontSize: 12, color: "var(--status-warning)" }}>
                          Consider splitting into 2 bullets for readability.
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => addBullet(index)} className="cv-btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }}>
                      Add bullet
                    </button>
                    <button
                      type="button"
                      onClick={() => splitFocusedBullet(index)}
                      disabled={!focusedBullet || focusedBullet.itemIndex !== index}
                      className="cv-btn-secondary"
                      style={{ fontSize: 12, padding: "6px 14px", opacity: (!focusedBullet || focusedBullet.itemIndex !== index) ? 0.5 : 1 }}
                    >
                      Split pasted text
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </Repeater>
        </div>

      </section>

      {/* Form-level fallback (audit UX-3): Continue used to fail with no
          message at all — e.g. a project without a bullet. */}
      {errors.projects && (
        <p style={{ fontSize: 12.5, color: "var(--ff-red)", fontWeight: 500 }}>
          Fix the highlighted project fields above, or remove the empty entry,
          to continue.
        </p>
      )}
      <NavigationButtons
        onBack={onBack}
        onNext={handleSubmit(onNext)}
        showSkip
        onSkip={onSkip}
      />
    </form>
  );
};
