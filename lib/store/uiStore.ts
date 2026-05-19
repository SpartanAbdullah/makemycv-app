import { create } from "zustand";

/**
 * Builder-only UI state — kept out of useCvStore so it doesn't get persisted
 * to localStorage with the CV. Right now we use it for two things:
 *
 *  - previewDrawerOpen: whether the right-anchored preview drawer is showing
 *    as a fullscreen overlay on lg-and-below screens.
 *  - currentTipIndex: which UAE tip the Today's Tip card is showing, in user-
 *    cycled state. Initial value is the per-day rotation (computed in the
 *    component); -1 means "not yet user-overridden, use the rotation".
 */
type UiState = {
  previewDrawerOpen: boolean;
  setPreviewDrawerOpen: (v: boolean) => void;
  currentTipIndex: number;
  setCurrentTipIndex: (n: number) => void;
};

export const useUiStore = create<UiState>((set) => ({
  previewDrawerOpen: false,
  setPreviewDrawerOpen: (v) => set({ previewDrawerOpen: v }),
  currentTipIndex: -1,
  setCurrentTipIndex: (n) => set({ currentTipIndex: n }),
}));
