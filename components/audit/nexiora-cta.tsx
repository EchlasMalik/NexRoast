"use client";

import { trackClient } from "@/lib/analytics-client";

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL;
const AGENCY_URL = "https://nexiorastudio.com";

const PRIMARY_CLASS =
  "inline-block rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-110 active:scale-[0.98]";

/**
 * The conversion path, placed after the audit rather than inside it.
 *
 * The audit has to be worth reading on its own — a business that got real
 * value from it is the one worth talking to. So this asks once, at the end,
 * and never interrupts the findings.
 *
 * Two destinations, deliberately unequal: booking a call is the action worth
 * taking, so it keeps the filled gradient button and the visual weight. The
 * link through to the site is a quieter secondary — there for someone who
 * wants to check who they would be talking to first, without competing with
 * the ask.
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

      <div className="mt-5 flex flex-col items-center gap-3">
        {CALENDLY_URL ? (
          <>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClient("book_call_click", { auditId })}
              className={PRIMARY_CLASS}
            >
              Get a free website consultation
            </a>

            {/* Secondary on purpose: a ghost button, smaller and unfilled, so
                it reads as "or find out more" rather than as an equal choice.
                Two matching buttons would split the decision. */}
            <a
              href={AGENCY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClient("agency_site_click", { auditId })}
              className="inline-block rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-neutral-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white active:scale-[0.98]"
            >
              Visit Nexiora Studio →
            </a>
          </>
        ) : (
          // No booking link configured, so the site becomes the only ask —
          // showing a quiet secondary to the same place it already points
          // would just be the same button twice.
          <a
            href={AGENCY_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClient("agency_site_click", { auditId })}
            className={PRIMARY_CLASS}
          >
            Visit Nexiora Studio
          </a>
        )}
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        No obligation. We&apos;ll walk you through the findings either way.
      </p>
    </section>
  );
}
