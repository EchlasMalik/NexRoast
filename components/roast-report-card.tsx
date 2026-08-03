import Image from "next/image";
import type { PublicCritique } from "@/lib/critique";
import { parseRichText } from "@/lib/rich-text";
import {
  SURVIVAL_LABELS,
  SURVIVAL_MAX,
  survivalStars,
} from "@/lib/score-style";

/**
 * Renders the roast's tiny markdown subset (see lib/rich-text.ts). Nothing
 * here can produce markup — parts are only ever wrapped in <strong>/<em>, so
 * model output stays plain text no matter what it contains.
 */
function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((part, index) => {
        if (part.type === "bold") {
          return (
            <strong key={index} className="font-bold text-neutral-900">
              {part.text}
            </strong>
          );
        }
        if (part.type === "italic") {
          return <em key={index}>{part.text}</em>;
        }
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-5 w-5 ${filled ? "fill-orange-500" : "fill-neutral-300"}`}
    >
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function SurvivalRating({ score }: { score: number }) {
  const stars = survivalStars(score);

  return (
    <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
      <span className="text-[11px] font-bold tracking-[0.14em] text-neutral-400 uppercase">
        Survival rating
      </span>
      <div
        className="flex items-center gap-0.5"
        role="img"
        aria-label={`${stars} out of ${SURVIVAL_MAX} — ${SURVIVAL_LABELS[stars]}`}
      >
        {Array.from({ length: SURVIVAL_MAX }, (_, index) => (
          <Star key={index} filled={index < stars} />
        ))}
      </div>
      <span className="text-xs font-semibold text-neutral-500">
        {SURVIVAL_LABELS[stars]}
      </span>
    </div>
  );
}

// Fixed line widths so the placeholder reads as two real paragraphs of prose
// rather than an obviously generated block — and so it doesn't reflow on
// every render the way random widths would.
const LOCKED_LINE_WIDTHS = [
  ["100%", "94%", "98%", "61%"],
  ["100%", "89%", "73%"],
];

/**
 * The blurred stand-in for the paragraphs a locked roast doesn't get. The
 * real text never reaches the browser (the API strips it — see
 * app/api/roast/[id]/route.ts), so these are genuinely just grey bars: there
 * is nothing here to un-blur with devtools.
 */
function LockedParagraphs({ count }: { count: number }) {
  return (
    <div className="relative py-1">
      <div
        aria-hidden
        className="pointer-events-none flex flex-col gap-5 blur-[3px] select-none"
      >
        {LOCKED_LINE_WIDTHS.map((paragraph, paragraphIndex) => (
          <div key={paragraphIndex} className="flex flex-col gap-2.5">
            {paragraph.map((width, lineIndex) => (
              <div
                key={lineIndex}
                style={{ width }}
                className="h-3.5 rounded bg-neutral-200"
              />
            ))}
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white shadow-lg">
          🔒 {count} more problem{count === 1 ? "" : "s"} spotted
        </span>
      </div>
    </div>
  );
}

/**
 * The written review itself — a light card on the dark page, so it reads as a
 * document rather than another dashboard panel. That's what makes it worth
 * screenshotting, which is how this thing spreads.
 *
 * Purely presentational: no fetching, no unlock logic. What's visible is
 * decided upstream by `toPublicCritique`, so this renders whatever it's given.
 */
export function RoastReportCard({
  url,
  screenshotUrl,
  critique,
}: {
  url: string;
  screenshotUrl: string | null;
  critique: PublicCritique;
}) {
  return (
    <article className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/50">
      {screenshotUrl && (
        <div className="relative bg-neutral-950">
          <Image
            src={screenshotUrl}
            alt={`Screenshot of ${url}`}
            width={1440}
            height={900}
            className="max-h-72 w-full object-cover object-top"
            priority
          />
          <span className="absolute bottom-4 left-4 rounded-md bg-orange-600 px-3 py-1.5 text-[11px] font-black tracking-wide text-white uppercase shadow-lg">
            Analysis complete
          </span>
        </div>
      )}

      <div className="p-6 sm:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {/* The logo is a white disc on a transparent square, so it gets no
                backing tile and no rounded-rect crop — either one shows the
                page through the transparent corners as dark edges. */}
            <Image
              src="/NexRoast-Logo.png"
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full"
            />
            <div>
              <h1 className="font-display text-lg leading-snug font-bold tracking-tight text-neutral-900 sm:text-xl">
                {critique.persona}
              </h1>
              <p className="mt-1 text-[13px] tracking-wide text-neutral-500">
                NexRoast v2.0 • Brutal Mode
              </p>
            </div>
          </div>
          <SurvivalRating score={critique.score} />
        </header>

        <hr className="my-6 border-neutral-200" />

        <div className="flex flex-col gap-5 font-serif text-[1.0625rem] leading-[1.7] text-neutral-700 sm:text-[1.125rem] sm:leading-[1.75]">
          <p>
            <RichText text={critique.opening} />
          </p>

          {critique.roastParagraphs.map((paragraph, index) => (
            <p key={index}>
              <RichText text={paragraph} />
            </p>
          ))}

          {critique.lockedParagraphCount > 0 && (
            <LockedParagraphs count={critique.lockedParagraphCount} />
          )}

          {critique.silverLining && (
            <p>
              <strong className="font-bold text-neutral-900">
                The silver lining?
              </strong>{" "}
              <RichText text={critique.silverLining} />
            </p>
          )}

          {critique.zinger && (
            <p className="border-l-2 border-orange-300 pl-4 text-neutral-600 italic">
              <RichText text={critique.zinger} />
            </p>
          )}
        </div>

        {critique.biggestWin && (
          <div className="mt-7 rounded-2xl border border-orange-200 bg-orange-50 p-5 sm:p-6">
            <span className="text-[11px] font-bold tracking-[0.16em] text-orange-700 uppercase">
              💡 Biggest win
            </span>
            <p className="mt-2 font-serif text-[1.0625rem] leading-[1.7] text-neutral-800">
              <RichText text={critique.biggestWin} />
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
