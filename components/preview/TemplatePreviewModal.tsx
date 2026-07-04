"use client";

import { useEffect, useState, useLayoutEffect, useRef } from "react";
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

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,15,12,0.55)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        padding: "32px 32px 16px 32px",
      }}
    >
      {/* Header bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
        <div style={{ display: "flex", gap: 10 }}>
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
            }}
          >
            {isSelected ? "Selected" : "Use this template"}
          </button>
          <button
            type="button"
            onClick={() => onDownload(templateId)}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "var(--ff-accent)",
              color: "white",
              cursor: "pointer",
            }}
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
    </div>
  );
};
