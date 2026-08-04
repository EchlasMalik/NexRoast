"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RoastReportCard } from "@/components/roast-report-card";
import { trackClient } from "@/lib/analytics-client";
import type { PublicCritique } from "@/lib/critique";
import { stripEmphasis } from "@/lib/rich-text";
import { scoreBucket, STATUS_STYLES } from "@/lib/score-style";

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL;

const LOADING_MESSAGES = [
  "Judging your font choices…",
  "Counting how many stock photos you used…",
  "Squinting at your colour palette…",
  "Timing how long your hero image takes to load…",
  "Reading your headline out loud, unimpressed…",
  "Checking whether that button actually does anything…",
  "Comparing your site to a Squarespace template from 2014…",
  "Deciding how gentle to be (spoiler: not very)…",
];

const POLL_INTERVAL_MS = 2000;
const MESSAGE_INTERVAL_MS = 2200;
// After returning from Stripe Checkout, the webhook that actually unlocks
// the roast can lag the redirect by a couple of seconds. Cap how long we
// keep polling for it so a missed/delayed webhook doesn't poll forever.
const MAX_UNLOCK_POLL_ATTEMPTS = 20;

type RoastData = {
  id: string;
  url: string;
  screenshotUrl: string | null;
  status: "pending" | "processing" | "complete" | "failed";
  score: number | null;
  critique: PublicCritique | null;
  unlockedAt: string | null;
};

export function RoastStatus({ roastId }: { roastId: string }) {
  const [roast, setRoast] = useState<RoastData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [unlockPollTimedOut, setUnlockPollTimedOut] = useState(false);
  const searchParams = useSearchParams();
  const awaitingCheckout = searchParams.get("checkout") === "success";

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let unlockPollAttempts = 0;

    async function poll() {
      try {
        const response = await fetch(`/api/roast/${roastId}`, {
          cache: "no-store",
        });
        if (cancelled) return;

        if (!response.ok) {
          setFetchError(
            response.status === 404
              ? "We couldn't find that roast."
              : "Something went wrong loading this roast.",
          );
          return;
        }

        const data: { roast: RoastData } = await response.json();
        if (cancelled) return;
        setFetchError(null);
        setRoast(data.roast);

        const stillProcessing =
          data.roast.status === "pending" || data.roast.status === "processing";
        const awaitingUnlock =
          awaitingCheckout && !data.roast.unlockedAt && !stillProcessing;

        if (stillProcessing) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        } else if (awaitingUnlock) {
          unlockPollAttempts += 1;
          if (unlockPollAttempts >= MAX_UNLOCK_POLL_ATTEMPTS) {
            setUnlockPollTimedOut(true);
          } else {
            timer = setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      } catch {
        if (!cancelled) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [roastId, awaitingCheckout]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((index) => (index + 1) % LOADING_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Fires once per page load, not once per poll — deliberately outside the
  // polling effect above, which re-runs on every status change.
  useEffect(() => {
    trackClient("page_view", { path: `/roast/${roastId}`, roastId });
  }, [roastId]);

  if (fetchError && !roast) {
    return <StatusScreen title="Uh oh." body={fetchError} showHomeLink />;
  }

  if (!roast || roast.status === "pending" || roast.status === "processing") {
    return (
      <LoadingScreen
        url={roast?.url}
        message={LOADING_MESSAGES[messageIndex]}
      />
    );
  }

  if (roast.status === "failed" || !roast.critique || roast.score === null) {
    return (
      <StatusScreen
        title="This roast fizzled out."
        body="We couldn't finish roasting this one — the site might be unreachable, or something broke on our end."
        showHomeLink
      />
    );
  }

  const awaitingUnlock =
    awaitingCheckout && !roast.unlockedAt && !unlockPollTimedOut;

  return (
    <RoastResult
      roast={roast}
      critique={roast.critique}
      awaitingUnlock={awaitingUnlock}
      unlockPollTimedOut={
        awaitingCheckout && !roast.unlockedAt && unlockPollTimedOut
      }
    />
  );
}

function LoadingScreen({ url, message }: { url?: string; message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-16 text-center sm:px-6">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
        <span className="text-3xl">🔥</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Roasting{url ? ` ${new URL(url).hostname}` : " your site"}…
        </h1>
        <p
          key={message}
          className="max-w-xs [animation:roast-fade-in_0.4s_ease] text-base text-neutral-400 sm:max-w-sm"
        >
          {message}
        </p>
      </div>
    </main>
  );
}

function StatusScreen({
  title,
  body,
  showHomeLink,
}: {
  title: string;
  body: string;
  showHomeLink?: boolean;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center sm:px-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      <p className="max-w-sm text-base text-neutral-400">{body}</p>
      {showHomeLink && (
        <Link
          href="/"
          className="mt-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20"
        >
          Try another URL
        </Link>
      )}
    </main>
  );
}

function RoastResult({
  roast,
  critique,
  awaitingUnlock,
  unlockPollTimedOut,
}: {
  roast: RoastData;
  critique: PublicCritique;
  awaitingUnlock: boolean;
  unlockPollTimedOut: boolean;
}) {
  const style = STATUS_STYLES[scoreBucket(critique.score)];
  const isUnlocked = Boolean(roast.unlockedAt);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-5 py-10 sm:px-6 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center gap-3 text-center">
        <p className="max-w-full truncate text-sm text-neutral-500">
          {roast.url}
        </p>

        <div
          className={`flex flex-col items-center justify-center rounded-full border-4 ${style.ring} bg-white/5 px-8 py-6`}
        >
          <span className="font-display text-5xl font-bold text-white sm:text-6xl">
            {critique.score}
            <span className="text-xl font-bold text-neutral-500">/100</span>
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold ${style.chipBg}`}
        >
          🔥 {style.label}
        </span>
      </div>

      <RoastReportCard
        url={roast.url}
        screenshotUrl={roast.screenshotUrl}
        critique={critique}
      />

      {awaitingUnlock && (
        <div className="w-full max-w-2xl rounded-2xl border border-orange-400/30 bg-orange-500/10 p-4 text-center">
          <p className="text-sm font-semibold text-orange-200">
            Confirming your payment… this usually takes a few seconds.
          </p>
        </div>
      )}
      {unlockPollTimedOut && (
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-sm text-neutral-300">
            Payment received? It can occasionally take a little longer to
            confirm —{" "}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-bold text-orange-400 underline underline-offset-2"
            >
              refresh this page
            </button>{" "}
            to check again.
          </p>
        </div>
      )}

      {isUnlocked ? (
        <BookCallCTA roastId={roast.id} variant="standalone" />
      ) : (
        <PaywallCTA
          roastId={roast.id}
          lockedCount={critique.lockedParagraphCount}
        />
      )}

      <div className="flex w-full max-w-2xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <ShareButton roast={roast} critique={critique} />
        <TikTokImageButton roastId={roast.id} />
        {isUnlocked && <DownloadReportButton roastId={roast.id} />}
        <Link
          href="/"
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-center text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] sm:w-auto"
        >
          Roast another site 🔥
        </Link>
      </div>
    </main>
  );
}

function PaywallCTA({
  roastId,
  lockedCount,
}: {
  roastId: string;
  lockedCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/roast/${roastId}/checkout`, {
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
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="rounded-full border border-orange-400/40 bg-orange-500/10 px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-orange-300 uppercase">
          Unlocked: the polite half
        </span>
        <p className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
          Fancy the rest of the bad news?
        </p>
        <p className="max-w-md text-sm text-neutral-400">
          {lockedCount > 0
            ? `We found ${lockedCount} more problem${lockedCount === 1 ? "" : "s"} and kept ${lockedCount === 1 ? "it" : "them"} behind the blur. `
            : ""}
          Unlock the full write-up — every issue we spotted, the one fix worth
          doing first, and a PDF you can forward to whoever built this.
        </p>
        <button
          type="button"
          onClick={handleUnlock}
          disabled={loading}
          className="mt-1 w-full max-w-xs rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Redirecting to checkout…" : "Unlock the full report — £9"}
        </button>
        <p className="text-xs text-neutral-500">
          One-off payment. Instant delivery. No mercy.
        </p>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-400">
            {error}
          </p>
        )}
      </div>

      {CALENDLY_URL && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs font-bold tracking-wide text-neutral-500 uppercase">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <BookCallCTA roastId={roastId} variant="embedded" />
        </>
      )}
    </div>
  );
}

function DownloadReportButton({ roastId }: { roastId: string }) {
  return (
    <a
      href={`/api/roast/${roastId}/report.pdf`}
      className="w-full rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-bold text-white transition active:scale-[0.98] sm:w-auto"
    >
      Download PDF report 📄
    </a>
  );
}

/**
 * Downloads the vertical share card, not a link — TikTok has no "share this
 * webpage as a post" flow the way Twitter does, so the actual bottleneck for
 * someone making content with this is having a ready-made vertical visual to
 * drop into a video, not a link to send somewhere. Available regardless of
 * unlock status: it only shows what's already visible on a free roast page.
 */
function TikTokImageButton({ roastId }: { roastId: string }) {
  return (
    <a
      href={`/api/roast/${roastId}/tiktok-image`}
      onClick={() => trackClient("tiktok_image_download", { roastId })}
      className="w-full rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-bold text-white transition active:scale-[0.98] sm:w-auto"
    >
      Save image for TikTok 🎵
    </a>
  );
}

function ShareButton({
  roast,
  critique,
}: {
  roast: RoastData;
  critique: PublicCritique;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [shareUrl, setShareUrl] = useState("");

  function copyWithFallback(url: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch {
      succeeded = false;
    }
    document.body.removeChild(textarea);
    return succeeded;
  }

  async function handleShare() {
    trackClient("share_click", { roastId: roast.id });
    const url = window.location.href;
    setShareUrl(url);
    // The sign-off is the line built to be quoted; the opening paragraph is
    // the fallback for legacy roasts, which have no sign-off.
    const pullQuote = stripEmphasis(critique.zinger ?? critique.opening);
    const shareData = {
      title: "NexRoast",
      text: `${roast.url} scored ${critique.score}/100 on NexRoast 🔥 ${pullQuote}\n\n#webdesign #smallbusiness #website #roasted`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled the share sheet — nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      // Clipboard API can reject even when it exists — e.g. permission
      // denied, non-secure context, or restrictive in-app browsers (TikTok's
      // included). Fall back to the legacy execCommand copy trick, and if
      // that fails too, leave the link on screen — no auto-reset — so
      // there's time to actually select and copy it by hand.
      if (copyWithFallback(url)) {
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("failed");
      }
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2 sm:w-auto">
      <button
        type="button"
        onClick={handleShare}
        className="w-full rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition active:scale-[0.98] sm:w-auto"
      >
        {status === "copied"
          ? "Link copied! 📋"
          : status === "failed"
            ? "Couldn't copy — select the link below"
            : "Share this roast 🔗"}
      </button>
      {status === "failed" && (
        <input
          type="text"
          readOnly
          value={shareUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Roast link"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-neutral-300 select-all"
        />
      )}
    </div>
  );
}

/**
 * Direct external link to Calendly rather than an in-app lead-capture form —
 * anyone clicking this already knows they want a human, so send them
 * straight to booking a slot instead of adding a form-then-email-follow-up
 * step in between. Renders nothing if NEXT_PUBLIC_CALENDLY_URL isn't set.
 * Two contexts: `embedded` (inside the paywall card, as the second of two
 * options) and `standalone` (its own card, shown once a roast is unlocked).
 */
function BookCallCTA({
  roastId,
  variant,
}: {
  roastId: string;
  variant: "embedded" | "standalone";
}) {
  if (!CALENDLY_URL) return null;

  const content = (
    <div className="flex flex-col items-center gap-2">
      <p className="text-base font-bold text-white">
        Want it professionally done?
      </p>
      <p className="max-w-sm text-sm text-neutral-400">
        Skip the DIY — Nexiora Studio can fix every issue above. Book a free
        call and we&apos;ll make you a FREE mockup of what your website could look like.
      </p>
      <a
        href={CALENDLY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackClient("book_call_click", { roastId })}
        className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-center text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
      >
        Book a call →
      </a>
    </div>
  );

  if (variant === "embedded") return content;

  return (
    <div className="w-full max-w-2xl rounded-2xl border-2 border-orange-400/40 bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 text-center">
      {content}
    </div>
  );
}
