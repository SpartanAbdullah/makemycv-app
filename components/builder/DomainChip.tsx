"use client";

import { useCvStore } from "../../lib/store/cvStore";
import { canTailorByDomain } from "../../lib/utils/entitlements";
import {
  ROLE_FAMILY_LABELS,
  SELECTABLE_ROLE_FAMILIES,
} from "../../lib/data/roleFamily";
import type { RoleFamily } from "../../lib/types/cv";
import { Icon } from "./Icon";

/**
 * Premium one-tap domain confirm chip under the Headline field.
 *
 * PersonalStep infers the domain from the headline on blur (high-confidence
 * only) and writes settings.domain with domainSource "inferred". This chip
 * confirms/overrides it in one tap; a manual pick locks domainSource to "user"
 * so future headline edits never clobber it.
 *
 * The control is a native <select> with `appearance: none` + a custom chevron —
 * it looks bespoke (sparkle glyph, sentence-case label, accent value) but keeps
 * native accessibility and zero popover/click-outside state.
 */
export const DomainChip = () => {
  const settings = useCvStore((s) => s.data.settings);
  const headline = useCvStore((s) => s.data.personal.headline);
  const updateSection = useCvStore((s) => s.updateSection);

  if (!canTailorByDomain()) return null;

  const domain = settings.domain;
  const hasHeadline = Boolean(headline?.trim());
  // Nothing to tailor before the user names a role.
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

  const accent = active ? "var(--ff-accent)" : "var(--ff-muted)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        marginTop: 10,
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--ff-accent)" : "var(--ff-line)"}`,
        background: active ? "var(--ff-accent-soft)" : "var(--ff-paper)",
        maxWidth: "100%",
      }}
    >
      <span style={{ display: "inline-flex", color: accent, flexShrink: 0 }}>
        <Icon name="sparkle" size={13} />
      </span>
      {active && (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12.5,
            color: "var(--ff-muted)",
            whiteSpace: "nowrap",
          }}
        >
          Tailored for
        </span>
      )}
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <select
          value={domain ?? ""}
          onChange={(e) => handlePick(e.target.value)}
          aria-label="Choose the job domain to tailor this CV for"
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            border: "none",
            background: "transparent",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            color: active ? "var(--ff-accent)" : "var(--ff-ink-2)",
            cursor: "pointer",
            paddingRight: 18,
            maxWidth: "100%",
          }}
        >
          {!active && (
            <option value="" disabled>
              Tailor this CV to your field…
            </option>
          )}
          {SELECTABLE_ROLE_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {ROLE_FAMILY_LABELS[f]}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 0,
            display: "inline-flex",
            pointerEvents: "none",
            color: accent,
          }}
        >
          <Icon name="chevron-down" size={13} />
        </span>
      </span>
    </div>
  );
};
