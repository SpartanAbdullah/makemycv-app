"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/* Generic client-side error boundary (audit 2026-06-12, gap #2).
 *
 * Next.js route-level error.tsx files catch page-tree crashes, but they
 * unmount the WHOLE segment — for the builder that means the form dies
 * with the preview. This class boundary lets us isolate high-risk render
 * islands (template preview, modals) so a crash in one island leaves the
 * rest of the app fully interactive.
 *
 * Usage:
 *   <ErrorBoundary fallback={(reset) => <MyFallback onRetry={reset} />}>
 *     <RiskyIsland />
 *   </ErrorBoundary>
 *
 * `resetKeys` — when any value in this array changes, the boundary
 * auto-clears. We use it with templateId so picking another template
 * after a template crash recovers without a manual retry click.
 */

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Render-prop fallback; receives a reset callback. */
  fallback: (reset: () => void, error: Error | null) => ReactNode;
  /** Auto-reset when any of these values change (e.g. templateId). */
  resetKeys?: ReadonlyArray<unknown>;
  /** Optional hook for logging/telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

const keysChanged = (
  a: ReadonlyArray<unknown> = [],
  b: ReadonlyArray<unknown> = [],
) => a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console is our telemetry until an error monitor (Sentry) lands —
    // Vercel captures these in the function/browser logs.
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      this.state.error !== null &&
      keysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error !== null) {
      return this.props.fallback(this.reset, this.state.error);
    }
    return this.props.children;
  }
}
