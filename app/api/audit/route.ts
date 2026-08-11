import { NextRequest, NextResponse } from "next/server";
import { trackAsync } from "@/lib/analytics";
import { normaliseHost } from "@/lib/audit/visibility";
import { inngest } from "@/lib/inngest/client";
import { auditRequested } from "@/lib/inngest/events";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { isUrlDenylisted } from "@/lib/url-denylist";
import {
  InvalidUrlError,
  parseAndValidatePublicUrl,
} from "@/lib/url-validation";

// Still Node — DNS resolution in the SSRF check needs it — but no longer
// long-running. Capture moved into the Inngest function, so this handler now
// validates, records and queues, and nothing here takes seconds.
export const runtime = "nodejs";

// A sustained-abuse guard distinct from the burst limiter below: someone
// patient enough to stay just under the burst limit every minute could
// otherwise reach 5/min = 300/hour, which is a lot of Playwright and Gemini
// spend for one visitor.
const MAX_AUDITS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

function tooMany(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/**
 * A connection-level failure reaching Inngest is almost always the dev server
 * simply not running, and a bare ECONNREFUSED gives no clue about that.
 */
function explainDispatchFailure(error: unknown): void {
  const code =
    (error as { cause?: { code?: string }; code?: string } | null)?.cause
      ?.code ?? (error as { code?: string } | null)?.code;

  if (code === "ECONNREFUSED" && process.env.INNGEST_DEV) {
    console.error(
      "Could not reach the Inngest dev server. Start it in a second terminal:\n" +
        "  npx inngest-cli@latest dev",
    );
    return;
  }

  console.error("Could not queue the audit", error);
}

export async function POST(request: NextRequest) {
  const burstKey = rateLimitKey("audit-burst", request);
  const hourlyKey = rateLimitKey("audit-hourly", request);

  // No usable client identity means no way to rate limit, and this endpoint
  // spends real money per call — refuse rather than allow an unbounded one.
  if (!burstKey || !hourlyKey) {
    return NextResponse.json(
      { error: "Could not identify the request source." },
      { status: 400 },
    );
  }

  const burst = await checkRateLimit(burstKey);
  if (!burst.allowed) {
    return tooMany(
      "Too many requests. Please try again shortly.",
      burst.retryAfterSeconds,
    );
  }

  const hourly = await checkRateLimit(hourlyKey, {
    windowMs: HOUR_MS,
    maxRequests: MAX_AUDITS_PER_HOUR,
  });
  if (!hourly.allowed) {
    return tooMany(
      "You've hit the hourly audit limit. Try again later.",
      hourly.retryAfterSeconds,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const rawUrl = (body as { url?: unknown } | null)?.url;
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return NextResponse.json({ error: '"url" is required.' }, { status: 400 });
  }

  // Stays inline: it's cheap, and it's the difference between a useful 400 and
  // a queued job that fails a minute later. It also resolves DNS, so typos and
  // dead domains are still caught here rather than becoming failed audits.
  let validatedUrl: URL;
  try {
    validatedUrl = await parseAndValidatePublicUrl(rawUrl.trim());
  } catch (error) {
    const message =
      error instanceof InvalidUrlError ? error.message : "Invalid URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (isUrlDenylisted(validatedUrl)) {
    return NextResponse.json(
      { error: "This URL can't be audited." },
      { status: 400 },
    );
  }

  const url = validatedUrl.toString();
  const host = normaliseHost(url);

  const audit = await prisma.audit.create({
    data: { url, host, status: "pending" },
  });
  trackAsync("audit_submitted", { auditId: audit.id, metadata: { host } });

  try {
    await inngest.send(auditRequested.create({ auditId: audit.id, url, host }));
  } catch (error) {
    explainDispatchFailure(error);

    // Nothing expensive has happened yet, which is the point of queueing
    // first — so this costs the user a retry, not a capture. The row is marked
    // failed so it can't sit at "pending" forever with no job behind it.
    await prisma.audit
      .update({ where: { id: audit.id }, data: { status: "failed" } })
      .catch(() => {});

    // 503, not 500: a dependency is unavailable, and the request is worth
    // repeating. Deliberately says nothing about the user's website — it was
    // never loaded.
    return NextResponse.json(
      { error: "Couldn't start the analysis just now. Please try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ audit }, { status: 202 });
}
