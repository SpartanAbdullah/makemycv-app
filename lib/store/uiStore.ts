import { create } from "zustand";

/**
 * Builder-only UI state — kept out of useCvStore so it doesn't get persisted
 * to localStorage with the CV. Everything in here is deliberately ephemeral:
 *
 *  - previewDrawerOpen: whether the right-anchored preview drawer is showing
 *    as a fullscreen overlay on lg-and-below screens.
 *  - currentTipIndex: which UAE tip the Today's Tip card is showing, in user-
 *    cycled state. Initial value is the per-day rotation (computed in the
 *    component); -1 means "not yet user-overridden, use the rotation".
 *  - toasts: the in-house toast queue (guided-feedback work, 2026-06).
 *    Rendered by components/ui/Toaster.tsx inside an aria-live region.
 *  - visitedSections: which builder sections the user has navigated away
 *    from this page-load. Drives the amber "needs attention" bead state —
 *    an UNTOUCHED incomplete section stays neutral so a fresh user isn't
 *    greeted by four warnings. Session-only by design (never persisted).
 */

export type ToastTone = "success" | "notice";

export type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  /** Auto-dismiss delay in ms. */
  duration: number;
  /** Optional action button (e.g. "Undo") rendered next to the text. */
  actionLabel?: string;
  onAction?: () => void;
};

let toastSeq = 0;

type UiState = {
  previewDrawerOpen: boolean;
  setPreviewDrawerOpen: (v: boolean) => void;
  currentTipIndex: number;
  setCurrentTipIndex: (n: number) => void;

  toasts: Toast[];
  pushToast: (
    text: string,
    opts?: {
      tone?: ToastTone;
      duration?: number;
      actionLabel?: string;
      onAction?: () => void;
    },
  ) => void;
  dismissToast: (id: number) => void;

  visitedSections: Record<string, true>;
  markSectionVisited: (id: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  previewDrawerOpen: false,
  setPreviewDrawerOpen: (v) => set({ previewDrawerOpen: v }),
  currentTipIndex: -1,
  setCurrentTipIndex: (n) => set({ currentTipIndex: n }),

  toasts: [],
  pushToast: (text, opts) =>
    set((s) => {
      const next = {
        id: ++toastSeq,
        text,
        tone: opts?.tone ?? "notice",
        // Action toasts (e.g. Undo) must stay reachable — never shorter
        // than the 6s default, even if a caller passes a short duration.
        duration: opts?.onAction
          ? Math.max(opts?.duration ?? 6000, 6000)
          : (opts?.duration ?? 6000),
        actionLabel: opts?.actionLabel,
        onAction: opts?.onAction,
      };
      // Replace, don't stack (audit F03): four "… section done ✓" toasts
      // piled up and covered the skills chips and the drawer footer. A new
      // action-less toast replaces any visible action-less toast of the same
      // tone; action toasts (Undo) are never displaced by a plain one. The
      // queue is then capped at two visible cards, oldest plain toast first.
      let toasts = next.onAction
        ? s.toasts
        : s.toasts.filter((t) => t.onAction || t.tone !== next.tone);
      toasts = [...toasts, next];
      while (toasts.length > 2) {
        const idx = toasts.findIndex((t) => !t.onAction && t.id !== next.id);
        if (idx === -1) break;
        toasts = toasts.filter((_, i) => i !== idx);
      }
      return { toasts };
    }),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  visitedSections: {},
  markSectionVisited: (id) =>
    set((s) =>
      s.visitedSections[id]
        ? s
        : { visitedSections: { ...s.visitedSections, [id]: true } },
    ),
}));
