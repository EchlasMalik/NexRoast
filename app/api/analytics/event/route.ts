import { NextRequest, NextResponse } from "next/server";
import { track, type EventType } from "@/lib/analytics";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Only client-initiated events go through this endpoint. Events that
// originate server-side (roast_submitted, paywall_conversion, lead_submitted)
// call lib/analytics.ts's track() directly — no HTTP round-trip needed.
const CLIENT_EVENT_TYPES: EventType[] = [
  "page_view",
  "share_click",
  "book_call_click",
];

export async function POST(request: NextRequest) {
  // A generous but real limit — this is a public, unauthenticated endpoint
  // that writes to the database, so it needs its own guard against flooding.
  const rateLimit = checkRateLimit(`analytics:${getClientIp(request)}`, {
    windowMs: 60_000,
    maxRequests: 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const data = body as {
    type?: unknown;
    roastId?: unknown;
    path?: unknown;
  } | null;

  if (
    typeof data?.type !== "string" ||
    !CLIENT_EVENT_TYPES.includes(data.type as EventType)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await track(data.type as EventType, {
    roastId: typeof data.roastId === "string" ? data.roastId : undefined,
    path: typeof data.path === "string" ? data.path.slice(0, 200) : undefined,
  });

  return NextResponse.json({ ok: true });
}
