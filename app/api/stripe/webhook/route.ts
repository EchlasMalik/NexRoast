import { NextResponse } from "next/server";
import Stripe from "stripe";
import { track } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 400 },
    );
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const roastId = session.client_reference_id ?? session.metadata?.roastId;

    if (!roastId) {
      console.error(
        "checkout.session.completed with no roastId reference",
        session.id,
      );
      return NextResponse.json({ received: true });
    }

    // updateMany + a null-check in the where clause makes this idempotent:
    // a duplicate delivery of the same event (Stripe retries at-least-once)
    // won't stomp an unlock timestamp that's already set.
    const result = await prisma.roast.updateMany({
      where: { id: roastId, unlockedAt: null },
      data: { unlockedAt: new Date() },
    });

    // Only count it once — a duplicate delivery matches zero rows above
    // (already unlocked), so this naturally doesn't double-track.
    if (result.count > 0) {
      await track("paywall_conversion", { roastId });
    }
  }

  return NextResponse.json({ received: true });
}
