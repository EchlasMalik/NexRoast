import Stripe from "stripe";

/**
 * Billing, isolated.
 *
 * NexRoast no longer charges for an audit — the full public audit is free, and
 * the paywall that used to hide half of it is gone. This module exists so that
 * a future premium tier (monitoring, audit history, competitor comparison,
 * white-label reports) does not have to re-derive the Stripe wiring, key
 * handling and API version pinning from scratch.
 *
 * Nothing in the audit flow imports it. That is the point: billing is a
 * capability the product can pick up again, not a dependency of the core
 * experience.
 */

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
