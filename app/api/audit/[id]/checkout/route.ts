import { NextRequest, NextResponse } from "next/server";
import { trackAsync } from "@/lib/analytics";
import { createAuditCheckoutSession, isBillingConfigured } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't available right now." },
      { status: 503 },
    );
  }

  const key = rateLimitKey("checkout", request);
  if (key) {
    const limit = await checkRateLimit(key, {
      windowMs: 60_000,
      maxRequests: 10,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }
  }

  const { id } = await params;
  const audit = await prisma.audit.findUnique({ where: { id } });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  }
  if (audit.status !== "complete") {
    return NextResponse.json(
      { error: "This audit isn't ready yet." },
      { status: 400 },
    );
  }
  // Nothing left to sell, and charging twice for the same audit would be the
  // worst possible bug in this route.
  if (audit.unlockedAt) {
    return NextResponse.json(
      { error: "This audit is already unlocked." },
      { status: 400 },
    );
  }

  try {
    const url = await createAuditCheckoutSession({
      auditId: audit.id,
      displayName: audit.businessName ?? audit.host,
      host: audit.host,
      origin: request.nextUrl.origin,
    });

    if (!url) throw new Error("Stripe returned no checkout URL.");

    trackAsync("checkout_started", { auditId: audit.id });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to create checkout session", error);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 500 },
    );
  }
}
