"use client";

import { useEffect, useState, useLayoutEffect, useRef } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useCvStore } from "../../lib/store/cvStore";
import { getTemplateById } from "../../lib/templates";
import { TemplateBadges } from "../templates/TemplateBadges";

const A4_W = 794;
const A4_H = 1123;

export const TemplatePreviewModal = ({
  templateId,
  open,
  onClose,
  onSelect,
  onDownload,
}: {
  templateId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDownload: (id: string) => void;
}) => {
  const data = useCvStore((s) => s.data);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open — reference-counted (shared hook) so
  // overlapping lock-holders release in any order.
  useBodyScrollLock(open);

  // Compute scale so the A4 page fits the available viewport with padding.
  useLayoutEffect(() => {
    if (!open) return;
    const recompute = () => {
      const el = containerRef.current;
      if (!el) return;
      const maxW = el.clientWidth;
      const maxH = el.clientHeight;
      const sw = maxW / A4_W;
      const sh = maxH / A4_H;
      setScale(Math.min(sw, sh, 1));
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [open, templateId]);

  if (!open || !templateId) return null;

  const template = getTemplateById(templateId);
  const Render = template.Render;
  const isSelected = data.settings.templateId === templateId;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${template.name} preview`}
      onClick={onClose}
      // Padding lives in the scoped <style> below — it needs a media query
      // (tighter gutters on phones) and inline styles can't carry one.
      className="ff-preview-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--surface-overlay)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header bar — wraps at narrow widths so the fixed-width buttons drop
          to a new line instead of crushing the template-name column. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          rowGap: 10,
          marginBottom: 16,
          color: "white",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {template.name}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              opacity: 0.7,
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            Full-page preview · live data
          </div>
          {template.badges && template.badges.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <TemplateBadges badges={template.badges} direction="row" />
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", rowGap: 10 }}>
          {/* Ghost button styled inline on purpose — cv-top-btn-secondary
              assumes a light surface and would break on this dark overlay. */}
          <button
            type="button"
            onClick={() => onSelect(templateId)}
            disabled={isSelected}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: isSelected ? "rgba(255,255,255,0.10)" : "transparent",
              color: "white",
              cursor: isSelected ? "default" : "pointer",
              opacity: isSelected ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {isSelected ? "Selected" : "Use this template"}
          </button>
          {/* Same primary CTA geometry as the TopBar and mobile preview
              Download buttons — one shared class, not three hand-rolled
              variants. */}
          <button
            type="button"
            onClick={() => onDownload(templateId)}
            className="inline-flex cv-top-btn cv-top-btn-primary"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 18,
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "white",
              cursor: "pointer",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Page surface */}
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          overflow: "auto",
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: A4_W,
            height: A4_H,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            flexShrink: 0,
            boxShadow:
              "0 24px 60px -16px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          <Render data={data} />
        </div>
      </div>

      {/* Scoped style — keeps the responsive overlay padding close to the
          layout that uses it (same pattern as ReviewStep). */}
      <style>{`
        .ff-preview-overlay {
          padding: 32px 32px 16px;
        }
        @media (max-width: 640px) {
          .ff-preview-overlay { padding: 20px 16px 12px; }
        }
      `}</style>
    </div>
  );
};
