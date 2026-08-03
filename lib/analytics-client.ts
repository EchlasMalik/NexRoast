import type { EventType } from "@/lib/analytics";

type ClientEventType = Extract<
  EventType,
  "page_view" | "share_click" | "book_call_click"
>;

/**
 * Fire-and-forget client-side event tracking. Prefers `sendBeacon` (survives
 * page unload, which matters for page_view/share_click firing right before
 * a navigation) and falls back to a keepalive fetch. Never throws — a
 * tracking failure should be invisible to the user.
 */
export function trackClient(
  type: ClientEventType,
  data?: { roastId?: string; path?: string },
): void {
  const payload = JSON.stringify({ type, ...data });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/analytics/event", blob)) return;
  }

  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Best-effort — nothing to do if even the fallback fails.
  });
}
