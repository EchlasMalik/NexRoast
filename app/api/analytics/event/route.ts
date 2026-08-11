import { NextRequest, NextResponse } from "next/server";
import { track, type EventType } from "@/lib/analytics";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Only client-initiated events go through this endpoint. Events that
// originate server-side (audit_submitted, audit_completed) call track()
// directly — no HTTP round-trip needed.
const CLIENT_EVENT_TYPES: EventType[] = [
  "page_view",
  "share_click",
  "book_call_click",
  "tiktok_image_download",
  "pdf_download",
  "copy_fix_clicked",
];

/** cuid() — what every audit id looks like. Anything else is not worth a query. */
const ID_PATTERN = /^[a-z0-9]{20,32}$/i;

function reject(status: number, headers?: HeadersInit) {
  return NextResponse.json({ ok: false }, { status, headers });
}

export async function POST(request: NextRequest) {
  // A generous but real limit — this is a public, unauthenticated endpoint
  // that writes to the database, so it needs its own guard against flooding.
  const key = rateLimitKey("analytics", request);
  if (key) {
    const limit = await checkRateLimit(key, {
      windowMs: 60_000,
      maxRequests: 60,
    });
    if (!limit.allowed) {
      return reject(429, { "Retry-After": String(limit.retryAfterSeconds) });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reject(400);
  }

  const data = body as {
    type?: unknown;
    auditId?: unknown;
    path?: unknown;
  } | null;

  if (
    typeof data?.type !== "string" ||
    !CLIENT_EVENT_TYPES.includes(data.type as EventType)
  ) {
    return reject(400);
  }

  // The id is validated and checked to exist before it's written. Previously
  // any string was accepted, so a bogus value caused a foreign-key violation
  // that was silently swallowed — the event simply vanished with no signal.
  let auditId: string | undefined;
  if (typeof data.auditId === "string" && ID_PATTERN.test(data.auditId)) {
    const exists = await prisma.audit.findUnique({
      where: { id: data.auditId },
      select: { id: true },
    });
    if (exists) auditId = exists.id;
  }

  await track(data.type as EventType, {
    auditId,
    path: typeof data.path === "string" ? data.path.slice(0, 200) : undefined,
  });

  return NextResponse.json({ ok: true });
}
