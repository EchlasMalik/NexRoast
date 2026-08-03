# NexRoast

Next.js 15 (App Router) + TypeScript scaffold with Tailwind CSS, ESLint, Prettier, and Prisma (PostgreSQL).

## Stack

- [Next.js 15](https://nextjs.org/) — App Router, TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- ESLint (`eslint-config-next`) + Prettier (`prettier-plugin-tailwindcss`)
- [Prisma](https://www.prisma.io/) with a PostgreSQL datasource
- [Playwright](https://playwright.dev/) (headless Chromium) for screenshot capture — full
  `playwright` locally, `playwright-core` + `@sparticuz/chromium` on Vercel (see
  [Deploying to Vercel](#deploying-to-vercel))
- [Cloudflare R2](https://developers.cloudflare.com/r2/) for screenshot storage, via the S3-compatible `@aws-sdk/client-s3`
- [Inngest](https://www.inngest.com/) for the background job that generates the roast critique
- [Gemini API](https://ai.google.dev/) (via `@google/genai`) for the critique itself, validated
  with [Zod](https://zod.dev/) — a 4-model fallback chain, not a single model (see
  [Critique generation: Gemini free tier](#critique-generation-gemini-free-tier))
- [`next/og`](https://nextjs.org/docs/app/api-reference/functions/image-response) (Next's built-in `@vercel/og`) for the per-roast share-card image
- [Stripe Checkout](https://stripe.com/docs/checkout) for the one-off "Full Report" purchase
- [`@react-pdf/renderer`](https://react-pdf.org/) for the downloadable full-report PDF
- [`bad-words`](https://www.npmjs.com/package/bad-words) for a basic profanity/brand-safety
  check on generated critiques

## Folder structure

```
app/         Next.js App Router routes, layouts, and pages
components/  Shared React components
lib/         Shared utilities, including the Prisma client singleton (lib/prisma.ts)
prisma/      Prisma schema and migrations
```

## Prerequisites

- Node.js 20+
- A PostgreSQL database (local or hosted)
- A Cloudflare R2 bucket (for screenshot uploads)
- A Gemini API key (for critique generation) — a free-tier key from
  [Google AI Studio](https://aistudio.google.com/apikey) works for development
- A Stripe account in test mode (for the paid report checkout)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Install the Chromium browser Playwright needs for screenshot capture:

   ```bash
   npx playwright install chromium
   ```

3. Set your database connection string in `.env`. For local development without installing
   Postgres, run `npx prisma dev` in a separate terminal (bundles an embedded local Postgres)
   and point `DATABASE_URL` at the connection string it prints. Otherwise, point it at your
   own PostgreSQL instance:

   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/nexroast?schema=public"
   ```

4. Set your R2 credentials and `GEMINI_API_KEY` in `.env` (see
   [Environment variables](#environment-variables)).

5. Apply migrations and generate the Prisma client:

   ```bash
   npx prisma migrate dev
   ```

6. Seed the database with example data:

   ```bash
   npx prisma db seed
   ```

7. In a separate terminal, run the Inngest dev server so `/api/roast` can dispatch the
   critique-generation job locally (it auto-discovers functions from `/api/inngest`):

   ```bash
   npx inngest-cli@latest dev
   ```

8. Set `STRIPE_SECRET_KEY` (a test-mode key from the Stripe dashboard) in `.env`. To receive
   webhooks locally, forward Stripe events to your dev server with the
   [Stripe CLI](https://stripe.com/docs/stripe-cli):

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   This prints a webhook signing secret (`whsec_...`) — set that as `STRIPE_WEBHOOK_SECRET`
   in `.env` and restart the dev server.

## Environment variables

| Variable                        | Description                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | PostgreSQL connection string                                                                                                                                                                                                                                                                      |
| `DIRECT_DATABASE_URL`           | Optional. Direct/unpooled connection string, used only for migrations — see [Connection pooling](#connection-pooling). Falls back to `DATABASE_URL` when unset, which is correct for local dev.                                                                                                   |
| `R2_ACCOUNT_ID`                 | Cloudflare account ID                                                                                                                                                                                                                                                                             |
| `R2_ACCESS_KEY`                 | R2 API token access key ID                                                                                                                                                                                                                                                                        |
| `R2_SECRET_KEY`                 | R2 API token secret access key                                                                                                                                                                                                                                                                    |
| `R2_BUCKET`                     | R2 bucket name                                                                                                                                                                                                                                                                                    |
| `R2_PUBLIC_URL`                 | Public base URL for the bucket (its `r2.dev` subdomain, or a custom domain mapped to it) — R2 has no predictable public URL format to derive this from the other variables                                                                                                                        |
| `GEMINI_API_KEY`                | Gemini API key, used to generate the roast critique. A free-tier key works for dev but is rate-limited (see [Deploying to Vercel](#deploying-to-vercel)).                                                                                                                                         |
| `INNGEST_DEV`                   | Set to `1` for local dev — puts the SDK in permissive dev mode so `inngest-cli dev` can sync without a signing key. Unset in production.                                                                                                                                                          |
| `INNGEST_EVENT_KEY`             | Inngest event key (deployed environments only — not needed for `inngest-cli dev`)                                                                                                                                                                                                                 |
| `INNGEST_SIGNING_KEY`           | Inngest signing key (deployed environments only — not needed for `inngest-cli dev`)                                                                                                                                                                                                               |
| `STRIPE_SECRET_KEY`             | Stripe secret key (test mode locally, e.g. `sk_test_...`)                                                                                                                                                                                                                                         |
| `STRIPE_WEBHOOK_SECRET`         | Signing secret for verifying webhook payloads — from `stripe listen` locally, or the webhook endpoint's signing secret in the Stripe dashboard once deployed                                                                                                                                      |
| `LEAD_NOTIFICATION_WEBHOOK_URL` | Slack or Discord incoming webhook URL for "Get this fixed" lead notifications. Optional — leads still save without it, they just don't get announced.                                                                                                                                             |
| `URL_DENYLIST_DOMAINS`          | Optional, comma-separated extra hostnames/domain suffixes to block from being roasted, on top of the built-in adult-content heuristics — see [Abuse prevention](#abuse-prevention).                                                                                                               |
| `SITE_URL`                      | Canonical production URL, no trailing slash (e.g. `https://nexroast.app`) — used to build absolute links in `robots.txt`/`sitemap.xml`. Optional: falls back to Vercel's production URL, then `http://localhost:3000`. See [Deploying to Vercel](#deploying-to-vercel).                           |
| `NEXT_PUBLIC_CALENDLY_URL`      | Calendly (or similar) booking link for the "Want it professionally done?" CTA and the PDF report's "Book a free call" button — see [Professional help CTA](#professional-help-cta). `NEXT_PUBLIC_` because a client component reads it directly. Optional: that CTA just doesn't render if unset. |

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command                  | Description                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Start the dev server                                                                                                                                                                   |
| `npm run build`          | Applies pending migrations ([scripts/migrate-deploy.mjs](scripts/migrate-deploy.mjs)), then builds. Needs a reachable `DATABASE_URL`; see [Deploying to Vercel](#deploying-to-vercel). |
| `npm run start`          | Start the production server                                                                                                                                                            |
| `npm run lint`           | Run ESLint                                                                                                                                                                             |
| `npm run format`         | Format the codebase with Prettier                                                                                                                                                      |
| `npm run format:check`   | Check formatting without writing changes                                                                                                                                               |
| `npx prisma generate`    | Regenerate the Prisma client                                                                                                                                                           |
| `npx prisma migrate dev` | Create and apply a migration                                                                                                                                                           |
| `npx prisma db seed`     | Run `prisma/seed.ts` to load example data                                                                                                                                              |
| `npx prisma studio`      | Open Prisma Studio to browse the database                                                                                                                                              |
| `npx prisma dev`         | Run an embedded local Postgres for dev                                                                                                                                                 |

A `postinstall` script also runs `prisma generate` automatically after every `npm install`, so the
generated client (gitignored — see [Notes](#notes)) exists before anything tries to import it.

## Data model

- **Roast** — one analysis of a submitted URL: `url`, `screenshotUrl`, `status`
  (`pending` / `processing` / `complete` / `failed`), `score` (0–100, enforced by a DB
  check constraint), `critique` (structured JSON output), `createdAt`, and a nullable
  `unlockedAt` set when the paid report is purchased.
- **LeadCapture** — a "fix it for me" inquiry tied to a `Roast`: `name`, `email`, optional
  `message`, `createdAt`.
- **Event** — a lightweight analytics event: `type` (a free-form string — see
  [Analytics](#analytics) for the set the app actually emits, kept as `string` rather than
  an enum so new event types don't need a migration), an optional `roastId` (`SetNull` on
  delete, so a roast's history survives it), `path`, `metadata` (JSON), `createdAt`.

`prisma/seed.ts` loads two example roasts (one `complete` with a lead capture, one `pending`).

## Pages

- **`/`** ([app/page.tsx](app/page.tsx)) — mobile-first homepage: logo, headline, single URL
  input, submit button. On submit, `POST /api/roast` and redirect to `/roast/[id]`; validation and
  rate-limit errors from the API are shown inline without redirecting. The logo doubles as the
  favicon — see [app/icon.png](app/icon.png), Next's file-convention icon (auto-detected, no code
  needed), resized down from `public/NexRoast-Logo.png` with `sharp` (already present as a
  transitive `next`/`sharp` dependency — see [Notes](#notes)) since the source was 1254×1254 and
  749KB, way oversized for a favicon.
- **`/roast/[id]`** ([app/roast/[id]/page.tsx](app/roast/[id]/page.tsx),
  [components/roast-status.tsx](components/roast-status.tsx)) — polls
  `GET /api/roast/[id]` every 2s while `status` is `pending`/`processing`, showing a
  rotating set of witty loading messages. Once `complete`, renders the score (color-coded,
  never by color alone — see the status chip), the screenshot, and the roast points as
  cards, plus a Share button (Web Share API, falling back to clipboard copy, then to a
  visible selectable link if even that fails — relevant for restrictive in-app browsers
  like TikTok's). Handles `failed` and not-found roasts with their own states.
  Free roasts show the first 2 roast points; the rest are teased behind a paywall CTA
  (Stripe Checkout) that unlocks the full report and a downloadable PDF — see
  [Monetization](#monetization) below. `generateMetadata` sets a per-roast title/description;
  `opengraph-image.tsx` and
  `twitter-image.tsx` (sharing [app/roast/[id]/og-render.tsx](app/roast/[id]/og-render.tsx))
  generate the share-card image via `next/og` (Next's built-in `@vercel/og`), showing the
  URL, score, and headline roast point — with a generic branded fallback for roasts that
  don't exist yet or aren't complete. A "Want it professionally done?" CTA links directly to a
  Calendly booking page — see [Professional help CTA](#professional-help-cta) below.
- **`/robots.txt`** ([app/robots.ts](app/robots.ts)) and **`/sitemap.xml`**
  ([app/sitemap.ts](app/sitemap.ts)) — Next's metadata route conventions, generated at request
  time. The sitemap only lists `/`: roast pages are ephemeral, per-visitor share links rather
  than durable content, so they're excluded from the sitemap and individually marked
  `robots: { index: false, follow: true }` in `generateMetadata` — crawlable (so
  `next/og` unfurls still work when shared), just not indexed.

## API

### `GET /api/roast/[id]`

Returns `{ roast }` for the given ID, or `404` if it doesn't exist. Used by `/roast/[id]`
for polling.

### `POST /api/roast`

Accepts a URL, captures a screenshot of it, uploads that screenshot to R2, and kicks off
critique generation in the background. Screenshot capture happens synchronously in this
request; the critique does not, since an LLM call is too slow to hold the request open for.

Request body:

```json
{ "url": "https://example.com" }
```

Response (`202`):

```json
{ "roast": { "id": "...", "url": "...", "status": "processing", "screenshotUrl": "...", ... } }
```

Behavior:

- Validates the URL and rejects requests targeting localhost, private/link-local IP ranges, or
  hostnames that resolve to them — this endpoint drives a server-side browser, so it's a classic
  SSRF vector without that check (`400`). Bare domains and `www.`-prefixed input without a scheme
  (`example.com`, `www.example.com`) are accepted and normalized to `https://` before validation
  ([lib/url-validation.ts](lib/url-validation.ts)) — friction here is a direct bounce risk, so
  only genuinely malformed or disallowed input gets rejected.
- Rate-limited per IP two ways (see [Abuse prevention](#abuse-prevention)): a 5/minute burst
  limiter and a separate 10/hour sustained-abuse limiter, both `429` with `Retry-After`.
- Rejects denylisted URLs — adult content and anything the operator has added via
  `URL_DENYLIST_DOMAINS` (`400`).
- Creates a `Roast` row up front (`status: "processing"`) and records a `roast_submitted`
  analytics event, then captures the above-the-fold viewport (1440×900, no full-page scroll)
  with headless Chromium, along with the page title, meta description, and load time from
  that same page load.
- Uploads the screenshot to R2 and saves `screenshotUrl` on the roast (status stays
  `processing` — the roast isn't "complete" until it has a critique).
- Sends a `roast/screenshot.captured` event to Inngest with the roast ID, screenshot URL, and
  scraped metadata, and returns immediately.
- On navigation failure (unreachable URL, timeout) the roast is marked `failed` and a `422`
  is returned. On any other failure it's likewise marked `failed` and a `500` is returned.

### Inngest: `generate-roast-critique`

Triggered by `roast/screenshot.captured` ([lib/inngest/functions.ts](lib/inngest/functions.ts)).
Downloads the screenshot (Gemini takes images as inline base64 data, not a URL it fetches itself
— unlike the Claude API this originally used) and sends it plus the scraped metadata to Gemini,
asking for a structured critique validated against a Zod schema
([lib/critique.ts](lib/critique.ts)):

- `score`: 0–100 overall quality.
- `roastPoints`: 4–6 entries, each with a `category` (`design` / `ux` / `conversion` / `speed`
  / `trust`) and a punchy 1–2 sentence critique.
- `biggestWin`: the single highest-leverage fix.

The critique is requested via Gemini's structured output (`responseJsonSchema`, generated from
the Zod schema with `z.toJSONSchema()`), and — since constrained generation isn't the same
guarantee as a schema-validated parse — the response is explicitly re-validated against the Zod
schema **and** a basic profanity/safety filter ([lib/moderation.ts](lib/moderation.ts)) on
receipt.

Rather than one model, `MODELS` in `lib/critique.ts` is an ordered fallback chain of four
(`gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite`) —
see [Critique generation: Gemini free tier](#critique-generation-gemini-free-tier) for why. For
each model, up to two attempts are made: if a response fails to parse, validate, or pass
moderation, it retries once on the _same_ model with a fresh call — a moderation failure is
treated the same as a parse failure and regenerated, not silently redacted, since the goal is a
clean roast, not one with words blanked out. A `429` (rate limit) is different: it skips straight
to the _next_ model rather than retrying a model that's already exhausted for the minute. Only
once every model in the chain has failed does the roast get marked `failed`. On success, it's
updated with `critique`, `score`, and `status: "complete"`.

### `POST /api/roast/[id]/checkout`

Creates a Stripe Checkout session (`mode: "payment"`) for the £9 Full Report, with the roast
ID as both `client_reference_id` and `metadata.roastId` so the webhook can find its way back.
Returns `{ url }` — the client redirects to it. `400` if the roast isn't `complete` yet or is
already unlocked; `404` if it doesn't exist.

### `POST /api/stripe/webhook`

Verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` (`400` on a bad or
missing signature — this is what stops anyone from just POSTing a fake "payment succeeded"
event to unlock a report for free). On `checkout.session.completed`, sets `unlockedAt` on the
referenced roast via `updateMany({ where: { id, unlockedAt: null }, ... })` — the `null` guard
makes it idempotent against Stripe's at-least-once webhook delivery.

### `GET /api/roast/[id]/report.pdf`

Streams back the full PDF report ([lib/pdf/roast-report.tsx](lib/pdf/roast-report.tsx), built
with `@react-pdf/renderer`) — all roast points, the screenshot, and a closing pitch for Nexiora
Studio. Gated on `unlockedAt` being set (`402` if not) — checked here again, not just hidden in
the UI, since the UI's paywall is trivially bypassed by anyone who guesses or bookmarks this
URL directly.

### `POST /api/roast/[id]/lead`

Saves a lead capture and (best-effort) notifies the team via `LEAD_NOTIFICATION_WEBHOOK_URL`
([lib/notify-lead.ts](lib/notify-lead.ts)). **Not currently called from the UI** — see
[Professional help CTA](#professional-help-cta) for what replaced it. Left working in case it's
wired back up later.

Request body: `{ name, email, message?, company? }` — `company` is a honeypot field, not a real
field a form asks for.

Behavior:

- Rate-limited per IP, namespaced separately from the roast-creation limiter (`429`).
- Honeypot check: if `company` is non-empty, responds `201` without saving or notifying
  anything — bots get no signal they were caught.
- Validates `name` (non-empty) and `email` (basic format check), both length-capped (`400`
  otherwise); `404` if the roast doesn't exist.
- Saves to `LeadCapture`, records a `lead_submitted` analytics event, then sends the webhook
  notification. A notification failure is logged but doesn't fail the request — the lead is
  already safely saved either way.

### `POST /api/analytics/event`

Records a client-initiated analytics event (`page_view` or `share_click` — see
[Analytics](#analytics)). Server-initiated events (`roast_submitted`, `paywall_conversion`,
`lead_submitted`) don't go through this route; they call `lib/analytics.ts`'s `track()`
directly since they're already running server-side. Rate-limited per IP (60/minute — higher
than the other limiters, since one page view can trigger a few legitimate calls).

### `GET /api/health`

Liveness/readiness check for uptime monitors and Vercel's own deployment health checks — runs
`SELECT 1` against the database and returns `{ status: "ok", timestamp }` (`200`), or
`{ status: "error", timestamp }` (`503`) if the database isn't reachable. Unauthenticated and
not rate-limited, same as any standard health-check endpoint.

## Monetization

Free roasts show the first 2 roast points; the rest are teased ("+N more issues found") behind
a paywall card that presents two options side by side, not just one — see
[components/roast-status.tsx](components/roast-status.tsx)'s `PaywallCTA`:

- **"Want to try to fix it yourself?"** — the £9 Stripe Checkout flow, unchanged mechanically
  from before, just reframed. Paying redirects through Checkout and back to
  `/roast/[id]?checkout=success`; the actual unlock happens asynchronously via the webhook, which
  can lag the redirect by a couple of seconds, so the client briefly keeps polling (capped at
  ~40s) showing a "Confirming your payment…" message until `unlockedAt` appears. Once unlocked:
  all roast points and the biggest win are shown, and a "Download PDF report" button appears.
- **"Want it professionally done?"** — see [Professional help CTA](#professional-help-cta) below.

## Professional help CTA

`BookCallCTA` in [components/roast-status.tsx](components/roast-status.tsx) is a direct external
link to a Calendly booking page (`NEXT_PUBLIC_CALENDLY_URL`), not an in-app form — anyone
clicking it already knows they want to talk to a person, so it skips straight to booking a slot
instead of adding a form-then-follow-up-email step in between. Renders nothing if the env var
isn't set. Shown in two places: as the second half of the paywall card (before unlock), and as
its own card below the biggest win (after unlock, since even someone who bought the DIY PDF might
still want it done for them). Clicks are tracked as a `book_call_click` analytics event. The same
Calendly URL also appears as a button in the downloadable PDF report — see
[lib/pdf/roast-report.tsx](lib/pdf/roast-report.tsx).

This replaced an earlier in-app "Get this fixed for me" lead-capture dialog (name/email/message
form, honeypot spam protection, Slack/Discord notification via `LEAD_NOTIFICATION_WEBHOOK_URL`).
That backend — `app/api/roast/[id]/lead/route.ts`, `lib/notify-lead.ts`, the `LeadCapture` Prisma
model, the `lead_submitted` event type — is still there and still functions if called, but nothing
in the UI calls it anymore. It was left in place rather than torn out (including the DB table)
since removing it is a one-way door and wasn't explicitly asked for; ask if you want it fully
removed.

## Analytics

A single `Event` table ([lib/analytics.ts](lib/analytics.ts)) rather than a third-party tool
(PostHog etc.) — consistent with the rest of the stack, needs no new account/API key, and is
enough for "lightweight." `track()` never throws; a failure is logged and swallowed so
analytics can't be the reason a real request fails. Five event types, matching the funnel this
app cares about:

| Type                 | Fired from                           | Trigger                                                              |
| -------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `page_view`          | Client (`POST /api/analytics/event`) | Homepage or `/roast/[id]` mounts                                     |
| `share_click`        | Client (`POST /api/analytics/event`) | Share button clicked                                                 |
| `roast_submitted`    | Server (`POST /api/roast`)           | A `Roast` row is created                                             |
| `paywall_conversion` | Server (Stripe webhook)              | A roast is actually unlocked (once — see the idempotency note above) |
| `lead_submitted`     | Server (`POST /api/roast/[id]/lead`) | A real (non-honeypot) lead is saved                                  |

Client events go through `lib/analytics-client.ts`'s `trackClient()`, which prefers
`navigator.sendBeacon` (survives the page unload that a share-click or navigation can trigger)
and falls back to a keepalive `fetch`. Server-originated events call `track()` directly — no
HTTP round-trip needed since they're already running server-side.

Query it directly for now (`npx prisma studio`, or raw SQL) — there's no dashboard UI, since
that's beyond "lightweight tracking."

## Abuse prevention

- **Per-IP roast limits** ([lib/rate-limit.ts](lib/rate-limit.ts), used from
  `POST /api/roast`): a 5/minute burst limiter (catches rapid-fire/scripted bursts) plus a
  separate 10/hour sustained limiter (catches a patient abuser staying just under the burst
  limit — 5/min sustained would otherwise reach 300/hour, which is a lot of Playwright +
  Gemini spend for one visitor). `checkRateLimit()` takes an optional `{ windowMs,
maxRequests }` so both limiters share one implementation, namespaced by key prefix
  (`roast-hourly:`, `lead:`, `analytics:`, and the bare IP for the burst limiter) so they
  don't share buckets.
- **These are per-IP, not global.** On the Gemini free tier the binding constraint is likely to
  be Google's own ~10 requests/minute cap across _all_ users combined (see
  [Deploying to Vercel](#deploying-to-vercel)), not any per-IP limit above — a handful of
  concurrent visitors can exhaust it. There's no app-level global limiter or queue in front of
  `generateCritique()` yet; a burst past Gemini's cap surfaces as the roast being marked
  `failed`, not a graceful queue/backoff.
- **URL denylist** ([lib/url-denylist.ts](lib/url-denylist.ts)): blocks submissions before any
  Playwright/Gemini spend happens. Built-in checks are a coarse heuristic, not a threat-intel
  feed — adult-content gTLDs (`.xxx`, `.porn`, etc.), a short list of well-known adult site
  hostnames/labels, plus whatever the operator adds via `URL_DENYLIST_DOMAINS` (matched
  against subdomains too). There's no live malware/phishing feed wired in; a production
  deployment that needs one would integrate something like Google Safe Browsing here.
- **Output moderation** ([lib/moderation.ts](lib/moderation.ts)): see the
  `generate-roast-critique` section above — a `bad-words` profanity check runs on every
  generated critique before it's ever stored, with the existing retry-once mechanism reused
  to regenerate rather than redact.

## Deploying to Vercel

### Environment variable checklist

Set these in Project Settings → Environment Variables for the Production environment (and again
for Preview if preview deployments should work end-to-end). See
[Environment variables](#environment-variables) above for what each one does.

| Variable                                                                            | Required?   | Production note                                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                      | Required    | A real hosted Postgres, not the local `prisma dev` embedded instance — Neon's **pooled** connection string. See [connection pooling](#connection-pooling) below.                              |
| `DIRECT_DATABASE_URL`                                                               | Recommended | Neon's **direct/unpooled** connection string, used only for `prisma migrate deploy`. See [connection pooling](#connection-pooling) below.                                                     |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` / `R2_BUCKET` / `R2_PUBLIC_URL` | Required    | Same R2 bucket works for dev and prod; just make sure `R2_PUBLIC_URL` is genuinely public — the critique step downloads the screenshot from it directly.                                      |
| `GEMINI_API_KEY`                                                                    | Required    | Free-tier keys work but are rate-limited well below what real traffic needs — see [Critique generation: Gemini free tier](#critique-generation-gemini-free-tier) below.                       |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`                                         | Required    | From the Inngest dashboard once the app is synced (see below). Leave `INNGEST_DEV` **unset** in production — it puts the SDK in a permissive dev mode that skips signature verification.      |
| `STRIPE_SECRET_KEY`                                                                 | Required    | Switch to a **live-mode** key (`sk_live_...`) once you're ready to take real payments; keep `sk_test_...` on Preview deployments.                                                             |
| `STRIPE_WEBHOOK_SECRET`                                                             | Required    | From the webhook endpoint you create in the Stripe Dashboard pointing at `https://<your-domain>/api/stripe/webhook` — this is a different secret from the one `stripe listen` prints locally. |
| `LEAD_NOTIFICATION_WEBHOOK_URL`                                                     | Optional    | Not currently used by the UI — see [Professional help CTA](#professional-help-cta). Only matters if `POST /api/roast/[id]/lead` gets wired back up to something.                              |
| `URL_DENYLIST_DOMAINS`                                                              | Optional    |                                                                                                                                                                                               |
| `SITE_URL`                                                                          | Optional    | Set to your real domain (e.g. `https://nexroast.app`) once one is attached — without it, `robots.txt`/`sitemap.xml` fall back to Vercel's auto-generated `*.vercel.app` production URL.       |
| `NEXT_PUBLIC_CALENDLY_URL`                                                          | Required    | Without it, the "Want it professionally done?" CTA and the PDF's "Book a free call" button silently don't render — not a build error, just a missing conversion path.                         |

### Prisma migrations

`npm run build` applies pending migrations before building (see [Scripts](#scripts) and
[Connection pooling](#connection-pooling) for why that's a wrapper script rather than a plain
`prisma migrate deploy`), so migrations apply automatically as part of every Vercel build using
whichever `DATABASE_URL`/`DIRECT_DATABASE_URL` are configured for that deployment's environment —
no separate CI step needed. `migrate deploy` only applies migrations already committed under
`prisma/migrations/`; it never generates new ones or prompts, so it's safe to run unattended, but
it does mean a broken migration fails the whole build (by design — better than deploying app code
against a half-migrated schema).

Two things worth knowing:

- **Preview deployments migrate too.** If Preview environment variables point at the same
  database as Production (easy to do by accident), every PR build will run `migrate deploy`
  against production. Give Preview its own database, or a branched one if your Postgres provider
  supports it (Neon and Prisma Postgres both do).
- The build needs a **reachable** `DATABASE_URL` — this is also true locally now (see
  [Scripts](#scripts)).

### Connection pooling

Each serverless invocation can open its own `pg` connection pool (`lib/prisma.ts`'s singleton
caching helps within a single warm instance, but not across concurrent cold ones), which adds up
fast against a traditional Postgres `max_connections` limit under real traffic. Neon (this
project's recommended provider — also true of Supabase, Vercel Postgres, and Prisma Postgres)
pools for you via PgBouncer, but that means **two different connection strings** matter:

- **Pooled** — Neon's default connection string (hostname has a `-pooler` suffix, e.g.
  `ep-xxxxx-pooler.region.aws.neon.tech`). Set this as `DATABASE_URL`; it's what the app uses for
  every query at runtime.
- **Direct/unpooled** — same project, hostname without `-pooler`. Set this as
  `DIRECT_DATABASE_URL`. Prisma Migrate uses advisory locks that don't reliably survive
  PgBouncer's transaction-mode pooling, so migrations need the direct connection even though
  normal queries don't.

The Prisma version this project uses doesn't have a `directUrl` datasource field (verified against
the installed `@prisma/config` types, not just recalled — an earlier version of this doc was
wrong about that), and `migrate deploy` has no flag to override its connection string either — it
only ever reads `datasource.url` from `prisma.config.ts`. So `npm run build` doesn't call
`prisma migrate deploy` directly; it runs
[scripts/migrate-deploy.mjs](scripts/migrate-deploy.mjs) first, which sets `DATABASE_URL` to
`DIRECT_DATABASE_URL` (when present) for just that one subprocess before handing off. The app
itself always uses the real `DATABASE_URL` (the pooled one) — the override never reaches it.

Both connection strings are visible on the same "Connect" panel in the Neon dashboard — copy the
pooled one as `DATABASE_URL` and the direct one as `DIRECT_DATABASE_URL` into Vercel's environment
variables. Locally, `DIRECT_DATABASE_URL` can stay unset (it falls back to `DATABASE_URL`, and the
embedded `prisma dev` instance has no pooler to route around anyway).

### Screenshot capture: Playwright on Vercel

Vercel's serverless functions don't have anywhere to put the ~300MB Chromium download that
`npx playwright install chromium` normally fetches — no persistent disk, and it would blow past
the function size limit anyway. `lib/screenshot.ts` handles this by branching on `process.env.VERCEL`:

- **Locally**: `playwright-core`'s `chromium.launch()` finds the browser `npx playwright install
chromium` already put in the shared cache — no extra config.
- **On Vercel**: launches via [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium), a
  Chromium build compressed specifically for serverless/Lambda-style environments (`args` +
  `executablePath()` from the package, same `playwright-core` `chromium.launch()` call).

This keeps screenshot capture first-party (no new vendor account, consistent with the rest of the
app), but it's worth knowing the trade-offs before relying on it:

- **Version drift.** `@sparticuz/chromium` doesn't track every Chromium release exactly —
  `package.json` pins it to the closest version to what the installed `playwright`/`playwright-core`
  version (`1.62.1`, Chromium 151) expects, but it's not a guaranteed exact match, and the two
  need to be bumped together deliberately rather than left on independent semver ranges. Check
  [Puppeteer's Chromium support table](https://pptr.dev/chromium-support) when upgrading either.
- **Cold starts are slower.** Extracting the compressed binary to `/tmp` on a cold invocation adds
  latency on top of the browser launch itself — `POST /api/roast` already sets
  `export const maxDuration = 30`, which should cover it, but watch real p99s after deploying.
- **Memory.** `@sparticuz/chromium` recommends 1600MB+; Vercel's default function memory may be
  lower depending on your plan. Raise it for `/api/roast` in Project Settings → Functions (with
  Fluid Compute, memory is configured there rather than in `vercel.json`).
- **Unverified in this environment.** This path was implemented against the documented
  `@sparticuz/chromium` + `playwright-core` API and exercised locally with the full `playwright`
  browser, but the `@sparticuz/chromium` binary is Linux-only and can't actually run on this
  Windows dev machine — **test screenshot capture on a real Vercel preview deployment** before
  relying on it in production.

**If it turns out to be unreliable in practice** — the version-drift risk above is the likely
failure mode — the simpler fix for Vercel specifically is switching to a hosted screenshot API
(e.g. ScreenshotOne, urlbox, ApiFlash, Browserless): one HTTP call, no binary/runtime concerns,
no cold-start Chromium extraction. That trades "no new vendor" for "no serverless Chromium
fragility," which past a certain traffic level is usually the better trade on Vercel. Swapping it
in would mean replacing `captureScreenshot()` in `lib/screenshot.ts` with an HTTP call and adding
whichever API key that vendor requires.

### Critique generation: Gemini free tier

`lib/critique.ts` calls Gemini once per roast, twice per model if the moderation retry fires. A
free-tier `GEMINI_API_KEY` works, but as of writing the free tier is capped around
**10 requests/minute and 1,500/day** platform-wide for the key, _per model_ (not per-IP — check
current numbers at [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit), they
change). That's lower than what this app's own per-IP rate limiters allow through (see
[Abuse prevention](#abuse-prevention)), meaning **Google's cap, not this app's, is the real
bottleneck** once there's any concurrent traffic — a handful of people roasting sites at the same
time can exhaust a single model's quota.

To absorb that, `generateCritique()` doesn't call just one model — `MODELS` is an ordered fallback
chain (currently four: `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`,
`gemini-3.1-flash-lite`). Each Gemini model has its own separate rate-limit bucket, so a `429` on
one moves to the next rather than failing the roast outright — see the
[Inngest: generate-roast-critique](#inngest-generate-roast-critique) section above for the exact
retry-vs-fallback logic. All four were verified directly against the API (not just docs, which
drift) for multimodal input + structured JSON output, and none are preview/experimental models.
This buys real headroom (4× the effective throughput, roughly) but doesn't remove the ceiling
entirely — enough sustained concurrent traffic can still exhaust all four in the same minute, at
which point the roast is marked `failed` (there's still no queue or backoff, just a wider net).

Also worth knowing: on the free tier, Google may use submitted prompts and images — i.e. the
screenshots people submit and the critiques generated from them — to improve their products, and
human reviewers may see them. The paid tier turns this off. Before sending any real traffic to
this: **upgrade `GEMINI_API_KEY` to a paid-tier key** (via a Cloud Billing account in AI Studio) —
this raises the rate limits substantially and stops that data usage.

### Health check and SEO routes

`GET /api/health` ([API](#get-apihealth)), `robots.txt`, and `sitemap.xml`
([Pages](#pages)) all work out of the box with no extra configuration — point an uptime monitor
or Vercel's deployment health check at `/api/health`.

### Deploy checklist

1. Push a real `DATABASE_URL` (see [connection pooling](#connection-pooling)) and the rest of the
   [environment variable checklist](#environment-variable-checklist) above into Vercel's Production
   environment.
2. Connect the repo and deploy — the build runs `prisma migrate deploy` automatically.
3. In the Inngest dashboard, sync the app (Vercel integration, or manually point it at
   `https://<your-domain>/api/inngest`) and copy the resulting event/signing keys into
   `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`.
4. In the Stripe Dashboard, add a webhook endpoint for `https://<your-domain>/api/stripe/webhook`
   and set `STRIPE_WEBHOOK_SECRET` to its signing secret; switch `STRIPE_SECRET_KEY` to a live key
   when ready to take real payments.
5. Raise the `/api/roast` function's memory if needed (see the Playwright section above), and hit
   `POST /api/roast` on the deployed URL to confirm screenshot capture actually works before
   calling it done — this is the one piece that can't be verified locally.
6. Point `SITE_URL` at your real domain once one is attached, and hit `/robots.txt` and
   `/sitemap.xml` to confirm they resolve to it.

## Notes

- The generated Prisma client is output to `lib/generated/prisma` and is gitignored — run `npx prisma generate` after cloning or pulling.
- `prisma.config.ts` reads `DATABASE_URL` from `.env` via `dotenv` and configures the seed command.
- `.env` is gitignored; share connection strings with teammates out-of-band.
- The Postgres client uses the `@prisma/adapter-pg` driver adapter (Prisma 7's client generator requires an explicit adapter rather than reading `DATABASE_URL` automatically); see `lib/prisma.ts`.
- Inngest functions are registered at `/api/inngest` ([app/api/inngest/route.ts](app/api/inngest/route.ts)); the Inngest dev server (`npx inngest-cli@latest dev`) auto-discovers them from there.
- The screenshot must be reachable at its R2 `screenshotUrl` for the critique step to download it — this only works once `R2_PUBLIC_URL` points at an actually-public bucket.
- `sharp` (used once, to generate `app/icon.png` from the source logo) isn't an explicit dependency — it's already present transitively via `next`'s own Image Optimization support. If that ever changes, add it explicitly rather than relying on the transitive install.
