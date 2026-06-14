"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Textarea that grows to fit its content (and shrinks back), replacing the
 * fixed rows={2} boxes that scrolled internally.
 *
 * react-hook-form friendly: forward the register(...) spread as usual — the
 * ref is merged, and resizing hooks onInput so RHF's own onChange is
 * untouched. Programmatic value changes (AI suggestion accept, update(),
 * import) don't fire onInput, but they do re-render the owning step (every
 * step watches its form), so an every-render check resyncs the height when
 * the element's value differs from the last measured one.
 */
type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Floor in px so an empty field doesn't collapse to one line. */
  minHeight?: number;
};

export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function AutoGrowTextarea({ minHeight = 56, style, onInput, ...rest }, outerRef) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const lastValue = useRef<string | null>(null);

    const resize = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      lastValue.current = el.value;
      el.style.height = "auto";
      el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
    }, [minHeight]);

    // Merge our ref with the forwarded (register) ref.
    const setRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el;
        if (typeof outerRef === "function") outerRef(el);
        else if (outerRef) outerRef.current = el;
        if (el) resize();
      },
      [outerRef, resize],
    );

    // Catch programmatic value changes that bypass onInput (runs every
    // render on purpose — the owning step re-renders on any form update).
    useEffect(() => {
      const el = innerRef.current;
      if (el && el.value !== lastValue.current) resize();
    });

    return (
      <textarea
        {...rest}
        ref={setRef}
        rows={1}
        onInput={(e) => {
          resize();
          onInput?.(e);
        }}
        style={{
          ...style,
          minHeight,
          resize: "none",
          overflow: "hidden",
        }}
      />
    );
  },
);
