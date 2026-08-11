"use client";

import Link from "next/link";
import { useState } from "react";
import { trackClient } from "@/lib/analytics-client";

const ACTION_CLASS =
  "w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10 active:scale-[0.98] sm:w-auto";

export function ShareActions({
  auditId,
  displayName,
  score,
}: {
  auditId: string;
  displayName: string;
  score: number;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [shareUrl, setShareUrl] = useState("");

  async function handleShare() {
    trackClient("share_click", { auditId });
    const url = window.location.href;
    setShareUrl(url);

    const shareData = {
      title: `${displayName} — website audit`,
      text: `${displayName} scored ${score}/100 on NexRoast. Here's what's holding the site back.`,
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
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = (() => {
        try {
          return document.execCommand("copy");
        } catch {
          return false;
        }
      })();
      document.body.removeChild(textarea);
      setStatus(ok ? "copied" : "failed");
      if (ok) setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-3">
      <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={handleShare} className={ACTION_CLASS}>
          {status === "copied"
            ? "Link copied"
            : status === "failed"
              ? "Copy the link below"
              : "Share this audit"}
        </button>

        <a
          href={`/api/audit/${auditId}/report.pdf`}
          onClick={() => trackClient("pdf_download", { auditId })}
          className={ACTION_CLASS}
        >
          Download PDF
        </a>

        <a
          href={`/api/audit/${auditId}/share-image`}
          onClick={() => trackClient("tiktok_image_download", { auditId })}
          className={ACTION_CLASS}
        >
          Save share image
        </a>

        <Link
          href="/#audit"
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-center text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] sm:w-auto"
        >
          Audit another site
        </Link>
      </div>

      {status === "failed" && (
        <input
          type="text"
          readOnly
          value={shareUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Audit link"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-neutral-300 select-all"
        />
      )}
    </div>
  );
}
