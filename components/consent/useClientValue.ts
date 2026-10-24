"use client";

import { useSyncExternalStore } from "react";

/**
 * Read a browser-only value (cookie, localStorage) without a setState-in-
 * effect: `ssr` is what the server and the first client render see, `read`
 * runs on the client after hydration. `read` must return a primitive (or a
 * stable reference) so React can compare snapshots. Call `notifyClientValues()`
 * after writing the underlying storage to re-render subscribers.
 *
 * Shared, byte-identical, between makemycv-app and makemycv-site.
 */

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const notifyClientValues = () => listeners.forEach((cb) => cb());

export function useClientValue<T extends string | number | boolean | null>(read: () => T, ssr: T): T {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return read();
      } catch {
        return ssr;
      }
    },
    () => ssr,
  );
}
