"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { trackClient } from "@/lib/analytics-client";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Hand over the URL",
    body: "Paste your link. No account, no card, no fourteen-field enquiry form. Just the address and a bit of courage.",
  },
  {
    step: "02",
    title: "We photograph the evidence",
    body: "We screenshot your homepage exactly as a first-time visitor sees it, then time how long they had to wait for the privilege.",
  },
  {
    step: "03",
    title: "The verdict lands",
    body: "A score out of 100, a survival rating, and a written review with jokes at your expense and a point behind every one of them.",
  },
];

const WHY_IT_WORKS = [
  {
    icon: "😬",
    title: "It's honest, not polite",
    body: "Your mates said the site looks really nice. Your bounce rate disagrees. We say the bit everyone else is too well-mannered to mention.",
  },
  {
    icon: "🔍",
    title: "It's specific, not generic",
    body: "No vague advice about improving your UX. Real problems on your actual page — the headline, the load time, the button nobody is clicking.",
  },
  {
    icon: "💸",
    title: "It's about money, not taste",
    body: "Every problem comes with what it is quietly costing you: the enquiry that went to a competitor, the budget spent sending traffic to a page that was never going to convert it.",
  },
];

const FAQ = [
  {
    question: "Is it actually free?",
    answer:
      "The roast is free and always will be. If you want the full write-up — every problem we found, the one fix worth doing first, and a PDF — that's a one-off £9.",
  },
  {
    question: "How brutal is brutal?",
    answer:
      "Brutal about the website, never about you. It's sarcastic, it takes the mickey, and it will find the thing you were hoping nobody would notice. It won't be nasty about the people who built it.",
  },
  {
    question: "Will it hurt my site?",
    answer:
      "No. We load your homepage once, the same way any visitor would, and take a picture. Nothing is changed, nothing is submitted, nothing is logged into.",
  },
  {
    question: "What if I disagree with it?",
    answer:
      "Fair enough — it's an AI reading one screenshot, not a lab report. Take the bits that land and ignore the rest. If it's badly wrong, tell us and we'll happily look.",
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
      const response = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data: { roast?: { id: string }; error?: string } =
        await response.json();

      if (!response.ok || !data.roast) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push(`/roast/${data.roast.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <section
        id="roast"
        className="flex scroll-mt-24 flex-col items-center gap-9 px-5 pt-14 pb-20 text-center sm:px-6 sm:pt-20 sm:pb-28"
      >
        <div className="flex flex-col items-center gap-5">
          <Image
            src="/NexRoast-Logo.png"
            alt="NexRoast"
            width={128}
            height={128}
            priority
            className="roast-logo-bob h-24 w-24 rounded-full drop-shadow-[0_12px_30px_rgba(249,115,22,0.4)] sm:h-32 sm:w-32"
          />
          <span className="rounded-full border border-orange-400/25 bg-orange-500/10 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.2em] text-orange-300 uppercase">
            Free · No signup
          </span>
          <h1 className="font-display max-w-[19rem] text-[2.6rem] leading-[1.02] font-bold tracking-[-0.03em] text-balance text-white sm:max-w-2xl sm:text-7xl">
            Your website is about to get{" "}
            <span className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-500 bg-clip-text text-transparent">
              ROASTED
            </span>
            .
          </h1>
          <p className="max-w-sm text-[1.0625rem] leading-relaxed text-balance text-neutral-400 sm:max-w-lg sm:text-xl">
            Drop your URL. Our AI screenshots it, judges it, and tells you
            exactly why it&apos;s not converting — with jokes.
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
            placeholder="yourwebsite.com"
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
            {submitting ? "Firing up the roast…" : "Roast my site 🔥"}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-400">
              {error}
            </p>
          )}
        </form>

        <p className="text-sm text-neutral-500">
          Takes about a minute. Brutal honesty guaranteed.
        </p>
      </section>

      <Section
        id="how-it-works"
        eyebrow="How it works"
        heading="Three steps to a difficult afternoon."
        blurb="No onboarding, no discovery call, no invoice. Just a URL and the truth."
      >
        <ol className="grid gap-4 sm:grid-cols-3">
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
        id="why-it-works"
        eyebrow="Why it works"
        heading="Because nobody else is going to tell you."
        blurb="Friends are kind, agencies are billing you, and analytics only shows you the leaving — never the reason."
      >
        <ul className="grid gap-4 sm:grid-cols-3">
          {WHY_IT_WORKS.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left transition hover:border-orange-400/30 hover:bg-white/[0.07]"
            >
              <span className="text-2xl">{item.icon}</span>
              <h3 className="font-display text-lg font-bold tracking-tight text-white">
                {item.title}
              </h3>
              <p className="text-[0.9375rem] leading-relaxed text-neutral-400">
                {item.body}
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
            <li
              key={item.question}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left"
            >
              <h3 className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
                {item.question}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-neutral-400">
                {item.answer}
              </p>
            </li>
          ))}
        </ul>

        <a
          href="#roast"
          className="mx-auto mt-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
        >
          Go on then, roast mine 🔥
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
            <p className="max-w-md text-base leading-relaxed text-balance text-neutral-400">
              {blurb}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
