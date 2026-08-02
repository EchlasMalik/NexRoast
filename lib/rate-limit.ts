import type { NextRequest } from "next/server";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 5;
const MAX_TRACKED_KEYS = 10_000;

type Bucket = { count: number; resetAt: number };

/**
 * In-memory sliding-window rate limiter. Good enough for a single server
 * instance; resets on restart and doesn't coordinate across instances, so a
 * multi-instance deployment would need a shared store (e.g. Redis) instead.
 *
 * One shared bucket map serves every caller — namespace keys per use case
 * (e.g. `lead:${ip}`, `roast-hourly:${ip}`) so different limiters don't
 * stomp on each other's counts.
 */
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  options?: { windowMs?: number; maxRequests?: number },
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS_PER_WINDOW;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
