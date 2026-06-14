# Arch Recon — makemycv-app

## 0. Identity & deployment reality
- Type (marketing site / web app / API): **Web app** — CV builder + ATS resume-checker. Single Next.js project that ships both the UI and its server-side API routes.
- Language(s) & framework(s) + versions:
  - TypeScript ~5 (strict mode, `tsconfig.json:7`)
  - Next.js **16.1.6** (App Router) — `package.json:20`
  - React **19.2.3** + React DOM 19.2.3 — `package.json:22-23`
  - Tailwind CSS **v4** (`@tailwindcss/postcss` ^4)
  - Zustand 5, react-hook-form 7, zod 3, @react-pdf/renderer 4, docx 9, pdfjs-dist 4, mammoth 1
- Build tool & package manager: **npm** (only `package-lock.json` present, no yarn/pnpm lockfiles). Bundler is Next.js's built-in (Turbopack by default in Next 16).
- Is it deployed? Where (host)? Public URL if findable in config:
  - **Yes — Vercel**. `.vercel/project.json` is committed locally (gitignored) with `projectId: prj_UQqbBtOOang6XCowU9uDxVKkbkFm`, `orgId: team_86H6T0QzZEL2PWfrG2fLKOGJ`, `projectName: makemycv-app-kqie`.
  - Public URL from `app/layout.tsx:46` and `:72`: **`https://app.makemycv.ae`** (set as `metadataBase` and `openGraph.url`).
  - Git remote: `https://github.com/SpartanAbdullah/makemycv-app.git`.
- Does it call any paid/metered external API (LLM, email, SMS, payments, storage)? List each + the file:line where it's called:
  - **Anthropic Claude API** (model `claude-haiku-4-5-20251001`) — `app/api/ai-improve/route.ts:189` (bullets/skills/summary generation) and `lib/resumeChecker/parse.ts:218` (CV parsing from raw text).
  - **Vercel KV** (Upstash Redis under the hood) — `app/api/ai-improve/route.ts:3` (rate-limit counters) and `lib/resumeChecker/storage.ts:154,165` (ATS report cache with 24 h TTL). Metered storage/requests.
  - No payments (Stripe/Paddle/Tap) — `DECISION_LOG.md` documents the explicit pivot away from paid checkout.
  - No email/SMS provider, no S3/object storage.

## 1. The stack
- Frontend: framework, routing, state management, styling:
  - **Next.js 16 App Router** (`app/` directory; routes: `/`, `/builder`, `/preview`, `/resume-checker`, `/export`, `/templates`, plus `/api/*`).
  - **State**: Zustand — `lib/store/cvStore.ts` (CV data, persisted to `localStorage` with debounced auto-save) + `lib/store/uiStore.ts` (transient UI state, not persisted). Forms use **react-hook-form + zod resolvers**.
  - **Styling**: Tailwind CSS v4 via PostCSS plugin; design tokens defined as CSS variables in `app/globals.css` ("Focus Flow" system). Fonts loaded via `next/font` (Inter, Plus Jakarta, Poppins from Google) and local woff2 (Sora, Fraunces) — `app/layout.tsx:4-43`. Bricolage Grotesque / Instrument Serif / JetBrains Mono via Google Fonts `@import` in `app/globals.css:7`.
- Backend / API: any server-side code? serverless functions? runtime? Where does business logic live — client or server:
  - **Yes — Next.js Route Handlers** in `app/api/`. Four endpoints:
    1. `POST /api/ai-improve` — Claude proxy with per-IP rate limiting (`route.ts`, `runtime` defaults to Node).
    2. `POST /api/resume-checker/parse` — Claude-backed CV parser, `runtime = "nodejs"`, `maxDuration = 60`.
    3. `GET /api/resume-checker/report/[reportId]` — fetch stored report, Node runtime.
    4. `POST /api/resume-checker/import/[reportId]` — hydrate builder from stored report, Node runtime.
    5. `POST /api/coupons/apply` — legacy back-compat endpoint that now just returns "free for everyone" (paywall removed per `DECISION_LOG.md` 2026-05-31).
  - Most business logic is **client-side**: builder UI, template rendering, PDF/DOCX export (`hooks/useDownloadCV.ts`, `lib/utils/docxExport.ts`), score computation (`lib/scoreEngine.ts`) all run in the browser. The server handles only (a) Claude proxying with secrets, (b) KV-backed report storage, (c) rate limiting. PDF text extraction is also done **client-side** via `pdfjs-dist` to avoid the Turbopack/pdfjs worker incompatibility (`parse/route.ts:5-7`).
- Database / storage: localStorage / Supabase / Postgres / other? What tables or stores exist? Where are DB credentials referenced:
  - **Browser `localStorage`** — the canonical store for the user's CV data while building. Keys touched in `lib/store/cvStore.ts` include the CV blob (auto-save), plus legacy keys `COUPON_STORAGE_KEY`, `PRO_STORAGE_KEY`, `FREE_DL_STORAGE_KEY`, `PARSE_SIGNALS_STORAGE_KEY` (read for back-compat; writes preserved on a couple of paths).
  - **Vercel KV** — single namespace `report:<id>` for ATS checker reports, TTL 86400 s (`lib/resumeChecker/storage.ts:101,155`). Also two rate-limit prefixes `mmcv_ai_daily` and `mmcv_ai_burst` (`app/api/ai-improve/route.ts:26,33`).
  - **In-memory `Map`** fallback for dev when KV is not configured — `lib/resumeChecker/storage.ts:109-111`.
  - Credentials referenced via `process.env.KV_REST_API_URL` / `KV_REST_API_TOKEN` — `lib/resumeChecker/storage.ts:115`, and implicitly via the `@vercel/kv` package picking them up.
  - **No relational DB. No Supabase. No Firebase. No Prisma/Drizzle. No migrations.**
- Auth & permissions: is there auth? what type? Any Row-Level-Security policies in code/migrations, or is access client-trusted:
  - **No auth.** No login/signup/session middleware anywhere in `app/`, `components/`, or `lib/` (grepped for `login|signIn|signUp|auth\.|getServerSession|nextauth|clerk` — zero hits in source).
  - Marketing copy in `app/layout.tsx:54` confirms: "no sign-up required."
  - **No RLS** — KV is a flat key-value store; access is gated only by the server holding the KV API token. Anyone who knows a `reportId` can `GET` the report (it's a 16-char nanoid, so unguessable in practice, but there is no per-user authorization).
  - The coupons endpoint accepts any code and intentionally always returns "free for everyone" (`app/api/coupons/apply/route.ts:36-39`).
- Cache / CDN: any caching or CDN config in the repo:
  - No explicit cache headers in route handlers; one route forces `dynamic = "force-dynamic"` (`coupons/apply/route.ts:10`).
  - CDN is implicit via Vercel's edge network — no custom `vercel.json` is present.
  - `next.config.ts` sets security headers (`Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, etc.) for `/:path*` but no `Cache-Control`.

## 2. Build & ship
- Git: branches present? is a real .env file committed (yes/no)? does .gitignore cover secrets:
  - Branches: `main`, `stagingmmc` (current), `claude/bold-bouman`, `claude/nervous-northcutt`. Remote tracks `origin/main` and `origin/stagingmmc`.
  - **No real `.env` is committed** — `git ls-files | grep .env` returns only `.env.example`. `.env.local` exists on disk but is not tracked.
  - `.gitignore:34-35` has `.env*` with `!.env.example` exception. Lines 46-47 redundantly add `.vercel` and `.env*.local`. **Coverage is correct.**
- Secrets handling: how are API keys stored? any hardcoded/committed keys (report file:line, NOT the value):
  - Server-side env: `ANTHROPIC_API_KEY` (used at `app/api/ai-improve/route.ts:155` and `lib/resumeChecker/parse.ts:215`), KV creds (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`).
  - Public env (NEXT_PUBLIC_*): `NEXT_PUBLIC_KOFI_USERNAME`, `NEXT_PUBLIC_PAYPAL_ME_HANDLE` — non-secret tipping handles, safe to expose.
  - **No hardcoded API keys / tokens / Anthropic keys / KV tokens found** in committed source. Grepped for `sk-ant`, `AIza…`, `ghp_…`, `xox[bp]-`, `AKIA` — only false positives in SVG files (`public/kofi_brandasset/*.svg`) and a CSS gradient stop.
- Env config: is .env.example present? list the env var NAMES expected:
  - **Yes — `.env.example`** present at repo root.
  - Variables declared (`/.env.example:1-20`):
    - `ANTHROPIC_API_KEY`
    - `KV_URL`
    - `KV_REST_API_URL`
    - `KV_REST_API_TOKEN`
    - `KV_REST_API_READ_ONLY_TOKEN`
    - `NEXT_PUBLIC_KOFI_USERNAME` (default `makemycv_ae`)
    - `NEXT_PUBLIC_PAYPAL_ME_HANDLE` (default `Abdullah2431`)
- CI/CD: any pipeline/config files (.github/workflows, vercel.json, netlify.toml, etc.) — list them:
  - **No `.github/workflows/`** directory exists.
  - **No `vercel.json`, no `netlify.toml`, no `dockerfile`, no `turbo.json`.**
  - Deploy is presumed to be **Vercel's default Git integration** — push to a tracked branch and Vercel builds it (project linked via `.vercel/project.json`). The Git → build → deploy pipeline lives entirely in the Vercel dashboard, not in the repo.

## 3. Run & survive
- Error tracking / logging: anything (Sentry, etc.) or none:
  - **None.** Grepped for `Sentry|sentry|datadog|posthog|logRocket|bugsnag` — zero hits in source. The CSP in `next.config.ts:33` allows `https://vitals.vercel-insights.com`, but `@vercel/analytics` / `@vercel/speed-insights` are NOT in `package.json` dependencies, so even Web Vitals reporting is not wired up in code today.
  - Logging is bare `console`-level + the Anthropic and KV SDKs' own errors bubbling into 4xx/5xx responses.
- Rate limiting / abuse protection: any, especially on endpoints that call paid APIs:
  - **`/api/ai-improve`** — yes, two stacked windows via `@upstash/ratelimit` keyed on client IP (`app/api/ai-improve/route.ts:22-34`): daily 10 / 24 h + burst 3 / 60 s.
  - **`/api/resume-checker/parse`** — **NO rate limiting** despite also calling Claude. Only hard caps are payload length (`MIN_TEXT_LENGTH=200`, `MAX_TEXT_LENGTH=100_000`) and `maxDuration=60s`. This is a potential abuse vector — see §4.
  - **`/api/coupons/apply`** — no rate limiting (low risk; no downstream paid call, just returns a string).
  - **`/api/resume-checker/report/[reportId]` & `/import/[reportId]`** — no rate limiting; rely on report-id unguessability.
- Input validation: present on user/API inputs:
  - `coupons/apply/route.ts:5-7` — zod schema (`code: z.string().trim().min(1).max(100)`).
  - `resume-checker/parse/route.ts` — manual `typeof` + length checks on `rawText`.
  - `ai-improve/route.ts:180` — manual `body.type` allow-list check, but the other fields (`jobTitle`, `existingBullets[]`, `experienceRoles[]`, etc.) are passed straight into the LLM prompt without schema validation.
  - Report-id routes — minimum-length check (`>= 8`) only, no format/charset validation.
  - Client side: zod is used in `lib/schemas/` and within `lib/resumeChecker/parse.ts` to validate LLM output. Form input validation lives in react-hook-form resolvers.
- Tests: framework + rough coverage signal (count of test files):
  - **No test runner is configured.** `package.json` has only `dev / build / start / lint` scripts — no `test` script. No Vitest, Jest, Playwright, or Cypress in dependencies.
  - **One** `*.test.ts` file in source: `lib/store/migrate.test.ts`. It exists but has no way to actually run via the project scripts.
  - Effective test coverage signal: ~0%.
- Backups / recovery: anything in the repo about this:
  - **Nothing.** No backup scripts, no KV export hooks, no documentation of recovery procedures. ATS reports auto-expire after 24 h by design; CV data lives only in the user's `localStorage` and is never persisted server-side — so "backup" largely reduces to "the user kept their browser data."

## 4. Cannot be determined from repo
- **Vercel hosting plan & region** — which Vercel team plan (Hobby/Pro/Enterprise), which region(s) functions deploy to, whether edge or Node functions are forced anywhere beyond the per-route `runtime = "nodejs"` declarations. UNKNOWN — needs dashboard/host check.
- **Vercel KV instance details** — Upstash Redis tier, max memory, daily request quota, whether analytics is actually enabled on the `Ratelimit` `analytics: true` flag, retention beyond per-key TTL. UNKNOWN — needs dashboard/host check.
- **Anthropic billing posture** — spend cap, budget alerts, per-key org limits, whether the key is scoped to one workspace. UNKNOWN — needs Anthropic console check.
- **Production domain & DNS** — the code calls itself `app.makemycv.ae` in metadata, but the actual DNS/CNAME setup, Vercel custom-domain attachment, SSL provisioning state, and whether `makemycv.ae` (root) points anywhere else (e.g. a separate marketing site repo) lives in the registrar/Vercel dashboard. UNKNOWN — needs dashboard/host check.
- **Who has prod access** — Vercel team `team_86H6T0QzZEL2PWfrG2fLKOGJ` membership, GitHub repo collaborators, and who can rotate the `ANTHROPIC_API_KEY` / KV tokens. UNKNOWN — needs dashboard/host check.
- **Real `.env.local` contents** — present on disk locally but never committed; can't verify what's actually configured for the current dev/prod environment without reading it (intentionally not read for this recon).
- **Whether Vercel project-level env vars match `.env.example`** — the example file lists 7 names; the actual Vercel env vars (preview vs production scopes, any extras) live in the dashboard. UNKNOWN — needs dashboard/host check.
- **CDN/edge caching behavior** — there is no `vercel.json` to inspect; cache TTLs for static assets and the SSR fallback are whatever Vercel's defaults are for Next 16. UNKNOWN — needs dashboard/host check.
- **Branch protection / required reviews** — `main` is the PR target per CLAUDE.md, but no `.github` config in the repo means any branch protection lives in GitHub UI. UNKNOWN — needs GitHub settings check.
- **Whether the `/api/resume-checker/parse` rate-limiting gap is mitigated upstream** (e.g. WAF, Vercel firewall rule, Cloudflare) — code does not mitigate it. UNKNOWN — needs dashboard/host check.
