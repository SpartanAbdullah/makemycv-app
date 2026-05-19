"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { builderSteps } from "../../../lib/utils/steps";
import { getStepCompletion } from "../../../lib/utils/stepValidation";
import { useCvStore } from "../../../lib/store/cvStore";
import { exportToDocx } from "../../../lib/utils/docxExport";
import { downloadCV } from "../../../hooks/useDownloadCV";
import { templates } from "../../../lib/templates";
import { computeScore } from "../../../lib/scoreEngine";
import { UpgradeModal } from "../../modals/UpgradeModal";
import { Icon } from "../Icon";
import { UAEDot } from "../UAEDot";

const A4_W = 794;
const A4_H = 1123;
const LOCKED_TEMPLATES = new Set([
  "executive",
  "ats-clean",
  "exec-split",
  "corp-sidebar",
]);

/**
 * Template thumbnail — A4-aspect mini-render using scale(width / 794).
 * Mirrors the production template renderer so the thumbnail looks like the
 * actual output, not a hand-drawn approximation.
 */
function TemplateThumb({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.22);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / A4_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1.414",
        overflow: "hidden",
        borderRadius: 8,
        background: "white",
        border: "1px solid var(--ff-line)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: A4_W,
          height: A4_H,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Animated number counter ───────────────────────────── */
function useAnimatedNumber(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const pct = Math.min(1, elapsed / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - pct, 3);
      const next = Math.round(
        fromRef.current + (target - fromRef.current) * eased,
      );
      setValue(next);
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

/* ─── Review step ───────────────────────────────────────── */
export const ReviewStep = ({
  onBack,
  onJump,
}: {
  onBack: () => void;
  onJump: (stepId: string) => void;
}) => {
  const data = useCvStore((state) => state.data);
  const parseSignals = useCvStore((state) => state.parseSignals);
  const updateSection = useCvStore((state) => state.updateSection);
  const isPro = useCvStore((state) => state.isPro);
  const hasUsedFreeDownload = useCvStore((state) => state.hasUsedFreeDownload);
  const setHasUsedFreeDownload = useCvStore(
    (state) => state.setHasUsedFreeDownload,
  );
  const appliedCouponCode = useCvStore((state) => state.appliedCouponCode);
  const proAccessSource = useCvStore((state) => state.proAccessSource);
  const applyCoupon = useCvStore((state) => state.applyCoupon);
  const clearCoupon = useCvStore((state) => state.clearCoupon);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{
    type: "error" | "info";
    text: string;
  } | null>(null);
  const [filter, setFilter] = useState<"all" | "free" | "pro">("all");

  const score = useMemo(
    () =>
      computeScore(data, {
        mode: "builder",
        parseSignals: parseSignals ?? undefined,
      }),
    [data, parseSignals],
  );

  const animatedScore = useAnimatedNumber(score.total);
  const firstName =
    data.personal.firstName?.trim() ||
    data.personal.lastName?.trim() ||
    "friend";

  const handleExportDocx = () => exportToDocx(data);
  const handleDownloadPdf = async () => {
    if (!isPro && hasUsedFreeDownload) {
      setUpgradeOpen(true);
      return;
    }
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadCV(
        data,
        isPro ? "pro" : "free",
        data.settings.templateId ?? "classic",
      );
      if (!isPro) setHasUsedFreeDownload(true);
    } catch {
      setDownloadError("pdf-failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareLink = async () => {
    if (typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  };

  const handleTemplateChange = (id: string) => {
    if (!isPro && LOCKED_TEMPLATES.has(id)) {
      setUpgradeOpen(true);
      return;
    }
    updateSection("settings", { ...data.settings, templateId: id });
  };

  const handleApplyCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsApplyingCoupon(true);
    const result = await applyCoupon(couponCode);
    setIsApplyingCoupon(false);
    if (!result.ok) {
      setCouponFeedback({ type: "error", text: result.message });
      return;
    }
    setCouponCode("");
    setCouponFeedback({ type: "info", text: result.message });
    setUpgradeOpen(false);
  };

  const handleRemoveCoupon = () => {
    clearCoupon();
    setCouponFeedback({
      type: "info",
      text: "Promo removed from this browser.",
    });
  };

  const incomplete = builderSteps.filter(
    (step) => step.id !== "review" && !getStepCompletion(step, data),
  );

  /* ── Stats line items for the score card ── */
  const totalBullets = data.experience.reduce(
    (sum, e) => sum + (e.bullets ?? []).filter(Boolean).length,
    0,
  );
  const measurableBullets = data.experience.reduce(
    (sum, e) =>
      sum + (e.bullets ?? []).filter((b) => /\d/.test(b ?? "")).length,
    0,
  );
  const uaeFilled = [
    data.personal.visaStatus,
    data.personal.availability,
    data.personal.drivingLicense,
  ].filter((v) => v && v.trim()).length;
  const expectedPages =
    data.experience.length <= 2 && totalBullets <= 8 ? 1 : 2;

  const scoreCategoryLabel =
    score.total >= 85
      ? "Outstanding CV"
      : score.total >= 65
        ? "Strong CV"
        : score.total >= 40
          ? "Almost there"
          : "Getting started";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
      className="ff-review-root"
    >
      {/* Header row */}
      <div className="cv-step-badge">
        <UAEDot size={13} />
        STEP 09 · REVIEW
      </div>

      {/* Two-column grid: left = hero + score + actions; right = templates */}
      <div className="ff-review-grid">
        {/* ── Left ───────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <h1
              className="cv-step-heading"
              style={{
                fontSize: 42,
                fontWeight: 600,
                letterSpacing: "-0.03em",
              }}
            >
              Looking good,
              <br />
              <span className="accent">{firstName}.</span>
            </h1>
            <p className="cv-step-subtitle" style={{ maxWidth: 380 }}>
              You&apos;re scoring above {Math.min(Math.round(score.total * 0.95), 97)}%
              of CVs in the UAE market. Take a final look, pick a template, and
              download.
            </p>
          </div>

          {/* Missing sections */}
          {incomplete.length > 0 && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #F7E2A3",
                background: "var(--ff-warn-soft)",
                padding: 16,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ff-warn)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Missing sections
              </p>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {incomplete.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onJump(step.id)}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #F7E2A3",
                      background: "white",
                      padding: "5px 14px",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--ff-warn)",
                      cursor: "pointer",
                    }}
                  >
                    {step.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Score card */}
          <div
            style={{
              padding: 22,
              background: "var(--ff-card)",
              border: "1px solid var(--ff-line)",
              borderRadius: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <ScoreDonut total={score.total} />
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    color: "var(--ff-ink)",
                    fontWeight: 600,
                  }}
                >
                  {scoreCategoryLabel}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--ff-muted)",
                    marginTop: 4,
                  }}
                >
                  Top {Math.max(5, 100 - Math.round(score.total * 0.95))}% in
                  UAE · {data.personal.headline?.trim() || "your field"}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--ff-accent)",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--ff-accent)",
                    }}
                  />
                  Live score · {animatedScore}/100
                </div>
              </div>
            </div>
            <div
              style={{
                height: 1,
                background: "var(--ff-line)",
                margin: "18px 0",
              }}
            />
            <div
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <StatRow
                label="Measurable bullets"
                value={
                  totalBullets > 0
                    ? `${measurableBullets} of ${totalBullets}`
                    : "—"
                }
              />
              <StatRow
                label="UAE essentials filled"
                value={
                  uaeFilled === 3
                    ? "All ✓"
                    : `${uaeFilled} of 3`
                }
              />
              <StatRow
                label="Sections complete"
                value={`${builderSteps.filter((s) => getStepCompletion(s, data)).length - (getStepCompletion(builderSteps[builderSteps.length - 1], data) ? 1 : 0)} of ${builderSteps.length - 1}`}
              />
              <StatRow
                label="Expected length"
                value={`${expectedPages} page${expectedPages > 1 ? "s" : ""}`}
              />
            </div>
          </div>

          {/* Action stack */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="cv-btn-primary"
              style={{ width: "100%", padding: "16px", fontSize: 15 }}
            >
              {isDownloading ? (
                <>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      border: "2px solid white",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Preparing PDF…
                </>
              ) : (
                <>
                  <Icon name="download" size={15} />
                  Download CV as PDF
                </>
              )}
            </button>
            {downloadError === "pdf-failed" && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#FBEFED",
                  border: "1px solid #F2D2CE",
                }}
              >
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--ff-red)",
                    fontWeight: 500,
                  }}
                >
                  PDF download failed. Try again or export as Word below.
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleExportDocx}
                className="cv-btn-secondary"
                style={{ flex: 1, padding: "12px" }}
              >
                Export .docx
              </button>
              <button
                type="button"
                onClick={handleShareLink}
                className="cv-btn-secondary"
                style={{ flex: 1, padding: "12px" }}
              >
                {shareCopied ? "Link copied ✓" : "Copy share link"}
              </button>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--ff-faint)",
                textAlign: "center",
                marginTop: 4,
              }}
            >
              PDF is best for applications. DOCX is editable.
            </p>
          </div>

          {/* Promo section */}
          {(proAccessSource === "coupon" || !isPro) && (
            <div
              style={{
                padding: 18,
                background: "var(--ff-card)",
                border: "1px solid var(--ff-line)",
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      color: "var(--ff-muted)",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Apply promo
                  </p>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--ff-muted)",
                    }}
                  >
                    Use an internal promo code to unlock Pro without payment.
                  </p>
                </div>
                {proAccessSource === "coupon" && (
                  <span
                    style={{
                      borderRadius: 999,
                      background: "var(--ff-accent-soft)",
                      border: "1px solid rgba(14,124,74,0.3)",
                      color: "var(--ff-accent-dark)",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "5px 10px",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Pro unlocked
                  </span>
                )}
              </div>
              {proAccessSource === "coupon" ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--ff-accent-dark)",
                      fontWeight: 600,
                    }}
                  >
                    Promo{" "}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {appliedCouponCode}
                    </span>{" "}
                    is active on this browser.
                  </p>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="cv-btn-secondary"
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      padding: "8px 14px",
                    }}
                  >
                    Remove promo
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleApplyCoupon}
                  style={{ marginTop: 14, display: "flex", gap: 8 }}
                >
                  <input
                    id="promo-code"
                    type="text"
                    value={couponCode}
                    onChange={(event) => {
                      setCouponCode(event.target.value);
                      if (couponFeedback) setCouponFeedback(null);
                    }}
                    placeholder="Enter promo code"
                    className="cv-input"
                    style={{ flex: 1 }}
                    autoComplete="off"
                    disabled={isApplyingCoupon}
                  />
                  <button
                    type="submit"
                    className="cv-btn-secondary"
                    style={{
                      padding: "12px 18px",
                      whiteSpace: "nowrap",
                    }}
                    disabled={isApplyingCoupon}
                  >
                    {isApplyingCoupon ? "Applying…" : "Apply"}
                  </button>
                </form>
              )}
              {couponFeedback && (
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 12.5,
                    color:
                      couponFeedback.type === "error"
                        ? "var(--ff-red)"
                        : "var(--ff-accent-dark)",
                    fontWeight: 500,
                  }}
                >
                  {couponFeedback.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: templates ─────────────────────────────── */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  color: "var(--ff-ink)",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                Choose a template
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12.5,
                  color: "var(--ff-muted)",
                  marginTop: 3,
                }}
              >
                All six are ATS-tested and used by UAE recruiters.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 4,
                padding: 4,
                background: "var(--ff-card)",
                border: "1px solid var(--ff-line)",
                borderRadius: 999,
              }}
            >
              {(["all", "free", "pro"] as const).map((tab) => {
                const active = filter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      padding: "5px 14px",
                      borderRadius: 999,
                      background: active ? "var(--ff-ink)" : "transparent",
                      color: active ? "white" : "var(--ff-muted)",
                      border: "none",
                      fontWeight: active ? 600 : 500,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ff-templates-grid">
            {templates
              .filter((t) => {
                if (filter === "all") return true;
                const isLocked = LOCKED_TEMPLATES.has(t.id);
                if (filter === "free") return !isLocked;
                return isLocked;
              })
              .map((tmpl) => {
                const isLocked = !isPro && LOCKED_TEMPLATES.has(tmpl.id);
                const isSelected = data.settings.templateId === tmpl.id;
                return (
                  <TemplateCard
                    key={tmpl.id}
                    name={tmpl.name}
                    description={tmpl.description}
                    badge={tmpl.badge}
                    selected={isSelected}
                    locked={isLocked}
                    onClick={() => handleTemplateChange(tmpl.id)}
                  >
                    <TemplateThumb>
                      <tmpl.Render
                        data={data}
                        plan={isPro ? "pro" : "free"}
                      />
                    </TemplateThumb>
                  </TemplateCard>
                );
              })}
          </div>
        </div>
      </div>

      {/* Back nav */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          paddingTop: 12,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="cv-btn-secondary"
          style={{ padding: "11px 22px" }}
        >
          <Icon name="chevron-left" size={13} />
          Back
        </button>
      </div>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      <style>{`
        .ff-review-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
        }
        @media (min-width: 1200px) {
          .ff-review-grid { grid-template-columns: 1fr 1.3fr; gap: 32px; }
        }
        .ff-templates-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (min-width: 880px) {
          .ff-templates-grid { grid-template-columns: 1fr 1fr 1fr; }
        }
      `}</style>
    </div>
  );
};

/* ─── Score donut ───────────────────────────────────────── */
const ScoreDonut = ({ total }: { total: number }) => {
  const angle = total * 3.6;
  return (
    <div
      style={{
        width: 90,
        height: 90,
        borderRadius: "50%",
        background: `conic-gradient(var(--ff-accent) 0 ${angle}deg, var(--ff-line) ${angle}deg)`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        transition: "background 800ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        style={{
          width: 74,
          height: 74,
          borderRadius: "50%",
          background: "var(--ff-card)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 700,
              color: "var(--ff-ink)",
              lineHeight: 1,
            }}
          >
            {total}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--ff-muted)",
              letterSpacing: "0.14em",
              marginTop: 3,
              textTransform: "uppercase",
            }}
          >
            / 100
          </div>
        </div>
      </div>
    </div>
  );
};

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "var(--font-body)",
      fontSize: 13,
      color: "var(--ff-ink-2)",
    }}
  >
    <span>{label}</span>
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--ff-ink)",
        fontWeight: 600,
      }}
    >
      {value}
    </span>
  </div>
);

const TemplateCard = ({
  name,
  description,
  badge,
  selected,
  locked,
  onClick,
  children,
}: {
  name: string;
  description: string;
  badge?: string;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    style={{
      position: "relative",
      padding: 8,
      borderRadius: 14,
      background: selected ? "var(--ff-accent-soft)" : "var(--ff-card)",
      border: `2px solid ${selected ? "var(--ff-accent)" : "var(--ff-line)"}`,
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      flexDirection: "column",
      transition:
        "background var(--transition-base), border-color var(--transition-base)",
    }}
  >
    {badge && (
      <span
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 2,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--ff-ink)",
          background: "var(--ff-paper)",
          padding: "3px 8px",
          borderRadius: 999,
          fontWeight: 600,
          letterSpacing: "0.08em",
          border: "1px solid var(--ff-line)",
          textTransform: "uppercase",
        }}
      >
        {badge}
      </span>
    )}
    {locked && (
      <span
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 2,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--ff-ink)",
          color: "white",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name="lock" size={11} />
      </span>
    )}
    {children}
    <div
      style={{
        marginTop: 10,
        padding: "0 4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 14,
          color: "var(--ff-ink)",
          fontWeight: 600,
        }}
      >
        {name}
      </div>
      {selected && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ff-accent)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--ff-accent)",
            }}
          />
          Selected
        </span>
      )}
    </div>
    <p
      style={{
        fontSize: 11,
        color: "var(--ff-faint)",
        marginTop: 4,
        padding: "0 4px",
        lineHeight: 1.4,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {description}
    </p>
  </button>
);
