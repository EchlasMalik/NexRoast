/**
 * Price constants, deliberately separate from `lib/billing/index.ts`.
 *
 * The paywall button is a client component and needs the label, but
 * `index.ts` imports the Stripe SDK — importing it from the client would drag
 * the whole server SDK into the browser bundle. Keeping the numbers here means
 * both sides read one source of truth without that happening.
 */

/**
 * £19. The old roast charged £9 for half a comedy write-up; this is a
 * multi-page audit with named checks, evidence and paste-ready copy, priced
 * against what it substitutes for (a slice of a consultant's time) rather than
 * against the thing it grew out of. Still an impulse purchase, and one number
 * to change if that proves wrong.
 */
export const FULL_AUDIT_PRICE_PENCE = 1900;
export const FULL_AUDIT_CURRENCY = "gbp";
export const FULL_AUDIT_PRICE_LABEL = "£19";
