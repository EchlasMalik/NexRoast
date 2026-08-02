import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-07-29.dahlia",
});

// £9.00 one-off — the low end of the plan's £9–£19 "impulse buy" range.
export const FULL_REPORT_PRICE_PENCE = 900;
export const FULL_REPORT_CURRENCY = "gbp";
