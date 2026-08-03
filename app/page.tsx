"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { trackClient } from "@/lib/analytics-client";

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
    <main className="flex flex-1 flex-col bg-gradient-to-b from-neutral-950 via-neutral-950 to-orange-950">
      <section className="flex flex-1 flex-col items-center justify-center gap-10 px-5 py-16 text-center sm:px-6">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/NexRoast-Logo.png"
            alt="NexRoast"
            width={128}
            height={128}
            priority
            className="rounded-full"
          />
          <span className="text-xs font-bold tracking-[0.3em] text-orange-400 uppercase">
            NexRoast
          </span>
          <h1 className="max-w-sm text-4xl leading-[1.05] font-black tracking-tight text-white sm:max-w-xl sm:text-6xl">
            Your website is about to get{" "}
            <span className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-500 bg-clip-text text-transparent">
              roasted
            </span>
            .
          </h1>
          <p className="max-w-xs text-base text-neutral-400 sm:max-w-md sm:text-lg">
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
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white placeholder-neutral-500 outline-none focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Firing up the roast…" : "Roast my site 🔥"}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-400">
              {error}
            </p>
          )}
        </form>

        <p className="text-xs text-neutral-500">
          Free roast. No signup. Brutal honesty guaranteed.
        </p>
      </section>

      <section className="border-t border-white/5 px-5 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-xs font-bold tracking-[0.3em] text-orange-400 uppercase">
              Why it works
            </span>
            <h2 className="max-w-lg text-3xl font-black tracking-tight text-white sm:text-4xl">
              Because nobody else is going to tell you.
            </h2>
            <p className="max-w-md text-base text-neutral-400">
              Friends are kind, agencies are billing you, and analytics only
              shows you the leaving — never the reason.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-3">
            {WHY_IT_WORKS.map((item) => (
              <li
                key={item.title}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 text-left"
              >
                <span className="text-2xl">{item.icon}</span>
                <h3 className="text-base font-black text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-400">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
