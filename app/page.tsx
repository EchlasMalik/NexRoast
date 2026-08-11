"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { trackClient } from "@/lib/analytics-client";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/audit/categories";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Enter your website",
    body: "Paste the address. No account, no card, no fourteen-field enquiry form.",
  },
  {
    step: "02",
    title: "NexRoast analyses it",
    body: "We load your homepage the way a first-time visitor does, measure what it does, and read what it says.",
  },
  {
    step: "03",
    title: "Get your score and recommendations",
    body: "A score out of 100 across nine areas, with every point traceable to a named check you can see.",
  },
  {
    step: "04",
    title: "Fix the biggest opportunities",
    body: "Each issue comes with what to change and, where it's wording, the replacement text ready to copy.",
  },
];

const FAQ = [
  {
    question: "Is it actually free?",
    answer:
      "Yes — the whole audit. Score, category breakdown, every issue we found, the recommendations and a PDF. There's no locked section and nothing to upgrade to.",
  },
  {
    question: "How is the score calculated?",
    answer:
      "From 42 individual checks across nine areas. Most are measured directly from your page — load time, heading structure, structured data, mobile layout — and the rest are judged against a fixed rubric. Every check is listed on your audit, so you can see exactly where each point came from.",
  },
  {
    question: "Is it harsh?",
    answer:
      "It's honest about the website and says nothing about you or your business. It's written so you'd be comfortable forwarding it to whoever built the site — and comfortable if a customer read it.",
  },
  {
    question: "Will it slow down or damage my site?",
    answer:
      "No. We load your homepage once, the same way any visitor would, and take a screenshot. Nothing is changed, submitted or logged into.",
  },
  {
    question: "What if I disagree with something?",
    answer:
      "Fair enough — it's an automated review of one page, not a full audit of your business. Every issue names the evidence behind it, so you can judge for yourself. Take what lands and ignore the rest.",
  },
];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackClient("page_view", { path: "/" });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data: { audit?: { id: string }; error?: string } =
        await response.json();

      if (!response.ok || !data.audit) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push(`/audit/${data.audit.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <section
        id="audit"
        className="flex scroll-mt-24 flex-col items-center gap-9 px-5 pt-14 pb-20 text-center sm:px-6 sm:pt-20 sm:pb-28"
      >
        <div className="flex flex-col items-center gap-5">
          <Image
            src="/NexRoast-Logo.png"
            alt="NexRoast"
            width={128}
            height={128}
            priority
            className="roast-logo-bob h-20 w-20 rounded-full drop-shadow-[0_12px_30px_rgba(249,115,22,0.4)] sm:h-24 sm:w-24"
          />
          <span className="rounded-full border border-orange-400/25 bg-orange-500/10 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.2em] text-orange-300 uppercase">
            Free · No signup
          </span>
          <h1 className="font-display max-w-[20rem] text-[2.5rem] leading-[1.04] font-bold tracking-[-0.03em] text-balance text-white sm:max-w-3xl sm:text-6xl">
            Find out what&apos;s holding your{" "}
            <span className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-500 bg-clip-text text-transparent">
              website
            </span>{" "}
            back.
          </h1>
          <p className="max-w-md text-[1.0625rem] leading-relaxed text-balance text-neutral-400 sm:max-w-xl sm:text-xl">
            Get a brutally honest AI audit of your website — from conversion and
            messaging to SEO, trust, performance and mobile UX.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-md flex-col gap-3"
          noValidate
        >
          <input
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Enter your website URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={submitting}
            required
            aria-label="Website URL"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center text-base text-white placeholder-neutral-500 outline-none focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50 sm:text-lg"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
          >
            {submitting ? "Starting your audit…" : "Audit My Website"}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-400">
              {error}
            </p>
          )}
        </form>

        <p className="text-sm text-neutral-500">
          Takes about a minute. No signup required.
        </p>
      </section>

      <Section
        id="how-it-works"
        eyebrow="How it works"
        heading="From URL to a plan in about a minute."
        blurb="No onboarding, no discovery call, no invoice."
      >
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <li
              key={item.step}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left transition hover:border-orange-400/30 hover:bg-white/[0.07]"
            >
              <span className="font-display text-2xl font-bold text-orange-400">
                {item.step}
              </span>
              <h3 className="font-display text-lg font-bold tracking-tight text-white">
                {item.title}
              </h3>
              <p className="text-[0.9375rem] leading-relaxed text-neutral-400">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="what-we-check"
        eyebrow="What we check"
        heading="Nine areas, 42 individual checks."
        blurb="Most are measured directly from your page rather than guessed at, and every one is shown on your audit."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_KEYS.map((key) => (
            <li
              key={key}
              className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left"
            >
              <h3 className="font-display text-base font-bold tracking-tight text-white">
                {CATEGORIES[key].label}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-400">
                {CATEGORIES[key].blurb}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="faq"
        eyebrow="FAQ"
        heading="The questions everyone asks first."
      >
        <ul className="mx-auto grid w-full max-w-3xl gap-3">
          {FAQ.map((item) => (
            <li key={item.question}>
              <details className="group rounded-2xl border border-white/10 bg-white/[0.04] text-left transition open:border-orange-400/30 hover:border-orange-400/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 group-open:pb-3 [&::-webkit-details-marker]:hidden">
                  <h3 className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
                    {item.question}
                  </h3>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="h-5 w-5 shrink-0 text-orange-400 transition-transform duration-200 group-open:rotate-180"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <p className="px-6 pb-6 text-[0.9375rem] leading-relaxed text-neutral-400">
                  {item.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>

        <a
          href="#audit"
          className="mx-auto mt-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
        >
          Audit my website
        </a>
      </Section>
    </main>
  );
}

function Section({
  id,
  eyebrow,
  heading,
  blurb,
  children,
}: {
  id: string;
  eyebrow: string;
  heading: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-white/5 px-5 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-[11px] font-bold tracking-[0.28em] text-orange-400 uppercase">
            {eyebrow}
          </span>
          <h2 className="font-display max-w-xl text-3xl leading-[1.1] font-bold tracking-[-0.02em] text-balance text-white sm:text-[2.75rem]">
            {heading}
          </h2>
          {blurb && (
            <p className="max-w-lg text-base leading-relaxed text-balance text-neutral-400">
              {blurb}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
