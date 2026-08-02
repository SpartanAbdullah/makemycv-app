# DECISION LOG

This file documents major product/business decisions and the reasoning behind them.
Entries are append-only and chronological. Future-me, future-AI: read before changing direction.

---

## 2026-05-31 — Pricing Model Pivot: Paid Pro → Free + Voluntary Support

### What changed
MakeMyCV transitions from a "free + paid Pro tier" model to a fully free tool with voluntary support (tip jar) for users who wish to contribute toward hosting and AI costs.

### Why
1. **Legal (UAE).** Commercial activity from within the UAE requires a trade licence. Operating a paid SaaS as an unlicensed individual carries asymmetric risk: PayPal/Stripe 180-day fund holds, potential conflicts with Federal Commercial Companies Law and labour rules on outside employment. Solo founder is currently employed full-time at Interior360 General Trading LLC; no freelance permit yet obtained.
2. **Sequencing.** Founder is pre-launch, pre-revenue. Path B (obtain UAE freelance permit, then build commercial product properly) is the correct upgrade trigger AFTER product-market fit is validated, not before. Cost: AED 7,500–22,000/year depending on free zone.
3. **Honesty.** Existing "$5 per download" copy and disabled "Coming Soon" Pro buttons constitute false advertising. The earlier audit (AUDIT.md, AUDIT_APP.md) already flagged this as a trust/legal liability. This pivot resolves it.
4. **Operational focus.** Removes payment-processor compliance burden during validation phase. Effort redirects to growth, content, Arabic/RTL, UAE-specific CV fields.

### Payment infrastructure
- PayPal personal account upgraded to **Business account** on 2026-05-31.
- Operating identity: Individual (not Sole Proprietorship — UAE distinction).
- Business category: MCC 7372 (Computer Programming, Data Processing, and Integrated Systems Design Services).
- Primary currency: USD.
- Tip collection mechanism: `paypal.me/[handle]` link with optional preset amounts.
- No checkout integration, no PayPal SDK, no Stripe, no Tap.

### What this affects

**Marketing site (`makemycv-site`):**
- `/pricing` page repurposed → 301 redirect to `/support`
- New `/support` page: explains free model + houses tip jar
- New `/thanks` page: post-tip return destination
- New `TipJar` component (reusable across site and app)
- All "Pro", "Premium", "Upgrade", "$5", "subscription" copy removed
- Footer adds "Support" link

**Builder app (`makemycv-app`):**
- All paywall gates removed (AI rewriter, downloads, templates, etc.)
- "Coming Soon" disabled buttons removed entirely
- "$5 per download" copy removed
- AI features remain free but rate-limited per IP via Upstash
- Tip jar surfaces post-success: after PDF download, after ATS check
- localStorage `isPro` flag deprecated (handled in code, kept as no-op for one release for backward compat)

### What was deferred (post-licence Phase 2)
- Pro tier development
- Stripe + Tap integration
- Subscription / one-time payment flows
- Coupon / promo code system
- B2B features
- Multi-CV save (originally Pro-gated)

### Trigger conditions for revisiting (Path B activation)
Any one of:
- Sustained traffic > 1,000 MAU for 3 consecutive months
- Sustained monthly support tips > AED 1,500 for 3 consecutive months
- Clear B2B opportunity (HR partner, recruitment agency, etc.) with concrete commercial interest
- Specific UAE government / hiring program partnership

When triggered: obtain UAE freelance permit → reinstate Pro tier → integrate Stripe + Tap → migrate PayPal Business account under the licensed entity.

### References
- Original audit findings: `AUDIT.md`, `AUDIT_APP.md`
- Roadmap: `ROADMAP.md` (Pro tier moved to "Phase 2 — Post-Licence")

---

## 2026-05-31 — DownloadTipModal: Pre-Download Gate → Post-Download Surface

### What changed
The DownloadTipModal shipped in commit 116c4aa as a pre-download gate that blocked the download behind a tip choice with a `reminder` (guilt-trip) fallback phase. This was rolled back to a post-download non-blocking surface.

### Why
1. **Brand consistency.** The marketing site's `/support` page states: "This is a tip jar, not a paywall. Every feature is free for everyone, tip or no tip." The pre-download gate, however soft, was structurally a paywall surface — the user had to acknowledge a tip ask before reaching the deliverable. Cross-property dissonance erodes trust.
2. **Confirmshaming pattern.** The `reminder` phase ("heart-break emoji," "I really can't right now 😢" skip button) is a recognized dark pattern. Short-term conversion lift, long-term brand damage.
3. **Wrong emotional moment.** UAE job seekers downloading a CV are typically anxious and time-pressed. Tip conversion is healthier at the gratitude peak (after success) than at the urgency peak (before success).
4. **Compliance posture.** A passive post-success tip prompt is unambiguously a tip jar. A pre-download tip-or-skip gate is ambiguously transactional, which carries higher risk for an unlicensed operating identity.

### What stayed (engineering preserved)
- Modal infrastructure
- Picking phase: presets, custom amount, emoji escalation
- Thanks phase: name personalization, spread-the-word with Copy share link, feedback link
- Print-hide CSS rule
- Suppression via `localStorage.mmcv_tipped_at` (90 days)

### What was removed
- `reminder` phase entirely (heart-break copy, sad-emoji skip button)
- `downloading` phase (download now runs in parent, modal appears after)
- `error` phase (parent handles download errors)
- `triggerDownload` prop on modal
- "Download without supporting 😔" secondary button
- Coupled "Tip $X · Download CV" primary CTA → decoupled to "Tip $X via PayPal"

### Trigger that prompted this revert
Post-implementation review flagged the brand-promise inconsistency and confirmshaming pattern before the change merged to `main`. Reverted while still on `stagingmmc`.

---

## 2026-05-31 — Final Tip Surface: Ko-fi Primary + PayPal Secondary

### Outcome
Tip rail consolidated to Ko-fi as primary (`ko-fi.com/makemycv_ae`), PayPal as secondary (`paypal.me/Abdullah2431`).

### Path taken to get here
1. Initial plan: PayPal-only via `paypal.me/Abdullah2431/[amount]USD` deep links with custom amount tiles + emoji feedback.
2. Incognito test revealed `paypal.me` does not offer guest card checkout — users without PayPal accounts are blocked.
3. Pivoted to Buy Me a Coffee (BMC). Onboarded via BMC's Stripe Connect Express path. Reached final KYC step where Stripe required a UAE trade licence / freelancer permit (Path B). Cancelled the BMC submission without uploading anything.
4. Pivoted to Ko-fi with PayPal as the payout method. Bypasses Stripe entirely. Onboarding completed cleanly. End-to-end test transaction $3 → $2.58 landed in PayPal Business balance (~14% combined PayPal processing + FX fee).

### Why Ko-fi-with-PayPal-payout works where BMC-with-Stripe didn't
Ko-fi offers PayPal as a payout method alternative. The supporter pays via Ko-fi's commercial PayPal checkout (which DOES offer guest card, unlike paypal.me's P2P rail). The PayPal Business account (already set up) acts as the merchant relationship. Stripe's UAE-individual trade-licence requirement is never hit because Stripe is not in the loop.

### Trade-offs accepted
- ~14% combined fee (PayPal processing + USD→AED FX conversion) vs Stripe's ~3-5% if Stripe were available
- Ko-fi's brand recognition is lower than BMC's — mitigated by the trust-anchor microcopy ("Built by Abdullah") and the in-app Ko-fi cup icon for instant recognition
- Amount picker is delegated to Ko-fi's page (we don't deep-link amounts) — simpler UI, slightly less conversion control

### What changed in code (this commit)
- All tip surfaces (TipJar, TipJarModal, DownloadTipModal, PostReportTipJar) now use Ko-fi as primary, PayPal as secondary
- Amount tiles + custom amount input + amount-based emoji feedback REMOVED (Ko-fi handles amount on their page)
- Added `KofiIcon` component using the brand asset in `public/`
- Added env var `NEXT_PUBLIC_KOFI_USERNAME=makemycv_ae`
- Kept env var `NEXT_PUBLIC_PAYPAL_ME_HANDLE=Abdullah2431`
- Microcopy rewritten to reference Ko-fi primary + PayPal alternative + Abdullah personally

### What stays from earlier iterations
- Post-download (not pre-download) surfacing pattern for DownloadTipModal (Prompt 3 refactor stands)
- 90-day `mmcv_tipped_at` suppression in localStorage
- Module-level session suppression (cross-component)
- All print-hide CSS rules for tip surfaces
- `isPro` flag in Zustand store (deprecated, forced true, NOT deleted for back-compat)

### Path B triggers (revisit if any hit)
- Sustained traffic >1,000 MAU for 3 consecutive months
- Sustained monthly tips >AED 1,500 for 3 consecutive months
- Concrete B2B opportunity
- → When triggered: obtain UAE freelance permit, reinstate Pro tier, integrate Stripe direct

---

## 2026-06-12 — Path B UNLOCKED: Trade Licence Obtained; Pro/Coupon Deletion Cancelled

### What changed
1. **Founder obtained a UAE business licence (June 2026); corporate bank account opening starts next.** The legal blocker behind the 2026-05-31 free pivot is resolved.
2. **The planned deletion of the Pro/coupon scaffolding is CANCELLED.** `isPro`, `proAccessSource`, `lib/config/coupons.ts`, `/api/coupons/apply`, and `lib/server/couponRedemptions.ts` stay in the codebase. They will be revived for the paid tier rather than rebuilt. Code comments updated from "TODO: remove" to "KEEP".
3. Tip jar remains live during the transition; paid plans/models/offers to be designed next (Stripe + Tap, UAE-localized pricing).

### Why
- The free pivot was a licensing workaround, not a business-model conviction. With the licence in hand, monetization work resumes deliberately: payment plans, models, offers — sequenced after the cvtoolspro-style builder upgrade and JD Match.
- Keeping the dormant scaffolding saves rebuild effort and preserves the documented access-state patterns (localStorage keys, coupon validation, redemption flow). Known caveat to fix on revival: JSON-file coupon redemptions are broken on serverless — move to Vercel KV/DB before any real gating.

### Also shipped today (2026-06-12)
- Error boundaries across both repos: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` in both; `app/builder/error.tsx`, `app/resume-checker/error.tsx`, and a reusable `components/ui/ErrorBoundary.tsx` isolating the template preview island in the app. All copy reassures users their CV data is browser-local and safe.
- Stale-doc banners added: AUDIT_APP.md (historical), smoke-test docs ($5 CTA renamed).

### New product directions registered (specs/strategy to follow)
- cvtoolspro.com-style split-screen builder UX with custom actions + user-controlled CV formatting (UAE essentials retained).
- JD Match (existing spec) with a hardened parser.
- Soft-skills mapping for UAE work culture (expat-focused).
- Admin portal (founder), Partner program (typing centers + HR professionals).
- Pipeline (explicitly deferred): cover letter generator, application tracker.

---

## 2026-08-02 — Rate limiter: IP retention stopped, fail-open closed

Arising from the external technical audit (Audit A, findings A-W3-001, A-W2-001, A-W1-019).
Recorded here because both defects were **invisible from the code that appeared to handle
them** — the comments claimed protection that did not exist, which is exactly the failure
mode a decision log is for.

### What was wrong

**1. We were retaining client IP addresses forever, against our own privacy policy.**

All eight `Ratelimit` constructors (two windows × four AI routes) were built with
`analytics: true`. That flag is an **Upstash feature flag, not a telemetry tool** — the name
misled. `@upstash/ratelimit` asks `@upstash/core-analytics` for `retention: "90d"`, but
core-analytics 0.0.10 never reads that option. Its `ingest` is a single `ZINCRBY` and issues no
`EXPIRE` — verified: `grep -c -i expire node_modules/@upstash/core-analytics/dist/index.js`
returns **0**.

The identifier it records is the raw client IP. So every rate-limited request since that flag
was added wrote a personal identifier into KV permanently, while
`makemycv-site/app/privacy/page.tsx` told users their IP is "held briefly in short-lived
storage" and granted an erasure right we could not service. Nothing in the product ever read
that data back. It was also the only unbounded growth in KV.

**2. Per-IP rate limiting silently disengaged whenever Upstash was slow.**

`@upstash/ratelimit@2.0.8` defaults to `timeout: 5000`, and on expiry it **resolves**
`{ success: true, limit: 0, remaining: 0, reset: 0, reason: "timeout" }` — it does not throw.
Verified directly in `node_modules/@upstash/ratelimit/dist/index.mjs`
(`this.timeout = config.timeout ?? 5e3`, and the `setTimeout` that resolves `success: true`).

Consequences we had not seen:
- `parse/route.ts` wrapped `.limit()` in a `try/catch` that fell back to a bounded in-memory
  bucket. A resolved promise never enters a catch, so **that fallback was dead code for the
  exact scenario it was written for** — Upstash slow rather than refused.
- The other three routes had no fallback at all; a thrown limiter error would have landed in
  their outer catch and returned a generic 500, not a 429.
- No route inspected `.reason`, so a timeout was indistinguishable from a genuine pass.
- `@upstash/redis` retries 5 times with exponential backoff (~4.29s of sleeps) before it would
  throw, so during a real outage the 5s race almost always resolved into the fail-open first.

During any Upstash slowdown, one IP could therefore spend the entire 1500-unit daily AI budget.

### How it was fixed

New `lib/server/rateLimit.ts` now owns limiter construction and the limit check:

- `makeLimiter()` — the only place a `Ratelimit` is constructed. Hardcodes `analytics: false`
  and an **explicit `timeout` (3s)**, so no future route can inherit the fail-open default by
  forgetting to pass one.
- `getClientIp()` — one copy replacing four near-duplicates (three byte-identical, one
  differing only by a comment). Carries a written note about the `x-forwarded-for` caveat
  still open as Audit A question A1.
- `checkRateLimit()` — runs both windows and treats `reason === "timeout"` **and** a thrown
  error identically: as *limiter unavailable*, degrading to `takePerIpFallback` in
  `spendGuard.ts`. All four routes now share that behaviour; previously only `parse` had any
  fallback, and it did not work.

Also corrected: `spendGuard.ts`'s header claimed the per-IP limiters had already been fixed to
not fail open. They had not. The comment now says what is actually true, including the honest
caveat that the in-memory bound is per lambda instance and therefore unbounded in aggregate
(A-W9-002).

### Deliberately not done
- **Retry-After is never computed from `reset` on the timeout path.** The library returns
  `reset: 0` there, so `reset - Date.now()` goes hugely negative.
- **The four 429 response bodies stay per-route.** Their copy differs on purpose ("AI
  improvements" / "JD Match checks" / "bullet rewrites" / the checker's plain-English string,
  which also carries a `requestId`). Only the limiter is shared.
- **Analytics was not re-enabled with a purge.** Nothing reads it. If it is ever wanted back,
  it needs a scheduled purge of `<prefix>:events:*` and a privacy-policy edit in the same PR.

### Open, not closed by this change
- Whether Vercel overwrites or appends to `x-forwarded-for`. If it appends, the first entry is
  attacker-controlled and every per-IP window here is bypassable with a random header per
  request. See Audit A open question A1 — this is the single highest-value thing left to settle.
- Whether existing `mmcv_*:events:*` keys should be purged from KV. They contain historical IPs
  and are no longer written to, but they do not expire on their own.
