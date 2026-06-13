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
 * Highlighting marks EXACTLY what was staged: every entry in `highlights` (each
 * added skill, each rewritten bullet) is tinted in place via the CSS Custom
 * Highlight API — so a single added skill stands out inside the comma-separated
 * skills line (not the whole section), and the same term is marked wherever
 * else it appears (e.g. a bullet that already mentions it). This is view-only:
 * it never mutates the template DOM (which feeds the PDF/DOCX export) and never
 * prints. Where the API is unavailable, we fall back to a one-shot flash of the
 * most-recently-changed element. `lastChange` is also scrolled into view.
 */
export const JdCvPreview = ({
  data,
  highlights,
  lastChange,
  autoFocusOnMount = false,
}: {
  data: CvData;
  /** Exact texts to persistently tint in the CV (staged skills + bullets). */
  highlights: string[];
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

  // Persistent per-item highlight via the CSS Custom Highlight API: tint the
  // EXACT text of every staged change (each skill, each rewritten bullet) in
  // place, wherever it appears — without mutating the template DOM. Re-runs
  // after each render (data change) so ranges point at fresh text nodes.
  useEffect(() => {
    const content = contentRef.current;
    const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!content || !registry || typeof HighlightCtor !== "function") return;

    const targets = highlights.map((h) => h.trim().toLowerCase()).filter(Boolean);
    if (targets.length === 0) {
      (registry as { delete: (k: string) => void }).delete("jd-added");
      return;
    }

    // Whole-word(ish) boundary so highlighting "SQL" doesn't tint "MySQL", nor
    // "Java" tint "JavaScript".
    const isBoundary = (ch: string | undefined) => ch === undefined || !/[a-z0-9]/i.test(ch);
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const lc = (node.nodeValue ?? "").toLowerCase();
      for (const t of targets) {
        let idx = lc.indexOf(t);
        while (idx !== -1) {
          if (isBoundary(lc[idx - 1]) && isBoundary(lc[idx + t.length])) {
            const r = new Range();
            r.setStart(node, idx);
            r.setEnd(node, idx + t.length);
            ranges.push(r);
          }
          idx = lc.indexOf(t, idx + 1);
        }
      }
      node = walker.nextNode();
    }
    (registry as { set: (k: string, v: unknown) => void }).set(
      "jd-added",
      new HighlightCtor(...ranges),
    );
    return () => (registry as { delete: (k: string) => void }).delete("jd-added");
  }, [highlights, data]);

  // Scroll the most recent change into view (and, where the Highlight API is
  // unavailable, fall back to a one-shot flash of its element so there is still
  // a visible cue). Runs on mount too, so the mobile "Your CV" tab shows it.
  useEffect(() => {
    if (!lastChange) return;
    const target = norm(lastChange.text);
    if (!target) return;
    const highlightSupported =
      !!(CSS as unknown as { highlights?: unknown }).highlights &&
      typeof (globalThis as unknown as { Highlight?: unknown }).Highlight === "function";

    let flashed: HTMLElement | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;

    const startTimer = setTimeout(() => {
      const wrap = wrapRef.current;
      const content = contentRef.current;
      if (!wrap || !content) return;

      // Smallest element whose text contains the change — the scroll anchor.
      const candidates: Array<{ el: HTMLElement; len: number }> = [];
      content.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const t = norm(el.textContent || "");
        if (t.includes(target)) candidates.push({ el, len: t.length });
      });
      if (candidates.length === 0) return;
      const node = candidates.reduce((a, b) => (b.len < a.len ? b : a)).el;

      const wrapRect = wrap.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const delta = nodeRect.top - wrapRect.top - wrap.clientHeight * 0.3;
      wrap.scrollTo({ top: Math.max(0, wrap.scrollTop + delta), behavior: "smooth" });

      if (!highlightSupported) {
        flashed = node;
        node.classList.add("jd-flash");
        removeTimer = setTimeout(() => node.classList.remove("jd-flash"), 2600);
      }
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
        /* Persistent "added via JD Match" tint on the exact staged text. */
        ::highlight(jd-added) {
          background-color: var(--ff-accent-soft);
          color: var(--ff-accent-dark);
        }
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
