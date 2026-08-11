import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { track } from "@/lib/analytics";
import { getStripe } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * The only thing that grants access to a paid audit.
 *
 * Deliberately not the `?checkout=success` redirect: that is just a URL a
 * visitor can type. Payment is confirmed here, against a signature Stripe
 * produced with the webhook secret.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 400 },
    );
  }

  // Must be the raw body — parsing it first would break the signature.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
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
    const auditId = session.client_reference_id ?? session.metadata?.auditId;

    if (!auditId) {
      console.error(
        "checkout.session.completed carried no auditId",
        session.id,
      );
      // 200 anyway: Stripe would otherwise retry an event we can never handle.
      return NextResponse.json({ received: true });
    }

    // updateMany plus the null check makes this idempotent — Stripe delivers
    // at least once, and a duplicate must not overwrite the original unlock
    // timestamp or double-count the conversion.
    const result = await prisma.audit.updateMany({
      where: { id: auditId, unlockedAt: null },
      data: { unlockedAt: new Date() },
    });

    if (result.count > 0) {
      await track("paywall_conversion", { auditId });
    }
  }

  return NextResponse.json({ received: true });
}
