"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 2500;
// Capture plus the model chain plus Inngest retries. Past this, something has
// gone wrong that polling will not fix.
const MAX_ATTEMPTS = 90;

const STAGES = [
  "Loading the page the way a visitor would…",
  "Measuring how long that actually took…",
  "Reading the headline, the navigation and the calls to action…",
  "Checking what search engines and AI assistants can see…",
  "Looking for the trust signals customers look for…",
  "Working out what to fix first…",
];

/**
 * Shown only while an audit is still being generated.
 *
 * Polls a status-only endpoint and calls `router.refresh()` when the audit
 * completes, so the finished report is rendered by the server component. This
 * component never renders the report itself — keeping a second client-side
 * copy of the renderer is what made the old implementation invisible to
 * crawlers and 400 lines heavier.
 */
export function AuditPending({
  id,
  host,
  businessName,
}: {
  id: string;
  host: string;
  businessName: string | null;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        setTimedOut(true);
        return;
      }

      try {
        const response = await fetch(`/api/audit/${id}/status`, {
          cache: "no-store",
        });
        if (cancelled) return;

        if (response.ok) {
          const data: { status: string } = await response.json();
          if (data.status === "complete" || data.status === "failed") {
            // Hand back to the server component, which owns rendering.
            router.refresh();
            return;
          }
        }
      } catch {
        // Keep polling through transient network errors.
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, router]);

  useEffect(() => {
    const interval = setInterval(
      () => setStage((value) => (value + 1) % STAGES.length),
      2600,
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-20 text-center sm:px-6">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Auditing {businessName ?? host}
        </h1>
        {timedOut ? (
          <p className="max-w-sm text-base text-neutral-400">
            This is taking longer than it should. The audit may still finish —{" "}
            <button
              type="button"
              onClick={() => router.refresh()}
              className="font-semibold text-orange-400 underline underline-offset-2"
            >
              check again
            </button>
            .
          </p>
        ) : (
          <p
            key={stage}
            className="max-w-sm [animation:roast-fade-in_0.4s_ease] text-base text-neutral-400"
          >
            {STAGES[stage]}
          </p>
        )}
      </div>
    </main>
  );
}
