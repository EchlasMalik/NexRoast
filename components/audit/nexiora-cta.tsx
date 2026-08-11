"use client";

import { trackClient } from "@/lib/analytics-client";

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL;

/**
 * The conversion path, placed after the audit rather than inside it.
 *
 * The audit has to be worth reading on its own — a business that got real
 * value from it is the one worth talking to. So this asks once, at the end,
 * and never interrupts the findings.
 */
export function NexioraCta({
  auditId,
  displayName,
}: {
  auditId: string;
  displayName?: string;
}) {
  return (
    <section className="w-full max-w-3xl rounded-3xl border border-orange-400/25 bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 text-center sm:p-8">
      <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
        Want these fixed for you?
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-neutral-300">
        Nexiora Studio builds high-converting websites and custom software for
        service businesses. We can take the recommendations in this audit
        {displayName ? ` for ${displayName}` : ""} and implement them properly.
      </p>

      {CALENDLY_URL ? (
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackClient("book_call_click", { auditId })}
          className="mt-5 inline-block rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
        >
          Get a free website consultation
        </a>
      ) : (
        <a
          href="https://nexiorastudio.com"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackClient("book_call_click", { auditId })}
          className="mt-5 inline-block rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
        >
          Get a free website consultation
        </a>
      )}

      <p className="mt-3 text-xs text-neutral-500">
        No obligation. We&apos;ll walk you through the findings either way.
      </p>
    </section>
  );
}
