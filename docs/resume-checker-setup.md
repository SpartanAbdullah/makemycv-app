# Resume Checker — Setup

The ATS checker at `/resume-checker` uploads a PDF, parses it with Claude, scores it, and stores the report in Vercel KV for 24 hours. No sign-up, no paywall on the report.

## Prerequisites

- `ANTHROPIC_API_KEY` — Anthropic API key (reused across the app).
- Vercel KV database — stores report payloads with a 24h TTL.

## 1. Enable Vercel KV

1. Open the Vercel dashboard for this project.
2. **Storage → Create Database → KV**. Pick the region closest to the primary serverless region.
3. Attach the database to the project (all environments).

## 2. Pull env vars locally

```bash
vercel env pull .env.local
```

That populates:

```
KV_URL
KV_REST_API_URL
KV_REST_API_TOKEN
KV_REST_API_READ_ONLY_TOKEN
```

## 3. Anthropic key

Add `ANTHROPIC_API_KEY` to `.env.local` manually (not from Vercel env pull unless already stored there). The key is issued from <https://console.anthropic.com/>.

## 4. Local dev without KV

In development (`NODE_ENV === 'development'`) the checker falls back to an in-memory `Map` so reports work without provisioning KV. Reports are lost on server restart. Production must use real KV.

## Parse route config

`app/api/resume-checker/parse/route.ts` uses:

```ts
export const runtime = 'nodejs';   // pdfjs-dist needs Node APIs
export const maxDuration = 60;     // Claude + PDF extract can take 10–30s on cold start
```

## Report TTL

24h, enforced via `kv.set(..., { ex: 86400 })`. No cleanup cron — KV expires the key automatically.
