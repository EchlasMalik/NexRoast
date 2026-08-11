"use client";

import { useState } from "react";
import { trackClient } from "@/lib/analytics-client";

/**
 * The only interactive element inside the report. Everything else on a
 * completed audit is server-rendered so crawlers see the full text; this is a
 * small island because copying recommended wording is the single action the
 * page genuinely needs.
 */
export function CopyButton({
  value,
  label = "Copy",
  auditId,
}: {
  value: string;
  label?: string;
  auditId?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    trackClient("copy_fix_clicked", { auditId });

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard can reject on permission or a non-secure context. The
      // legacy path still works in those cases.
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        return;
      } finally {
        document.body.removeChild(textarea);
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98]"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
