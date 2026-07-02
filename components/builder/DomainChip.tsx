"use client";

import { useCvStore } from "../../lib/store/cvStore";
import { canTailorByDomain } from "../../lib/utils/entitlements";
import {
  ROLE_FAMILY_LABELS,
  SELECTABLE_ROLE_FAMILIES,
} from "../../lib/data/roleFamily";
import type { RoleFamily } from "../../lib/types/cv";

/**
 * The one-tap domain confirm chip that sits under the Headline field.
 *
 * PersonalStep infers the domain from the headline on blur (high-confidence
 * only) and writes settings.domain with domainSource "inferred". This chip:
 *  - shows "Tailoring for: <label>" when a domain is set (0 taps if correct),
 *  - shows a "Pick your field" prompt when inference was low-confidence/empty,
 *  - lets the user override in one tap, which locks domainSource to "user" so
 *    future headline edits never clobber the manual pick.
 *
 * Uses a native <select> on purpose: accessible, reliable, zero popover state.
 */
export const DomainChip = () => {
  const settings = useCvStore((s) => s.data.settings);
  const headline = useCvStore((s) => s.data.personal.headline);
  const updateSection = useCvStore((s) => s.updateSection);

  if (!canTailorByDomain()) return null;

  const domain = settings.domain;
  const hasHeadline = Boolean(headline?.trim());
  // Don't show the chip before the user has named a role and before we have
  // anything to tailor.
  if (!domain && !hasHeadline) return null;

  const active = Boolean(domain);

  const handlePick = (value: string) => {
    const next = value ? (value as RoleFamily) : undefined;
    updateSection("settings", {
      ...settings,
      domain: next,
      domainSource: next ? "user" : settings.domainSource,
    });
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
        padding: "5px 10px 5px 11px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--ff-accent)" : "var(--ff-line)"}`,
        background: active ? "var(--ff-accent-soft)" : "var(--ff-paper)",
        maxWidth: "100%",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          flexShrink: 0,
          background: active ? "var(--ff-accent)" : "var(--ff-muted)",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ff-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {active ? "Tailoring for" : "Tailor this CV"}
      </span>
      <select
        value={domain ?? ""}
        onChange={(e) => handlePick(e.target.value)}
        aria-label="Choose the job domain to tailor this CV for"
        style={{
          appearance: "auto",
          border: "none",
          background: "transparent",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ff-ink)",
          cursor: "pointer",
          maxWidth: "100%",
          padding: 0,
        }}
      >
        {!active && (
          <option value="" disabled>
            Pick your field…
          </option>
        )}
        {SELECTABLE_ROLE_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {ROLE_FAMILY_LABELS[f]}
          </option>
        ))}
      </select>
    </div>
  );
};
