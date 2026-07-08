"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectsSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { useUiStore } from "../../../lib/store/uiStore";
import { Field } from "../../forms/Field";
import { AutoGrowTextarea } from "../../forms/AutoGrowTextarea";
import { Repeater } from "../../forms/Repeater";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { MAX_BULLETS, splitPastedBulletText } from "../../../lib/utils/bullets";
import { Icon } from "../Icon";
import { BulletRow } from "../BulletRow";
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
  const pushToast = useUiStore((s) => s.pushToast);
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

  const { fields, append, remove, update, insert } = useFieldArray({
    control,
    name: "projects",
  });

  const [focusedBullet, setFocusedBullet] = useState<{
    itemIndex: number;
    bulletIndex: number;
  } | null>(null);

  // First card opens by default — matching EducationStep's collapse pattern.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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

  const handleAddEntry = () => {
    append(createEmptyItems.project());
    setOpenIndex(fields.length);
  };

  // Deletion with undo (replaces a confirm dialog): capture the entry BEFORE
  // remove, then offer to re-insert it at its original position. The
  // debounced watch subscription persists both the removal and the restore.
  const handleRemoveEntry = (index: number) => {
    const removed = getValues(`projects.${index}`);
    remove(index);
    if (!removed) return;
    pushToast("Project removed", {
      actionLabel: "Undo",
      onAction: () => {
        insert(index, removed);
        setOpenIndex(index);
      },
    });
  };

  // On failed submit, open the first card that has a validation error so the
  // inline messages are actually reachable inside the collapsed list.
  const onInvalid = (formErrors: FieldErrors<ProjectsForm>) => {
    const entryErrors = formErrors.projects;
    if (!entryErrors) return;
    const firstErrorIndex = Object.keys(entryErrors)
      .map(Number)
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b)[0];
    if (firstErrorIndex !== undefined) setOpenIndex(firstErrorIndex);
  };

  return (
    <form
      onSubmit={handleSubmit(onNext, onInvalid)}
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
                onClick={handleAddEntry}
                className="cv-btn-ghost"
                style={{ width: "auto" }}
              >
                <Icon name="plus" size={14} />
                Add project
              </button>
            }
          >
            {fields.map((field, index) => {
              const isOpen = openIndex === index;
              const name = watch(`projects.${index}.name`) || "";
              const filledBullets = (watch(`projects.${index}.bullets`) || []).filter(
                (bullet) => (bullet || "").trim().length > 0,
              ).length;
              const summaryLine = [
                name,
                filledBullets ? `${filledBullets} highlight${filledBullets === 1 ? "" : "s"}` : null,
              ].filter(Boolean).join(" | ");

              return (
                <div key={field.id} className="cv-entry-card">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="truncate">
                      {summaryLine || `Project ${index + 1}`}
                    </span>
                    <svg
                      className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      style={{ color: "var(--text-faint)" }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border-soft)", padding: 20 }}>
                      <div className="flex items-center justify-end" style={{ gap: 6 }}>
                        {/* Always removable — Projects is optional, so the last
                            card must delete down to an empty section (not stay
                            as an un-deletable blank shell that renders a ghost
                            "Projects" heading on the CV). */}
                        <button type="button" onClick={() => handleRemoveEntry(index)} className="cv-btn-danger">
                          <Icon name="trash" size={12} />
                          Remove
                        </button>
                      </div>

                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        <Field
                          label="Project name"
                          error={errors.projects?.[index]?.name?.message}
                        >
                          <input className="cv-input" placeholder="e.g. Dubai Mall Fit-Out Project" {...register(`projects.${index}.name`)} />
                        </Field>
                        <Field label="Link">
                          <input className="cv-input" placeholder="e.g. www.projectsite.com" type="url" inputMode="url" autoComplete="url" {...register(`projects.${index}.link`)} />
                        </Field>
                      </div>

                      <div className="mt-4 space-y-3">
                        <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--ff-ink)" }}>Highlights</p>
                        <div className="cv-tip-box">
                          <p>Tip: Use 3-5 bullets. Keep each 1-2 lines. Start with an action verb + result/metric.</p>
                          <p style={{ marginTop: 4 }}>Example: Built a search feature that cut average lookup time by 40%.</p>
                          <p style={{ marginTop: 4 }}>Example: Increased daily active users by 15% after launching onboarding improvements.</p>
                        </div>
                        {(watch(`projects.${index}.bullets`) || []).map((_, bulletIndex) => (
                          <div key={bulletIndex} className="space-y-1">
                            <BulletRow showMarker>
                              <AutoGrowTextarea
                                className="cv-input cv-textarea flex-1"
                                placeholder="What did you do or deliver? Start with a verb, add a result."
                                aria-label={`Project highlight ${bulletIndex + 1}`}
                                minHeight={56}
                                {...register(`projects.${index}.bullets.${bulletIndex}`)}
                                onFocus={() => setFocusedBullet({ itemIndex: index, bulletIndex })}
                              />
                              <button
                                type="button"
                                onClick={() => removeBullet(index, bulletIndex)}
                                className="cv-btn-danger"
                                aria-label="Remove highlight"
                                style={{ alignSelf: "center" }}
                              >
                                <Icon name="trash" size={12} />
                              </button>
                            </BulletRow>
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
                          <button type="button" onClick={() => addBullet(index)} className="cv-btn-ghost" style={{ width: "auto" }}>
                            <Icon name="plus" size={14} />
                            Add bullet
                          </button>
                          {focusedBullet?.itemIndex === index && (
                            <button
                              type="button"
                              onClick={() => splitFocusedBullet(index)}
                              style={{
                                fontFamily: "var(--font-body)",
                                fontSize: 12,
                                color: "var(--ff-muted)",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                textDecoration: "underline",
                                padding: 0,
                              }}
                            >
                              Split pasted text into bullets
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
        onNext={handleSubmit(onNext, onInvalid)}
        showSkip
        onSkip={onSkip}
      />
    </form>
  );
};
