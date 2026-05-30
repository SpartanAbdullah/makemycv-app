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
