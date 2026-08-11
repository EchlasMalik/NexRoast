import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — NexRoast",
  description: "The terms you agree to when you use NexRoast.",
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

export default function TermsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-5 py-16 sm:px-6">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-xs font-bold tracking-[0.3em] text-orange-400 uppercase">
            NexRoast
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-neutral-500">Last updated 3 August 2026</p>
        </div>

        <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">
          NexRoast is operated by Nexiora Studio. By submitting a URL or buying
          a full report, you agree to what&apos;s on this page. We&apos;ve
          written it in plain English rather than boilerplate — if anything is
          unclear, email us (address at the bottom) and ask.
        </p>

        <Section title="What NexRoast is">
          <p>
            You give us a URL. We load that page, take a screenshot of its
            publicly visible content, measure it, send what we found to an AI
            model, and show you back a score and a written audit. The score, the
            full category breakdown, what the site does well and the
            highest-priority issues are free; the remaining issues and the PDF
            report are the paid part.
          </p>
          <p>
            It is an automated review of a single page. It is not a substitute
            for a full professional audit, and it is not a legal opinion, an
            accessibility conformance report or a security assessment.
          </p>
        </Section>

        <Section title="The audit is an AI opinion, not a fact">
          <p>
            Audits are generated automatically by an AI model from a screenshot
            of your page plus measurements taken from it. That means it can be
            wrong: it can misread what it sees, miss context it was never shown,
            and make judgements you reasonably disagree with. The score is a
            rough indicator, not a measurement.
          </p>
          <p>
            The tone is deliberately direct. It is aimed at websites and the
            decisions behind them, never at people. Act on any of it at your own
            discretion; we aren&apos;t responsible for changes you make to your
            site off the back of an audit.
          </p>
        </Section>

        <Section title="Which sites you may submit">
          <p>By submitting a URL, you confirm that:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              The page is publicly accessible — no logged-in, private, or
              paywalled content.
            </li>
            <li>
              You own the site, or you have a legitimate reason to have it
              reviewed.
            </li>
            <li>
              You are not submitting it to harass, defame, or target anyone.
            </li>
          </ul>
          <p>
            Don&apos;t submit anything illegal, or pages whose main purpose is
            adult, hateful, or otherwise abusive content. We may refuse, remove,
            or stop generating any audit at our discretion, and we may
            rate-limit or block use that looks automated or abusive.
          </p>
        </Section>

        <Section title="Sharing and results">
          <p>
            Audit pages are public. Completed audits that meet a quality bar may
            be listed in our sitemap and indexed by search engines, and anyone
            with the link can open one. Treat the link as public, and only run
            an audit on a site you are happy to have reviewed publicly.
          </p>
          <p>
            Screenshots and share images we generate contain your page&apos;s
            publicly visible content. You may share, post, and repost your own
            audit freely, including commercially. We may also feature audits we
            generate in our own marketing — email us if you&apos;d rather we
            didn&apos;t use yours.
          </p>
        </Section>

        <Section title="Free and paid">
          <p>
            Every audit is free to run, and the free version is a real audit —
            the overall score, all nine category scores with the individual
            checks behind them, the written summary, what the site does well,
            and the highest-priority issues in full.
          </p>
          <p>
            The full audit is a one-off payment of £19 (GBP), including any VAT
            where applicable. It unlocks the remaining issues with their fixes
            and suggested wording, the ordered action plan, and the downloadable
            PDF report. Payment is taken by Stripe; we never see or store your
            card details. Access is granted to that specific audit link and does
            not expire.
          </p>
          <p>
            The price shown at checkout is the price you pay. If we change
            pricing, it only applies to purchases made afterwards.
          </p>
        </Section>

        <Section title="Cancellation and refunds">
          <p>
            The full audit is digital content delivered immediately. By
            purchasing, you ask us to supply it straight away and you
            acknowledge that you lose the 14-day right to cancel under the
            Consumer Contracts (Information, Cancellation and Additional
            Charges) Regulations 2013 once delivery has begun.
          </p>
          <p>
            That said: if the report fails to unlock, arrives broken, or plainly
            isn&apos;t what was described, email us and we&apos;ll refund you.
            We&apos;d rather fix it than argue about it. Nothing here affects
            your statutory rights.
          </p>
        </Section>

        <Section title="Intellectual property">
          <p>
            You keep all rights in your own website and its content. The audit
            text, score, and images we generate for your URL are yours to use as
            you like. The NexRoast name, branding, site design, and underlying
            software remain ours.
          </p>
        </Section>

        <Section title="Availability">
          <p>
            NexRoast depends on third-party services (an AI provider, hosting,
            storage, payments) and is provided &ldquo;as is&rdquo;. We
            don&apos;t guarantee uninterrupted availability, that every site can
            be captured successfully, or that audit pages will be kept
            indefinitely. We may change or withdraw features at any time.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            To the extent permitted by law, our total liability to you in
            connection with NexRoast is limited to the amount you have paid us
            for the audit in question, which for a free audit is nothing. We
            aren&apos;t liable for indirect or consequential losses, including
            lost profits, lost business, or lost data.
          </p>
          <p>
            Nothing in these terms limits liability for death or personal injury
            caused by negligence, for fraud, or for anything else that
            can&apos;t be limited by law. If you&apos;re using NexRoast as a
            consumer, your statutory rights are unaffected.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If these terms change meaningfully, we&apos;ll update this page and
            change the date at the top. The version in force is the one
            published when you used the service.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of England and Wales, and the
            courts of England and Wales have jurisdiction over any dispute.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or complaints:{" "}
            <a
              href="mailto:echlas@nexiorastudio.com"
              className="font-bold text-orange-400 underline underline-offset-2"
            >
              echlas@nexiorastudio.com
            </a>
          </p>
          <p>
            See also our{" "}
            <Link
              href="/privacy"
              className="font-bold text-orange-400 underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
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
