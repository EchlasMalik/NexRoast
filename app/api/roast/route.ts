import { NextRequest, NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { inngest } from "@/lib/inngest/client";
import { screenshotCaptured } from "@/lib/inngest/events";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { uploadScreenshot } from "@/lib/r2";
import { captureScreenshot, ScreenshotError } from "@/lib/screenshot";
import { isUrlDenylisted } from "@/lib/url-denylist";
import {
  InvalidUrlError,
  parseAndValidatePublicUrl,
} from "@/lib/url-validation";

// Playwright needs the Node.js runtime, and browser launch + navigation +
// upload can comfortably exceed the default serverless timeout.
export const runtime = "nodejs";
export const maxDuration = 30;

// A sustained-abuse guard distinct from the burst limiter below: someone
// patient enough to stay just under the burst limit every minute could
// otherwise reach 5/min = 300/hour, which is a lot of Playwright + Claude
// spend for one visitor.
const MAX_ROASTS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const hourlyLimit = checkRateLimit(`roast-hourly:${ip}`, {
    windowMs: HOUR_MS,
    maxRequests: MAX_ROASTS_PER_HOUR,
  });
  if (!hourlyLimit.allowed) {
    return NextResponse.json(
      { error: "You've hit the hourly roast limit. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(hourlyLimit.retryAfterSeconds) },
      },
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
      { error: "This URL can't be roasted." },
      { status: 400 },
    );
  }

  const roast = await prisma.roast.create({
    data: { url: validatedUrl.toString(), status: "processing" },
  });
  await track("roast_submitted", {
    roastId: roast.id,
    metadata: { url: roast.url },
  });

  try {
    const capture = await captureScreenshot(validatedUrl.toString());
    const screenshotUrl = await uploadScreenshot(
      `roasts/${roast.id}.png`,
      capture.screenshot,
    );

    const updated = await prisma.roast.update({
      where: { id: roast.id },
      data: { screenshotUrl },
    });

    // Screenshot capture is done, but the roast isn't "complete" until the
    // critique is generated — that happens asynchronously in an Inngest
    // function so slow LLM calls don't hold this request open.
    await inngest.send(
      screenshotCaptured.create({
        roastId: roast.id,
        url: validatedUrl.toString(),
        screenshotUrl,
        title: capture.title,
        description: capture.description,
        loadTimeMs: capture.loadTimeMs,
      }),
    );

    return NextResponse.json({ roast: updated }, { status: 202 });
  } catch (error) {
    await prisma.roast
      .update({ where: { id: roast.id }, data: { status: "failed" } })
      .catch(() => {});

    if (error instanceof ScreenshotError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("Failed to process roast", error);
    return NextResponse.json(
      { error: "Something went wrong while capturing the screenshot." },
      { status: 500 },
    );
  }
}
