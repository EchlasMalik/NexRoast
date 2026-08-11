import Stripe from "stripe";
import { FULL_AUDIT_CURRENCY, FULL_AUDIT_PRICE_PENCE } from "./price";

/**
 * Billing for the full audit.
 *
 * The free audit is substantial on purpose — score, every category breakdown,
 * summary, strengths and the first issues — because it is a public page that
 * has to be worth reading and worth sharing on its own. What is paid for is the
 * depth: the remaining issues with their fixes and copy rewrites, the ordered
 * action plan, and the PDF.
 */

// Price lives in ./price so the client-side paywall button can read the label
// without importing the Stripe SDK.
export {
  FULL_AUDIT_CURRENCY,
  FULL_AUDIT_PRICE_LABEL,
  FULL_AUDIT_PRICE_PENCE,
} from "./price";

let client: Stripe | undefined;

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Lazily constructed so a missing key is an error at the point of use rather
 * than at import time — otherwise every route that transitively imports this
 * would fail to load on a deployment with no Stripe configured.
 */
export function getStripe(): Stripe {
  if (client) return client;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Billing is not configured: set STRIPE_SECRET_KEY.");
  }

  client = new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" });
  return client;
}

/**
 * One-off Checkout session for a specific audit.
 *
 * `client_reference_id` and `metadata.auditId` both carry the id so the webhook
 * can find the audit again; two carriers because Stripe surfaces them in
 * different places and losing the link means a customer pays and gets nothing.
 */
export async function createAuditCheckoutSession(input: {
  auditId: string;
  displayName: string;
  host: string;
  origin: string;
}): Promise<string | null> {
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: input.auditId,
    metadata: { auditId: input.auditId },
    // Lets a promotion code field appear at checkout — how a 100%-off coupon
    // for your own or marketing use gets redeemed without a code path for it.
    allow_promotion_codes: true,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: FULL_AUDIT_CURRENCY,
          unit_amount: FULL_AUDIT_PRICE_PENCE,
          product_data: {
            name: "NexRoast — full website audit",
            description: `Every issue found on ${input.host}, with fixes, copy rewrites and a downloadable PDF report.`,
          },
        },
      },
    ],
    success_url: `${input.origin}/audit/${input.auditId}?checkout=success`,
    cancel_url: `${input.origin}/audit/${input.auditId}?checkout=cancelled`,
  });

  return session.url;
}
