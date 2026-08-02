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
