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
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
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
        },
      ],
    })),
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
