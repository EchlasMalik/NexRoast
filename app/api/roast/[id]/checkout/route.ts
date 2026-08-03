import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FULL_REPORT_CURRENCY,
  FULL_REPORT_PRICE_PENCE,
  stripe,
} from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const roast = await prisma.roast.findUnique({ where: { id } });
  if (!roast) {
    return NextResponse.json({ error: "Roast not found." }, { status: 404 });
  }
  if (roast.status !== "complete") {
    return NextResponse.json(
      { error: "This roast isn't ready yet." },
      { status: 400 },
    );
  }
  if (roast.unlockedAt) {
    return NextResponse.json(
      { error: "This report is already unlocked." },
      { status: 400 },
    );
  }

  const origin = request.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: roast.id,
      metadata: { roastId: roast.id },
      // Lets a promotion code field show up on the Checkout page — how a
      // 100%-off coupon (e.g. for personal/marketing use) gets redeemed.
      // See README's "Bypassing payment for yourself" for how to set one up.
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: FULL_REPORT_CURRENCY,
            unit_amount: FULL_REPORT_PRICE_PENCE,
            product_data: {
              name: "NexRoast Full Report",
              description: `Full roast report for ${roast.url}`,
            },
          },
        },
      ],
      success_url: `${origin}/roast/${roast.id}?checkout=success`,
      cancel_url: `${origin}/roast/${roast.id}?checkout=cancelled`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create checkout session", error);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 500 },
    );
  }
}
