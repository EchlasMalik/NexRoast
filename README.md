# NexRoast

An AI website audit platform. Someone submits a URL; NexRoast loads the page, measures
it, has a model judge what only a human eye can judge, and publishes a public,
shareable audit at `/audit/{id}` — a score out of 100 across nine areas, prioritised
issues with evidence, and paste-ready copy rewrites.

The audit is free and complete. There is no paywall. Public audits are the growth loop:
they're built to be shared and indexed, and they funnel businesses that need help toward
[Nexiora Studio](https://nexiorastudio.com).

## Stack

| Concern         | Choice                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Framework       | Next.js 15 App Router, React 19, TypeScript                                                                  |
| Styling         | Tailwind v4 (CSS-first — theme lives in `@theme inline` in `app/globals.css`, there is no `tailwind.config`) |
| Database        | PostgreSQL via Prisma 7 + `@prisma/adapter-pg`                                                               |
| Background jobs | Inngest                                                                                                      |
| AI              | Google Gemini via `@google/genai`, four-model fallback chain                                                 |
| Capture         | `playwright-core`, with `@sparticuz/chromium` on Vercel                                                      |
| Storage         | Cloudflare R2 via `@aws-sdk/client-s3`                                                                       |
| Documents       | `@react-pdf/renderer` (PDF), `next/og` (share cards)                                                         |
| Tests           | Vitest                                                                                                       |

## How the audit works

```
POST /api/audit   rate limit ─► SSRF validation ─► denylist
                  └─► create row, emit "audit/requested"   ─► 202 in ~50ms

Inngest  run-audit  (retries: 2)
   ├─ capture      Playwright: load, screenshot, measure ─► R2
   ├─ generate     Gemini judges 17 perceptual criteria, with evidence
   ├─ build        25 measured criteria scored in code; every number computed
   ├─ save         report, score ─► status "complete"
   └─ visibility   decide whether it may be indexed
```

Capture runs in the job, not the request. It used to be inline, which meant a
transient queue or model failure discarded ~15 seconds of completed browser work and
reported it to the user as though their website had failed to load. Because Inngest
memoises step results, a retry now replays the capture rather than relaunching
Chromium.

That also means `/api/inngest` is the route that launches a browser: it carries
`runtime = "nodejs"`, `maxDuration = 60`, and the `outputFileTracingIncludes` entry that
forces the Chromium binary into its bundle.

### The score is not arbitrary

This is the core design decision: **the model never emits a number the code can
compute.**

| Value                      | Source                                              |
| -------------------------- | --------------------------------------------------- |
| Judged criterion verdict   | model — with a required `evidence` field            |
| Measured criterion verdict | code — deterministic, from the page                 |
| Category score             | computed from criterion verdicts                    |
| Overall score              | computed from category scores × archetype weights   |
| Issue impact               | computed from severity, category weight and deficit |
| Quick wins, action plan    | derived from the issue set                          |

42 criteria live in `lib/audit/criteria.ts`. 25 are measured directly from the page
(load time, heading structure, structured data, mobile layout, contact routes), so that
part of the score is reproducible for an unchanged site. The other 17 need perception —
"is there one obvious primary action?" — and only those reach the model.

Every criterion is shown on the audit page under its category, so a reader can see
exactly where each point came from.

Category weights vary by detected business archetype (`lib/audit/categories.ts`): a
local plumber is weighted on phone visibility and service area, a SaaS on positioning
and signup. When `localRelevant` is false the local category is **dropped and the
remaining weights renormalised**, rather than scored zero.

### Guardrails

These audits name real businesses on public, indexable pages, so:

- Every issue carries `evidence` — a required schema field, not just a prompt request.
- `lib/audit/moderation.ts` rejects invented revenue figures, invented percentages, and
  any claim about the business rather than the website. A rejected audit is regenerated,
  never sanitised in place.
- The prompt forbids commenting on people, competence or legitimacy, and explicitly
  permits finding nothing wrong.

### Why completed audits are server-rendered

`app/audit/[id]/page.tsx` branches on status. A completed audit is immutable, so it
renders entirely on the server — the full text is in the HTML, which is what makes these
pages indexable. Only pending audits mount a client component, and that component polls
a status-only endpoint and calls `router.refresh()`; it never renders the report.

## Setup

Requires Node 20+, a PostgreSQL database, an R2 bucket and a Gemini API key.

```bash
npm install
npx playwright install chromium     # local capture browser
cp .env.example .env                # then fill it in
npx prisma migrate dev
npx prisma db seed                  # optional: one worked example
npm run dev
```

Inngest runs the audit generation, so in a second terminal:

```bash
npx inngest-cli@latest dev
```

## Scripts

| Script                    | Does                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`             | Next dev server                                                            |
| `npm run build`           | Runs migrations, then builds. A failed migration fails the build by design |
| `npm test`                | Vitest — SSRF, scoring, schema, moderation, visibility                     |
| `npm run lint` / `format` | ESLint / Prettier                                                          |

Two operational scripts, neither wired into a schedule:

- `node scripts/export-legacy-data.mjs` — dumps every table to timestamped JSON.
- `node scripts/list-orphaned-screenshots.mjs [--delete]` — lists R2 objects no live
  audit references. Read-only unless `--delete` is passed.

## Environment variables

**Required**

| Variable                                                                        | Used for                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------- |
| `DATABASE_URL`                                                                  | Postgres (Prisma, and the rate-limit table) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Screenshot storage                          |
| `GEMINI_API_KEY`                                                                | Audit generation                            |

**Recommended**

| Variable                   | Effect if unset                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                 | Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `localhost:3000`. Canonical URLs, the sitemap and the share-card logo all resolve against it, so set it in production |
| `NEXT_PUBLIC_CALENDLY_URL` | The Nexiora CTA links to nexiorastudio.com instead of a booking page                                                                                                      |
| `DIRECT_DATABASE_URL`      | Migrations run through the pooled connection, which can hang on advisory locks                                                                                            |
| `URL_DENYLIST_DOMAINS`     | Only the built-in adult-TLD heuristics apply                                                                                                                              |

**Inngest** — read by the SDK, never by application code, but something still has to
_set_ them:

| Variable              | Where it comes from                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INNGEST_EVENT_KEY`   | Injected by the Vercel↔Inngest integration. Needed to send events                                                                                                                                  |
| `INNGEST_SIGNING_KEY` | Injected by the same integration. Needed to verify requests arriving at `/api/inngest`                                                                                                             |
| `INNGEST_DEV`         | **Local only.** Setting it forces the SDK to talk to `localhost:8288`. Never set it on Vercel — every dispatch would fail. `.vercelignore` keeps `.env` out of deployments for exactly this reason |

Absent `INNGEST_DEV`, the SDK runs in cloud mode and requires the two keys above; its own
error is explicit about it.

**Optional:** `STRIPE_SECRET_KEY` — only for `lib/billing/`, which nothing in the audit
flow imports. See below.

## Billing

There isn't any. The audit is free, and the £9 report paywall was removed along with the
Stripe checkout and webhook routes.

`lib/billing/` keeps the Stripe client, key handling and API-version pin so a future
premium tier (monitoring, audit history, competitor comparison, white-label reports)
doesn't have to rebuild that wiring. Nothing in the audit flow imports it — that's the
point.

## Indexing

`lib/audit/visibility.ts` is the single place that decides whether an audit may be
indexed, and it decides once at completion rather than per request, so a crawler and a
visitor always agree.

An audit is indexable when it is complete, has at least 3 issues, 2 strengths, a
substantial summary and at least one scored category. Repeat audits of the same host
canonicalise to the newest: older ones stay live at their own URLs but drop out of the
index and the sitemap.

`/roast/{id}` permanently redirects to `/audit/{id}` — those links predate the rename
and are already out in the world.

## Deploying

Vercel. `npm run build` runs `prisma migrate deploy` first, so a bad migration fails the
deploy rather than shipping a broken schema. Preview deployments that share production
env vars will migrate production — scope them separately.

### Inngest in production

Inngest runs capture, generation and scoring, so if it isn't wired up every audit sits
at `pending` forever.

- **With the Vercel↔Inngest integration** (the usual case): the two keys are injected
  and the app is synced automatically on each deploy. Nothing to do.
- **Without it:** set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in the Vercel project,
  then sync once by pointing Inngest at `https://<your-domain>/api/inngest`.
- **Never set `INNGEST_DEV` on Vercel.** It forces the SDK to `localhost:8288`, and every
  submission then returns the 503 that `POST /api/audit` raises when it can't queue.

The local `ECONNREFUSED` you get without `npx inngest-cli@latest dev` running is a
dev-only condition and does not carry over to production.

After the first deploy, check that **`run-audit`** appears in the Inngest dashboard. This
refactor renamed both the function and the event (`generate-roast-critique` /
`roast/screenshot.captured` → `run-audit` / `audit/requested`), so the dashboard will
register a new function and archive the old one. That's expected.

### Database

The `20260804120000_audit_platform` migration has already been applied to the Neon
database this repo points at, so `prisma migrate deploy` during the build is a no-op for
that environment. It is destructive by design — it drops the old `Roast`, `LeadCapture`
and `Event` tables — so read it before running it against any database you have not
already migrated, and take a dump with `scripts/export-legacy-data.mjs` first.

**Unverified:** the `@sparticuz/chromium` serverless capture path has never run in this
repo's development environment (Windows; the binary is Linux-only). It needs a real
Vercel preview before you trust it. If it proves unreliable, a hosted screenshot API
would slot in behind `lib/capture.ts` without touching anything else.

## Notes

- `lib/generated/prisma` is gitignored and produced by the `postinstall` hook. Nothing
  typechecks without it, which is why CI runs `npm ci` before `tsc`.
- Rate limiting lives in Postgres (`lib/rate-limit.ts`), not memory. An in-process map
  gives each serverless instance its own counters, which makes the limit meaningless
  exactly when it matters — and it's the only thing between an abusive visitor and the
  Gemini and Playwright bill.
