"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { builderSteps } from "../../../lib/utils/steps";
import { getStepCompletion } from "../../../lib/utils/stepValidation";
import { useCvStore } from "../../../lib/store/cvStore";
import { NavigationButtons } from "../NavigationButtons";
import { exportToDocx } from "../../../lib/utils/docxExport";
import { downloadCV } from "../../../hooks/useDownloadCV";
import { templates } from "../../../lib/templates";
import { UpgradeModal } from "../../modals/UpgradeModal";

// Native A4 at ~96dpi. Our templates render into this exact box.
const A4_W = 794;
const A4_H = 1123;

/**
 * A4-portrait thumbnail: the outer box enforces the 1:1.414 aspect ratio
 * and scales the full-size template into it via transform: scale(cardWidth/794).
 * The scale is recomputed via ResizeObserver so the thumbnail stays crisp
 * across breakpoints and grid-width changes.
 */
function TemplateThumb({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.3);

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
      className="relative w-full overflow-hidden rounded-md border border-slate-200 bg-white aspect-[1/1.414]"
    >
      <div
        className="absolute left-0 top-0 origin-top-left pointer-events-none"
        style={{
          width: A4_W,
          height: A4_H,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const LOCKED_TEMPLATES = new Set(["executive", "ats-clean", "exec-split", "corp-sidebar"]);

export const ReviewStep = ({
  onBack,
  onJump,
}: {
  onBack: () => void;
  onJump: (stepId: string) => void;
}) => {
  const data = useCvStore((state) => state.data);
  const updateSection = useCvStore((state) => state.updateSection);
  const isPro = useCvStore((state) => state.isPro);
  const hasUsedFreeDownload = useCvStore((state) => state.hasUsedFreeDownload);
  const setHasUsedFreeDownload = useCvStore((state) => state.setHasUsedFreeDownload);
  const appliedCouponCode = useCvStore((state) => state.appliedCouponCode);
  const proAccessSource = useCvStore((state) => state.proAccessSource);
  const applyCoupon = useCvStore((state) => state.applyCoupon);
  const clearCoupon = useCvStore((state) => state.clearCoupon);
  const currentTemplateId = data.settings.templateId;
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{
    type: "error" | "info";
    text: string;
  } | null>(null);

  const handleExportDocx = () => exportToDocx(data);
  const handleDownloadPdf = async () => {
    if (!isPro && hasUsedFreeDownload) {
      setUpgradeOpen(true);
      return;
    }
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadCV(data, isPro ? "pro" : "free", data.settings.templateId ?? "classic");
      if (!isPro) setHasUsedFreeDownload(true);
    } catch {
      setDownloadError("pdf-failed");
    } finally {
      setIsDownloading(false);
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
      text: "Promo removed from this browser. Reapplying may fail if the code has already reached its usage limit.",
    });
  };

  const incomplete = builderSteps.filter(
    (step) => step.id !== "review" && !getStepCompletion(step, data),
  );

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="cv-step-heading">Your CV is ready.</h2>
        <p className="cv-step-subtitle">
          Review it on the right, then download or export below.
        </p>
      </div>

      {/* Missing sections warning */}
      {incomplete.length > 0 && (
        <div style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid #FDE68A",
          background: "#FFFBEB",
          padding: 16,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>Missing sections</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incomplete.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => onJump(step.id)}
                style={{
                  borderRadius: 20,
                  border: "1px solid #FDE68A",
                  background: "white",
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#92400E",
                  cursor: "pointer",
                  transition: "background var(--transition-fast)",
                }}
              >
                {step.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Download Actions */}
      <div className="cv-step-card">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="cv-btn-primary"
          style={{ width: "100%", padding: "16px 24px", fontSize: 15 }}
        >
          {isDownloading ? (
            <>
              <span style={{
                width: 16, height: 16,
                border: "2px solid white",
                borderTopColor: "transparent",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 1s linear infinite",
              }} />
              Preparing PDF...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download CV as PDF
            </>
          )}
        </button>
        {downloadError === "pdf-failed" && (
          <div style={{
            marginTop: 12,
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
          }}>
            <p style={{ fontSize: 13, color: "#B91C1C", fontWeight: 500 }}>
              PDF download failed. Please try again or export as Word below.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleExportDocx}
          className="cv-btn-secondary"
          style={{ width: "100%", marginTop: 12, padding: "14px 24px", fontSize: 15 }}
        >
          {"\uD83D\uDCC4"} Export as Word (.docx)
        </button>
        <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", marginTop: 12 }}>
          PDF is best for job applications. DOCX is editable.
        </p>
      </div>

      {(proAccessSource === "coupon" || !isPro) && (
        <div className="cv-step-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="cv-label" style={{ marginBottom: 6 }}>
                Apply Promo
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Use an internal testing promo code to unlock Pro without payment.
              </p>
            </div>
            {proAccessSource === "coupon" && (
              <span
                style={{
                  borderRadius: 999,
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  color: "#047857",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 10px",
                  whiteSpace: "nowrap",
                }}
              >
                Pro unlocked
              </span>
            )}
          </div>

          {proAccessSource === "coupon" ? (
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                borderRadius: "var(--radius-md)",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
              }}
            >
              <p style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>
                Promo <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{appliedCouponCode}</span> is active.
              </p>
              <p style={{ fontSize: 12, color: "#166534", marginTop: 4 }}>
                This browser now has Pro access for templates, clean PDF export, and unlimited downloads.
              </p>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="cv-btn-secondary"
                style={{ marginTop: 12, fontSize: 12, padding: "8px 14px" }}
              >
                Remove Promo
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className="mt-4 flex flex-col gap-3 sm:flex-row">
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
                style={{ padding: "12px 18px", whiteSpace: "nowrap" }}
                disabled={isApplyingCoupon}
              >
                {isApplyingCoupon ? "Applying..." : "Apply Promo"}
              </button>
            </form>
          )}

          {couponFeedback && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: couponFeedback.type === "error" ? "#FEF2F2" : "#EFF6FF",
                border: couponFeedback.type === "error"
                  ? "1px solid #FECACA"
                  : "1px solid #BFDBFE",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: couponFeedback.type === "error" ? "#B91C1C" : "#1D4ED8",
                }}
              >
                {couponFeedback.text}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Template Selector */}
      <div>
        <p className="cv-label" style={{ marginBottom: 12, marginTop: 24 }}>
          Choose Template
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {templates.map((tmpl) => {
            const isLocked = !isPro && LOCKED_TEMPLATES.has(tmpl.id);
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleTemplateChange(tmpl.id)}
                className="cv-entry-card"
                style={{
                  cursor: "pointer",
                  borderWidth: 2,
                  borderColor: currentTemplateId === tmpl.id ? "var(--brand-primary)" : undefined,
                  background: currentTemplateId === tmpl.id ? "var(--brand-primary-s)" : undefined,
                  position: "relative",
                }}
              >
                {/* Lock overlay for pro-only templates */}
                {isLocked && (
                  <div style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    zIndex: 2,
                  }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "white",
                      background: "#4F46E5",
                      borderRadius: 4,
                      padding: "2px 6px",
                      letterSpacing: "0.04em",
                      lineHeight: 1.4,
                    }}>
                      Pro
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                )}

                <div className="flex flex-col items-center p-3 h-full">
                  {/* Live mini-preview — true A4 portrait, content scaled to fit. */}
                  <div className="w-full mb-3">
                    <TemplateThumb>
                      <tmpl.Render data={data} plan={isPro ? "pro" : "free"} />
                    </TemplateThumb>
                  </div>

                  {/* Name */}
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", margin: 0, textAlign: "center" }}>
                    {tmpl.name}
                  </p>

                  {/* Badge */}
                  {tmpl.badge && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#059669",
                      background: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      borderRadius: 4,
                      padding: "1px 5px",
                      letterSpacing: "0.04em",
                      lineHeight: 1.5,
                      whiteSpace: "nowrap" as const,
                      marginTop: 4,
                    }}>
                      {tmpl.badge}
                    </span>
                  )}

                  {/* Description — clamped to 2 lines */}
                  <p className="line-clamp-2" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4, textAlign: "center", lineHeight: 1.4 }}>
                    {tmpl.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pro Plan Gate */}
      {!isPro && (
        <div style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-soft)",
          background: "linear-gradient(135deg, var(--surface-sunken), var(--brand-primary-s))",
          padding: 24,
        }}>
          <div className="flex items-start gap-3">
            <div style={{
              flexShrink: 0,
              marginTop: 2,
              width: 32, height: 32,
              borderRadius: "50%",
              background: "rgba(79,70,229,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "var(--brand-primary)", fontSize: 14, fontWeight: 700 }}>P</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)" }}>Upgrade to Pro</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Remove the watermark, unlock all templates, and export
                unlimited CVs with priority support.
              </p>
              <button
                type="button"
                className="cv-btn-primary"
                style={{ marginTop: 12, fontSize: 12, padding: "8px 16px" }}
                onClick={() => setUpgradeOpen(true)}
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      )}

      <NavigationButtons onBack={onBack} />

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
};
