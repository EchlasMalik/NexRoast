import { NextRequest, NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { notifyLead } from "@/lib/notify-lead";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 320;
const MAX_MESSAGE_LENGTH = 5000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Namespaced so this doesn't share a bucket with the roast-creation
  // rate limiter — they're different actions with different abuse profiles.
  const rateLimit = checkRateLimit(`lead:${getClientIp(request)}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
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

  const data = body as {
    name?: unknown;
    email?: unknown;
    message?: unknown;
    company?: unknown; // honeypot — real users never see or fill this field
  } | null;

  // Bots that auto-fill every field trip this. Report success without
  // saving or notifying anyone, so the bot has no signal it was caught.
  if (typeof data?.company === "string" && data.company.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const name = typeof data?.name === "string" ? data.name.trim() : "";
  const email = typeof data?.email === "string" ? data.email.trim() : "";
  const message =
    typeof data?.message === "string" && data.message.trim().length > 0
      ? data.message.trim()
      : null;

  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: '"name" is required.' }, { status: 400 });
  }
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }
  if (message && message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "Message is too long." },
      { status: 400 },
    );
  }

  const roast = await prisma.roast.findUnique({ where: { id } });
  if (!roast) {
    return NextResponse.json({ error: "Roast not found." }, { status: 404 });
  }

  const lead = await prisma.leadCapture.create({
    data: { roastId: roast.id, name, email, message },
  });
  await track("lead_submitted", { roastId: roast.id });

  try {
    await notifyLead({
      name,
      email,
      message,
      roastUrl: roast.url,
      roastLink: `${request.nextUrl.origin}/roast/${roast.id}`,
      score: roast.score,
    });
  } catch (error) {
    // The lead is already saved — a failed notification shouldn't fail the
    // user's submission. It just means someone has to check the DB instead.
    console.error("Failed to send lead notification", error);
  }

  return NextResponse.json({ ok: true, lead }, { status: 201 });
}
