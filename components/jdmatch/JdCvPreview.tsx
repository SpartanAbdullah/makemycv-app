"use client";

import { useEffect, useRef, useState } from "react";
import { PreviewPanel } from "../preview/PreviewPanel";
import type { CvData } from "../../lib/types/cv";

const A4_W = 794;

// A change the user just staged, so we can highlight it in the CV.
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
 * Live A4 CV preview for the JD Match split view. Renders the SAME template the
 * builder/PDF use (read-only), scaled to FILL the pane width — up to 1.5× true
 * A4 so the review copy is large and clear (it's HTML, so scaling up stays
 * crisp). `data` is the CV to show (the panel passes the staged working CV, or
 * the base CV when the user hides changes). When a fix is staged (`lastChange`)
 * the affected skill line or bullet is scrolled into view and flashed.
 *
 * The flash is applied imperatively to the rendered template node located by
 * its text — templates are never modified (they feed the PDF/DOCX export). A
 * transient class is safe: React leaves an unchanged className prop alone, and
 * our timer + cleanup remove it regardless. setTimeout (not rAF) so it fires in
 * headless / non-painting renderers too.
 */
export const JdCvPreview = ({
  data,
  lastChange,
  autoFocusOnMount = false,
}: {
  data: CvData;
  lastChange: JdChange | null;
  /** Move focus into the preview when it mounts (mobile: opened via the toggle
   *  or "View in CV", whose own button unmounts) so focus doesn't fall to
   *  <body>. Off on desktop, where the preview never unmounts. */
  autoFocusOnMount?: boolean;
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.6);
  const [contentHeight, setContentHeight] = useState(1123);

  // Fit-width scaling — the builder's proven spacer/transform pattern, but
  // capped at 1.5 (not 1) so the CV fills wide panes for a clearer review.
  useEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const update = () => {
      const w = wrap.clientWidth;
      const ch = content.scrollHeight;
      if (w <= 0 || ch <= 0) return;
      setScale(Math.min(w / A4_W, 1.5));
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

  // Flash + scroll to the most recent staged change. Runs on mount too, so the
  // mobile "Your CV" tab (opened after a fix) shows it.
  useEffect(() => {
    if (!lastChange) return;
    const target = norm(lastChange.text);
    if (!target) return;

    let flashed: HTMLElement | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;

    // Short delay so the re-render (new skill / rewritten bullet) and scale
    // transform have settled before we measure and flash.
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

  // Move focus into the preview when it mounts on mobile (see prop docs).
  useEffect(() => {
    if (autoFocusOnMount) wrapRef.current?.focus({ preventScroll: true });
  }, [autoFocusOnMount]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div
        ref={wrapRef}
        tabIndex={-1}
        role="region"
        aria-label="Your CV preview"
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          background: "var(--ff-sunken)",
          borderRadius: 14,
          border: "1px solid var(--ff-line)",
          position: "relative",
          padding: "20px 0",
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
              boxShadow: "0 8px 30px rgba(11,15,12,0.14)",
            }}
          >
            <PreviewPanel sticky={false} data={data} />
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
