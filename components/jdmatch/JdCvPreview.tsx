"use client";

import { useEffect, useRef, useState } from "react";
import { PreviewPanel } from "../preview/PreviewPanel";
import { useCvStore } from "../../lib/store/cvStore";
import { getTemplateById } from "../../lib/templates";

const A4_W = 794;

// A change the user just applied, so we can confirm it and flash it in the CV.
export type JdChange = {
  kind: "skill" | "cert" | "bullet";
  /** Text to locate + highlight in the rendered CV. */
  text: string;
  /** Human-readable confirmation, e.g. 'Added "Power BI" to your Skills'. */
  label: string;
  /** Optional caveat (e.g. a woven keyword that stayed a paraphrase). */
  warning?: string;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Live A4 CV preview for the JD Match split view. Renders the SAME template
 * the builder uses (read-only, from the store), scaled to fit the pane width
 * and scrolling vertically — so the user can see their CV while closing gaps,
 * and watch each applied fix land. When a fix is applied (`lastChange`), the
 * affected skill line or bullet is scrolled into view and flashed.
 *
 * The flash is applied imperatively (classList) to the rendered template node
 * located by its text — the templates themselves are never modified (they feed
 * the PDF/DOCX export and must stay untouched). A transient class is safe: if
 * React re-renders the node, the class prop is unchanged so the DOM class is
 * left alone, and our timer removes it regardless.
 */
export const JdCvPreview = ({
  lastChange,
  autoFocusOnMount = false,
}: {
  lastChange: JdChange | null;
  /** Move focus into the preview when it mounts (mobile: opened via the
   *  toggle or "View in CV", whose own button unmounts) so keyboard/SR focus
   *  doesn't fall to <body>. Off on desktop, where the preview never unmounts. */
  autoFocusOnMount?: boolean;
}) => {
  const templateId = useCvStore((s) => s.data.settings.templateId);
  const template = getTemplateById(templateId);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [contentHeight, setContentHeight] = useState(1123);

  // Fit-width scaling — same proven pattern as the builder preview drawer:
  // the spacer carries the scaled height so the wrap scrolls correctly while
  // the content stays 794px wide (scale-independent scrollHeight).
  useEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const update = () => {
      const w = wrap.clientWidth;
      const ch = content.scrollHeight;
      if (w <= 0 || ch <= 0) return;
      setScale(Math.min(w / A4_W, 1));
      setContentHeight(ch);
    };
    update();
    const wrapObs = new ResizeObserver(update);
    const contentObs = new ResizeObserver(update);
    wrapObs.observe(wrap);
    contentObs.observe(content);
    return () => {
      wrapObs.disconnect();
      contentObs.disconnect();
    };
  }, []);

  // Flash + scroll to the most recent change. Runs on mount too, so when the
  // mobile "Your CV" tab is opened after a fix, the change is shown.
  useEffect(() => {
    if (!lastChange) return;
    const target = norm(lastChange.text);
    if (!target) return;

    let flashed: HTMLElement | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;

    // A short delay so the re-render (new skill / rewritten bullet) and the
    // scale transform have settled before we measure and flash. setTimeout
    // (not rAF) so it still fires in headless/!visible renderers.
    const startTimer = setTimeout(() => {
      const wrap = wrapRef.current;
      const content = contentRef.current;
      if (!wrap || !content) return;

      // Smallest element whose text contains the change (a <li> for a bullet,
      // the skills/cert line for an added term) — the most specific highlight.
      const candidates: Array<{ el: HTMLElement; len: number }> = [];
      content.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const t = norm(el.textContent || "");
        if (t.includes(target)) candidates.push({ el, len: t.length });
      });
      if (candidates.length === 0) return;
      const node = candidates.reduce((a, b) => (b.len < a.len ? b : a)).el;

      flashed = node;
      node.classList.add("jd-flash");

      // Bring the node ~30% down from the top of the scroll viewport, computed
      // from live rects so it is correct through the CSS scale transform.
      const wrapRect = wrap.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const delta = nodeRect.top - wrapRect.top - wrap.clientHeight * 0.3;
      wrap.scrollTo({ top: Math.max(0, wrap.scrollTop + delta), behavior: "smooth" });

      removeTimer = setTimeout(() => node.classList.remove("jd-flash"), 2600);
    }, 60);

    return () => {
      clearTimeout(startTimer);
      if (removeTimer) clearTimeout(removeTimer);
      flashed?.classList.remove("jd-flash");
    };
  }, [lastChange]);

  // On mobile the preview mounts when the user opens it (toggle or the
  // "View in CV" shortcut, whose own button is then unmounted). Move focus
  // into the preview region so keyboard / screen-reader focus has somewhere to
  // land instead of falling to <body>.
  useEffect(() => {
    if (autoFocusOnMount) wrapRef.current?.focus({ preventScroll: true });
  }, [autoFocusOnMount]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 14px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ff-muted)",
          }}
        >
          Your live CV · updates as you apply fixes
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ff-faint)",
            whiteSpace: "nowrap",
          }}
        >
          {template.name}
        </span>
      </div>

      <div
        ref={wrapRef}
        tabIndex={-1}
        role="region"
        aria-label="Your CV preview"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          background: "var(--ff-sunken)",
          borderRadius: 14,
          border: "1px solid var(--ff-line)",
          position: "relative",
          padding: "16px 0",
          outline: "none",
        }}
      >
        <div style={{ position: "relative", height: contentHeight * scale }}>
          <div
            ref={contentRef}
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: A4_W,
              transformOrigin: "top center",
              transform: `translateX(-50%) scale(${scale})`,
              background: "white",
              boxShadow: "0 8px 28px rgba(11,15,12,0.12)",
            }}
          >
            <PreviewPanel sticky={false} />
          </div>
        </div>
      </div>

      <style>{`
        .jd-flash {
          animation: jd-flash-kf 2.6s ease-out;
          border-radius: 4px;
        }
        @keyframes jd-flash-kf {
          0%, 18% {
            background: var(--ff-accent-soft);
            box-shadow: 0 0 0 4px var(--ff-accent-soft), 0 0 0 5px var(--ff-accent-ring);
          }
          100% {
            background: transparent;
            box-shadow: 0 0 0 0 transparent;
          }
        }
      `}</style>
    </div>
  );
};
