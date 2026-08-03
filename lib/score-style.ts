export type StatusBucket = "good" | "warning" | "serious" | "critical";

// Status colors from the validated dataviz palette — fixed hex values,
// always paired with an icon/label so color is never the only signal.
export const STATUS_STYLES: Record<
  StatusBucket,
  { hex: string; label: string; ring: string; chipBg: string }
> = {
  good: {
    hex: "#0ca30c",
    label: "Barely Roasted",
    ring: "border-[#0ca30c]",
    chipBg: "bg-[#0ca30c]/15 text-[#0ca30c]",
  },
  warning: {
    hex: "#fab219",
    label: "Lightly Toasted",
    ring: "border-[#fab219]",
    chipBg: "bg-[#fab219]/15 text-[#fab219]",
  },
  serious: {
    hex: "#ec835a",
    label: "Getting Crispy",
    ring: "border-[#ec835a]",
    chipBg: "bg-[#ec835a]/15 text-[#ec835a]",
  },
  critical: {
    hex: "#d03b3b",
    label: "Burnt to a Crisp",
    ring: "border-[#d03b3b]",
    chipBg: "bg-[#d03b3b]/15 text-[#d03b3b]",
  },
};

export function scoreBucket(score: number): StatusBucket {
  if (score >= 80) return "good";
  if (score >= 60) return "warning";
  if (score >= 40) return "serious";
  return "critical";
}

export const SURVIVAL_MAX = 5;

/**
 * The star rating shown next to the report. Derived from the score rather
 * than asked of the model as a separate field: a model-authored rating can
 * quietly disagree with its own score (four stars on a 38/100), and a report
 * that contradicts itself in the header is worse than one with slightly less
 * editorial nuance. Always at least one star — a zero-star row reads as a
 * rendering bug rather than a verdict.
 */
export function survivalStars(score: number): number {
  if (score >= 85) return 5;
  if (score >= 68) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

// Deliberately understated — the joke is the gap between the wording and how
// bad the score actually is.
export const SURVIVAL_LABELS: Record<number, string> = {
  5: "Thriving, annoyingly",
  4: "Holding up nicely",
  3: "Muddling through",
  2: "On life support",
  1: "Ring a priest",
};
