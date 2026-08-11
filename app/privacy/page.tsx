import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — NexRoast",
  description: "How NexRoast collects, uses, and protects your data.",
  robots: { index: false, follow: true },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-bold tracking-tight text-white">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-neutral-300 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-5 py-16 sm:px-6">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-xs font-bold tracking-[0.3em] text-orange-400 uppercase">
            NexRoast
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-neutral-500">Last updated 3 August 2026</p>
        </div>

        <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">
          NexRoast is run by Nexiora Studio. This page explains what we collect
          when you use it, why, and who we share it with. We&apos;ve tried to
          write it in plain English rather than boilerplate — if anything here
          is unclear, email us (address at the bottom) and ask.
        </p>

        <Section title="What we collect">
          <p>When you submit a URL to be audited, we collect and store:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The URL you submitted.</li>
            <li>
              A screenshot of that page&apos;s publicly visible content at the
              time you submitted it.
            </li>
            <li>The AI-generated audit and score produced from that page.</li>
          </ul>
          <p>
            We don&apos;t require an account, so we don&apos;t collect a name or
            email just to generate an audit. If you choose to unlock the full
            report, payment is handled entirely by Stripe — we never see or
            store your card details, only a confirmation that a specific roast
            was paid for. If you choose to book a call with us, that happens on
            Calendly, a separate service with its own privacy policy — we only
            see the booking, not anything Calendly collects to make it happen.
          </p>
          <p>
            We also record basic, non-identifying usage events (e.g. an audit
            page was viewed, a share button was clicked) to understand how
            people use the tool, and your IP address is used briefly to enforce
            rate limits against abuse — it isn&apos;t stored long-term or linked
            to your audit.
          </p>
        </Section>

        <Section title="How we use it">
          <p>
            To generate and display your audit, process payment for the full
            report, let you share your result, and understand which parts of the
            tool are actually being used so we can improve it. We don&apos;t
            sell your data, and we don&apos;t use it for advertising.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            NexRoast itself doesn&apos;t set cookies — there&apos;s no login, so
            there&apos;s no session to track. If you go through Stripe Checkout,
            Stripe may set its own cookies on their domain during that process;
            that&apos;s governed by Stripe&apos;s own privacy policy, not ours.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Roasts are kept so that shared links keep working — a roast page you
            share on TikTok shouldn&apos;t break a month later. If you&apos;d
            like a specific roast (or all data tied to a URL you submitted)
            deleted, email us and we&apos;ll remove it.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask us what data we hold about a submission, ask us to
            correct or delete it, or ask us any question about how it&apos;s
            used. Email us and we&apos;ll sort it out directly — no formal
            process needed.
          </p>
        </Section>

        <Section title="Children">
          <p>
            NexRoast isn&apos;t directed at children, and we don&apos;t
            knowingly collect data from anyone under 13.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If how we handle data changes meaningfully, we&apos;ll update this
            page and change the date at the top.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, requests, or concerns:{" "}
            <a
              href="mailto:echlas@nexiorastudio.com"
              className="font-bold text-orange-400 underline underline-offset-2"
            >
              echlas@nexiorastudio.com
            </a>
          </p>
        </Section>

        <Link
          href="/"
          className="mt-4 self-center rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
        >
          Back to NexRoast
        </Link>
      </div>
    </main>
  );
}
