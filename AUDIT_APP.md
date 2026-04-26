# AUDIT_APP.md — MakeMyCV Builder App

**Audit date:** 2026-04-25
**Auditor scope:** Repo at `C:/Users/MuhammadAbdullah/Desktop/makemycv-app/` against the UAE-first CV product strategy.
**Method:** Static code/route/dependency audit. No code written.

---

## Scope confirmation

This repo is the **builder app** (`app.makemycv.ae`), not the marketing site. There is no separate marketing surface in the repo — `app/page.tsx` redirects straight to `/builder`. The marketing site (`makemycv.ae`) lives elsewhere. Where this audit references "marketing claims," they are taken from copy that *also* appears inside this repo (FAQs, modals, hero text on `/resume-checker`).

The app is **not a thin client**: it owns its AI calls (Anthropic), its scoring engine, its templates, its KV storage for the resume checker, and its coupon redemption store. There is no separate backend service — only Next.js route handlers and Vercel KV.

---

## 1. Executive summary

- **The product is a single-user, browser-local CV builder + free ATS checker.** All CV data lives in `localStorage`. There is no database, no auth, no accounts, no server-side CV state. ([lib/store/cvStore.ts](lib/store/cvStore.ts))
- **The AI rewriter is real and works** (Claude Haiku via [/api/ai-improve](app/api/ai-improve/route.ts)) but is gated to **one free use per feature per browser** by a `localStorage` flag — trivially bypassable, and the paid tier behind it is disabled.
- **Payments are a stub.** No Stripe / Tap / Telr / Network International / PayTabs is wired up. The "Upgrade" CTA literally renders **"Coming Soon"** ([components/modals/UpgradeModal.tsx](components/modals/UpgradeModal.tsx)). Every "Pro" benefit advertised in-app (no watermark, unlimited AI, all templates) is unenforced.
- **PDPL/GDPR compliance is copy-only.** Zero consent capture, zero DSAR endpoint, zero retention policy for CV data, no privacy framework in code. The one real deletion guarantee is the 24h Vercel KV TTL on resume-checker *reports* — **not** on CV builder data.
- **There is no B2B surface at all.** No teams, orgs, SSO, admin console, bulk seats, university or employer flows. The product as it stands cannot be sold to an institution.

**Overall production readiness vs. the UAE-first strategy: ~30%.**
The builder + checker + AI loop is solid as a free consumer demo. Everything required to monetise, comply, or sell B2B in the UAE is missing.

---

## 2. Stack inventory

| Layer | What's there | Evidence |
|---|---|---|
| Framework | Next.js 16.1.6 App Router, React 19 | [package.json](package.json) |
| State | Zustand 5 + debounced localStorage | [lib/store/cvStore.ts](lib/store/cvStore.ts) |
| Forms | react-hook-form + zod | [package.json](package.json) |
| **Database** | **None.** localStorage for CV; Vercel KV for checker reports (24h TTL); JSON file for coupon redemptions | [lib/server/couponRedemptions.ts](lib/server/couponRedemptions.ts), [lib/resumeChecker/storage.ts](lib/resumeChecker/storage.ts) |
| **Auth** | **None.** No NextAuth/Clerk/Supabase Auth. No sign-up, no sessions. | n/a |
| **Payments** | **None integrated.** Upgrade button disabled. No Stripe / Tap / Telr / Network Intl / PayTabs in deps or env. | [components/modals/UpgradeModal.tsx](components/modals/UpgradeModal.tsx) |
| AI provider | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`), `ANTHROPIC_API_KEY` | [app/api/ai-improve/route.ts](app/api/ai-improve/route.ts), [lib/resumeChecker/parse.ts](lib/resumeChecker/parse.ts) |
| PDF engine | `@react-pdf/renderer` 4.3, **client-side only** | [hooks/useDownloadCV.ts](hooks/useDownloadCV.ts), [lib/utils/pdfExport.ts](lib/utils/pdfExport.ts) |
| Doc import | pdfjs-dist + mammoth + docx | [lib/importers/](lib/importers/) |
| Email / WhatsApp | **None.** | n/a |
| Hosting | Vercel | `next.config.ts`, `@vercel/kv` |
| **Data residency** | **Vercel KV defaults to US (Ohio).** No region pin. No PDPL-relevant residency control. | n/a |

---

## 3. Feature inventory

Legend: ✅ working · 🟡 partial · 🟠 stub UI / no logic · 🔴 advertised but missing · ❌ not present

| Feature | Status | Note |
|---|---|---|
| CV builder (8 steps) | ✅ | Solid, all steps validated |
| 6 templates (Classic, Modern, Executive, ATS Clean, Exec Split, Corp Sidebar) | ✅ | ATS Clean is genuinely single-column |
| PDF export | ✅ | `@react-pdf/renderer`, client-side |
| DOCX export | 🟠 | `lib/utils/docxExport.ts` exists, **no UI button wires it up** |
| Resume Checker (parse + score) | ✅ | Claude + heuristic fallback + zod validation |
| Resume Checker → import to builder | ✅ | Carries parseSignals through |
| AI bullet / skills / summary | 🟡 | Works once per browser, then blocks; no real paywall |
| PDF / DOCX / LinkedIn import | ✅ / ✅ / 🟡 | LinkedIn is paste-text only |
| Photo upload | ✅ | Stored as data URI in localStorage |
| Coupons | ✅ | 3 hardcoded codes, JSON-file redemption (not serverless-safe) |
| RTL / Arabic UI | 🟠 | `lib/utils/rtl.ts` exists, used only in import-mapping preview, **not in builder UI or PDF templates** |
| Watermark on free PDF | 🔴 | Advertised in UpgradeModal, **no watermark code anywhere** |
| Pro tier (unlimited AI, all templates, no watermark) | 🔴 | Button says "Coming Soon" |
| Auth / accounts | ❌ | |
| Save & resume across devices | ❌ | Single browser only |
| CV versioning / history / soft-delete / audit log | ❌ | Imports replace or merge; no history |
| Email / WhatsApp delivery | ❌ | |
| Teams / orgs / SSO / admin / bulk seats | ❌ | |
| University / institute / employer flows | ❌ | |
| Cookie banner / consent capture | ❌ | |
| DSAR / "delete my data" endpoint | ❌ | |
| Privacy / Terms pages | ❌ in this repo | |

---

## 4. Data model

There is effectively no server data model.

- **CV data (`CvData`)** — `localStorage`, debounced 500ms, indefinite retention. Lost on browser clear. No multi-device. No versioning. No soft-delete. No audit log. ([lib/store/cvStore.ts](lib/store/cvStore.ts))
- **AI usage flags** — `localStorage` keys (`makemycv_ai_bullets_used`, etc.) set to `"1"` after first use. Trivially deletable.
- **Pro / coupon flags** — `localStorage` (`makemycv:isPro`, `makemycv:appliedCoupon`). Self-grantable.
- **Resume Checker reports** — Vercel KV with `EX = 86400` (24h). Dev fallback is in-memory `Map`. ([lib/resumeChecker/storage.ts](lib/resumeChecker/storage.ts))
- **Coupon redemptions** — `data/coupon-redemptions.json` written from a route handler. Comment in [lib/server/couponRedemptions.ts](lib/server/couponRedemptions.ts) literally warns: *"If you deploy to a serverless platform, move redemptions into a shared database."* This is currently broken on Vercel cold starts.

---

## 5. AI integration

| Aspect | Reality |
|---|---|
| Provider / model | Anthropic, `claude-haiku-4-5-20251001` (cheapest tier) |
| Endpoints | [/api/ai-improve](app/api/ai-improve/route.ts), [/api/resume-checker/parse](app/api/resume-checker/parse/route.ts) |
| Prompt location | **Inline string literals**, not versioned files |
| Prompt versioning | None |
| Output validation | `ai-improve`: ad-hoc JSON extraction; `resume-checker`: zod schema with heuristic fallback (good) |
| Free-tier rate limit | Client-side `localStorage` flag — bypassable by clearing one key |
| Server-side rate limit / abuse protection | None visible |
| "UAE job market expert" claim | Prompt text only — no salary data, visa context, sector logic, or any UAE-specific knowledge feeding the model |

The AI loop *works*, but it is not a defensible moat. There is no proprietary data, no fine-tuning, no eval set, no prompt registry, no telemetry feeding back into improvement.

---

## 6. PDF engine & ATS-safety

`@react-pdf/renderer` rendered fully client-side. No Puppeteer, no LLM-generated PDFs. Templates in [lib/templates/](lib/templates/).

- **ATS-safe**: ATS Clean — single-column, no images, no tables, plain fonts. ✅
- **Risky for ATS**: Modern, Executive, Exec-Split, Corp-Sidebar all use sidebars / coloured blocks / two-column layouts that some parsers mishandle. Still text (not text-in-image), so partial credit.
- **Photo handling**: data-URI `<Image>` in templates that include a photo — fine for PDF, but a photo on a CV is genuinely UAE-context-appropriate (unlike US/UK).
- **RTL**: Not implemented in any template.

---

## 7. UAE-specific fields — type vs. UI vs. PDF

| Field | Type | Form UI | PDF templates | Verdict |
|---|---|---|---|---|
| Nationality | ✅ `CvPersonal.nationality` | ✅ PersonalStep | ✅ rendered in contact block | OK |
| Driving licence | ✅ `CvPersonal.drivingLicense` | ✅ PersonalStep | ✅ rendered | OK |
| Country / DOB | ✅ | ✅ | partial | OK |
| Visa status | ❌ | ❌ | ❌ | **Missing** — single biggest UAE-recruiter signal |
| Emirate | ❌ | ❌ (only generic location) | ❌ | **Missing** |
| Notice period | ❌ | ❌ | ❌ | **Missing** |
| Attestation (MOFA / emirate authority) | ✅ on Education entries | ✅ checkbox + body field | partially in templates | Good — UAE-specific and real |
| DHA / HAAD / DOH / MOH licence prompts | 🟡 mentioned in tip copy | ❌ no dedicated field | ❌ | **Missing** as structured field |
| MOE equivalency | ❌ | ❌ | ❌ | **Missing** |
| Arabic / RTL text rendering | 🟠 detector exists | ❌ not applied to inputs | ❌ not applied to PDF | **Stub** |
| Bilingual CV output (AR + EN) | ❌ | ❌ | ❌ | **Missing** |

The product *says* UAE-first but ships only nationality + licence + attestation. Visa, emirate, notice period, healthcare licensing — the fields a UAE recruiter actually filters on — are absent.

---

## 8. Payments

- No payment SDK in `package.json`.
- No CSP whitelist for any processor in `next.config.ts`.
- No `STRIPE_*`, `TAP_*`, `TELR_*`, `NI_*`, `PAYTABS_*` env vars in `.env.example`.
- `PlanTier = 'free' | 'pro'` exists in types; `plan` is hardcoded `'free'` everywhere it's read.
- Upgrade CTA: button `disabled`, label "Coming Soon" ([components/modals/UpgradeModal.tsx](components/modals/UpgradeModal.tsx)).
- Pricing copy in-app says **"$5 per download, one-time"** and **"$5 charge to export the polished PDF"** — neither is collectable.
- Coupon system is the *only* working monetisation primitive, and it is just a workaround for the missing payment processor.

For a UAE consumer product, the obvious processor choice is Tap or Network International (local cards, Apple Pay, regional fraud handling). Stripe alone is not enough — UAE debit cards routinely fail Stripe 3DS.

---

## 9. PDPL compliance — what actually exists

| Artefact | In code |
|---|---|
| Consent capture at any entry point | ❌ |
| Granular AI-processing consent (text sent to Anthropic) | ❌ |
| DSAR / "export my data" endpoint | ❌ |
| DSAR / "delete my data" endpoint | ❌ |
| Retention policy enforced for CV data | ❌ (localStorage, indefinite) |
| Retention policy enforced for resume-checker reports | ✅ KV TTL 24h |
| Data residency control (UAE region) | ❌ Vercel KV in US |
| Breach-response plan / DPIA / DPA | ❌ |
| Cookie banner | ❌ |
| Privacy Policy / Terms in this repo | ❌ |
| Lawful-basis statement when calling Anthropic | ❌ |

**PDPL readiness: copy-only.** This is the single most legally exposed area. The app sends UAE residents' CVs (which are personal data, often including photo, DOB, nationality, family status) to a US AI provider with no consent, no DPA reference, no residency control, and no deletion path. The marketing-side promise of privacy is not enforced by anything in the codebase.

---

## 10. B2B readiness

Nothing in repo. No teams, no orgs, no SSO, no admin, no bulk-license redemption, no employer dashboard, no university/institute portal, no API for partners. The coupon system is the closest thing to "give 100 students access," and it is hardcoded codes in a TS file with a JSON redemption log.

---

## 11. Strategy classification

| Strategy area | Status | Comment |
|---|---|---|
| MVP features (build → preview → export) | ✅ | Solid |
| V2 features (versioning, multi-device, sharing, templates marketplace) | 🔴 | None present |
| Pricing tiers (Free / Pro / B2B) | 🔴 | Tier exists in types only; no billing |
| UAE-native fields | 🟡 | Nationality/licence/attestation yes; visa/emirate/notice/healthcare-licence/RTL no |
| AI moat | 🟠 | Just calls Claude with inline prompts. No data, no eval, no fine-tune, no proprietary signal |
| PDPL compliance | 🔴 | Copy-only, materially exposed |
| B2B readiness | ❌ | Doesn't exist |
| Data / AI flywheel | ❌ | No telemetry, no opt-in dataset capture, no eval loop, nothing to learn from |

---

## 12. Top 10 gaps ranked by business impact × effort

| # | Gap | Impact | Effort | Why it matters |
|---|---|---|---|---|
| 1 | **No payment processor wired** | High | Low–Med | Cannot earn a dirham. Tap or Network International + Stripe is a 1–2 week job. |
| 2 | **No auth / accounts** | High | Med | Blocks: cross-device, save history, B2B seats, PDPL DSAR, retargeting, paid-tier persistence. |
| 3 | **PDPL compliance is copy-only** | High (legal) | Med | Consent flow + DSAR endpoint + DPA with Anthropic + retention policy + UAE-region storage. |
| 4 | **Pro-tier features advertised but not built** (watermark removal, unlimited AI, "all templates") | High (trust) | Low | Either ship them or stop advertising them — current state is misleading. |
| 5 | **UAE structured fields missing** (visa status, emirate, notice period, DHA/HAAD/DOH/MOH, MOE equivalency) | High | Low | The "UAE-first" positioning isn't real without these. |
| 6 | **Arabic / RTL not in builder or PDF** | Med–High | Med | A genuine UAE moat vs. Resume.io / Zety; partly built (`lib/utils/rtl.ts`) but not used. |
| 7 | **AI free-tier limit trivially bypassed** (clear one localStorage key) | Med | Low | Burns Anthropic spend; needs server-side rate-limit by IP/fingerprint. |
| 8 | **Coupon redemption uses a JSON file** | Med (operational) | Low | Already broken on Vercel cold starts; the file's own comment admits it. |
| 9 | **No B2B surface (teams, bulk seats, partner portal)** | High (TAM) | High | Universities and recruitment firms are the obvious UAE buyers. |
| 10 | **No data / AI flywheel** (no opt-in dataset capture, no eval set, no prompt registry) | Med (long-term moat) | Med | Without this, the AI is commoditised — same Claude call anyone can make. |

---

## 13. Top 5 things to remove or deprecate

1. **The "Coming Soon" Upgrade modal** — either ship the paywall this sprint or remove the button. Right now it advertises non-existent benefits. ([UpgradeModal.tsx](components/modals/UpgradeModal.tsx))
2. **The "$5 per download" copy** in the resume-checker FAQ and Upgrade modal — unenforceable; remove until a processor is live.
3. **The "no watermark on Pro" benefit** — there is no watermark in the free tier either. Either build the watermark + the removal, or stop listing it.
4. **JSON-file coupon redemption** ([lib/server/couponRedemptions.ts](lib/server/couponRedemptions.ts)) — known broken on serverless. Either move to KV/DB or pull the coupon system entirely until there's something to gate.
5. **The `linkedinAdapter` "import"** — currently a paste-text stub gated behind a feature flag. Either ship a real LinkedIn flow (PDF export from LinkedIn → mapper) or hide it; the current state confuses users about what works.

---

## 14. Verdict on three direct questions

### (a) Does the "AI rewriter" advertised on the marketing site actually exist and work?

**Yes, the rewriter exists and produces output.** [/api/ai-improve](app/api/ai-improve/route.ts) calls Claude Haiku for bullets, skills, and summary. Output is parsed and surfaced in `AIResultsModal`.

**But the way it's gated is dishonest:** "free" = exactly one call per type per browser, enforced by a `localStorage` flag, and the promised "unlimited Pro" tier is a disabled button. Most users will hit "AI is unavailable" on their second prompt and see "Coming Soon." That is materially worse than the marketing copy implies.

### (b) Is the "deleted after 24h" promise on /resume-checker actually enforced in code?

**Yes — narrowly.** Resume-checker reports are written to Vercel KV with `EX = 86400` ([lib/resumeChecker/storage.ts](lib/resumeChecker/storage.ts)) and KV evicts on TTL. Dev fallback honours the same TTL via an in-memory map.

**Caveats:**
- The TTL covers the parsed report only. The user's CV in the *builder* sits in `localStorage` indefinitely — and the FAQ's framing ("automatically deleted") is easy to misread as a global guarantee.
- There is no DSAR endpoint, no audit trail, no user confirmation, no manual deletion path.
- KV is in a US region. PDPL would prefer UAE residency.

### (c) Is PDPL compliance real or copy-only?

**Copy-only.** Zero consent flows, zero DSAR endpoints, no DPA reference, no UAE residency, indefinite retention of personal data in browser storage, no privacy/terms pages in the repo, and personal data (CVs with photo, DOB, nationality) sent to a US AI provider without any documented lawful basis. This is the audit's single largest legal risk.

---

## 15. Recommendation

**Selective rebuild — not polish, not pivot.**

The core build → preview → export → checker loop is genuinely good and should not be thrown away. But the product as currently shipped cannot be monetised, cannot be sold to a UAE institution, cannot defend a PDPL complaint, and cannot honour several claims it makes in its own UI. Polish will not fix any of that. A pivot is unwarranted because the working core is already differentiated for the UAE consumer (attestation, nationality, driving licence, ATS Clean template).

**Suggested rebuild order (sequenced for fastest revenue + lowest legal risk):**

1. **Auth + server-side CV persistence** (Supabase or Clerk + Postgres in `me-central-1`/UAE region). Unblocks everything else.
2. **Tap / Network International + Stripe** for AED + global cards. Turn on the Pro tier or kill the copy.
3. **PDPL minimum viable**: consent screen, granular AI consent, DSAR export+delete endpoints, DPA reference for Anthropic, UAE region for stored CV data, retention policy.
4. **Real UAE fields**: visa status, emirate, notice period, healthcare licensing, MOE equivalency. RTL/Arabic in builder + at least one bilingual template.
5. **Server-side AI rate-limiting** + prompt registry + eval set + opt-in dataset capture (the start of an actual moat).
6. **B2B surface**: orgs, seats, bulk coupon issuance via DB, university/recruiter dashboard.

Items 1–4 are roughly 6–8 weeks of focused work and convert this from a free demo into a defensible, billable, UAE-compliant product. Items 5–6 are quarter-scale and unlock the institutional TAM that justifies the "UAE-first" positioning.
