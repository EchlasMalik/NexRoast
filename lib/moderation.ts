import { Filter } from "bad-words";
import type { Critique } from "@/lib/critique";

const filter = new Filter();

/**
 * Basic profanity/brand-safety check on a generated critique. The system
 * prompt already asks for a witty, not-mean-spirited tone, but LLM output can
 * occasionally slip — this is the programmatic backstop that keeps anything
 * genuinely unsafe from ever being stored or rendered, since these results
 * are built to be screenshotted and shared on TikTok.
 */
export function isCritiqueSafe(critique: Critique): boolean {
  const text = [
    critique.persona,
    critique.opening,
    ...critique.roastParagraphs,
    critique.silverLining,
    critique.zinger,
    critique.biggestWin,
  ].join(" \n");

  return !filter.isProfane(text);
}
