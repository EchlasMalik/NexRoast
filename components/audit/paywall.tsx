"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FULL_AUDIT_PRICE_LABEL } from "@/lib/billing/price";

// Fixed line widths so the placeholder reads as real withheld issues rather
// than an obviously generated block, and doesn't reflow on every render.
const PLACEHOLDER_LINES = [
  ["58%", "100%", "88%"],
  ["46%", "97%", "72%"],
];

/**
 * Stands in for the issues a free audit doesn't get.
 *
 * These are genuinely just grey bars — the locked issues are removed
 * server-side in `toPublicAudit`, so nothing here is recoverable from
 * view-source or the network tab. The blur is decoration over an absence, not
 * a cover over hidden text.
 */
export function LockedIssues({
  auditId,
  count,
}: {
  auditId: string;
  count: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const justPaid = searchParams.get("checkout") === "success";
  const [confirming, setConfirming] = useState(justPaid);

  // Returning from Stripe, the webhook that actually unlocks the audit can lag
  // the redirect by a second or two. Poll briefly, then refresh so the server
  // component re-renders with the full report.
  useEffect(() => {
    if (!justPaid) return;

    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > 15) {
        clearInterval(timer);
        setConfirming(false);
        return;
      }
      try {
        const res = await fetch(`/api/audit/${auditId}/status`, {
          cache: "no-store",
        });
        const data: { unlocked?: boolean } = await res.json();
        if (data.unlocked) {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // Keep trying — a transient failure here is not worth surfacing.
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [justPaid, auditId, router]);

  async function handleUnlock() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/audit/${auditId}/checkout`, {
        method: "POST",
      });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error ?? "Couldn't start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    // The class name is referenced by the page's `hasPart` structured data as
    // the paid region — keep the two in step.
    <li className="paid-audit-content relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none flex flex-col gap-5 blur-[3px] select-none"
      >
        {PLACEHOLDER_LINES.map((block, blockIndex) => (
          <div key={blockIndex} className="flex flex-col gap-2.5">
            {block.map((width, lineIndex) => (
              <div
                key={lineIndex}
                style={{ width }}
                className={
                  lineIndex === 0
                    ? "h-4 rounded bg-neutral-300"
                    : "h-3 rounded bg-neutral-200"
                }
              />
            ))}
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 p-5 text-center backdrop-blur-[1px]">
        {confirming ? (
          <p className="text-sm font-semibold text-neutral-700">
            Confirming your payment… this usually takes a few seconds.
          </p>
        ) : (
          <>
            <p className="font-display text-lg font-bold text-neutral-900">
              {count} more {count === 1 ? "issue" : "issues"} found
            </p>
            <p className="max-w-sm text-sm text-neutral-600">
              Unlock the full audit to see every issue with its fix, the
              paste-ready copy rewrites, your ordered action plan, and a PDF you
              can send to whoever builds the site.
            </p>
            <button
              type="button"
              onClick={handleUnlock}
              disabled={loading}
              className="mt-1 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Redirecting to checkout…"
                : `Unlock the full audit — ${FULL_AUDIT_PRICE_LABEL}`}
            </button>
            <p className="text-xs text-neutral-500">
              One-off payment. Instant access.
            </p>
            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
