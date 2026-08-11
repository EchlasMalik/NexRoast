import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Rate limiting backed by Postgres.
 *
 * The previous implementation was an in-process Map. On serverless that gives
 * every function instance its own counters, so the published limit was
 * whatever it said multiplied by however many instances happened to be warm —
 * which is to say, no limit at all. Since this is the only thing standing
 * between an abusive visitor and the Gemini and Playwright bill, it has to be
 * shared state, and the database is already provisioned.
 *
 * The whole check is one atomic statement. A read-then-write would let two
 * concurrent requests both observe the same count and both pass.
 */

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 5;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

export async function checkRateLimit(
  key: string,
  options?: { windowMs?: number; maxRequests?: number },
): Promise<RateLimitResult> {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  try {
    // Upsert-and-return in one round trip:
    // - no row, or an expired one  -> start a fresh window at count 1
    // - live row                   -> increment
    // ON CONFLICT makes the whole thing atomic under concurrency.
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"
    `;

    const row = rows[0];
    if (!row)
      return { allowed: true, retryAfterSeconds: 0, remaining: maxRequests };

    const allowed = row.count <= maxRequests;
    return {
      allowed,
      remaining: Math.max(0, maxRequests - row.count),
      retryAfterSeconds: allowed
        ? 0
        : Math.max(
            1,
            Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000),
          ),
    };
  } catch (error) {
    // Fail open. A database hiccup should not take the whole product down —
    // the limiter is abuse protection, not an authorisation check.
    console.error("Rate limit check failed; allowing request", error);
    return { allowed: true, retryAfterSeconds: 0, remaining: 0 };
  }
}

/**
 * Removes expired buckets. Called opportunistically rather than on a schedule:
 * the table is tiny and this keeps it from growing unbounded without needing a
 * cron job.
 */
export async function sweepRateLimits(): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({
      where: { resetAt: { lte: new Date() } },
    });
  } catch {
    // Housekeeping only.
  }
}

export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  // Deliberately null rather than the string "unknown": bucketing every
  // header-less visitor together made one shared limit for all of them, which
  // is both useless as protection and a way to lock out legitimate traffic.
  return null;
}

/**
 * Builds a namespaced bucket key, or null when the caller can't be identified.
 * Callers decide what an unidentifiable client means for them.
 */
export function rateLimitKey(
  namespace: string,
  request: NextRequest,
): string | null {
  const ip = getClientIp(request);
  return ip ? `${namespace}:${ip}` : null;
}
