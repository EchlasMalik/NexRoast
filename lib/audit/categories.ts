/**
 * The nine audit categories, their display metadata, and the weight tables
 * that decide how much each one contributes to the overall score.
 *
 * Single source of truth: the report card, the PDF and both share images all
 * read labels and colours from here, so a category can never be renamed in one
 * surface and not another.
 */

export const CATEGORY_KEYS = [
  "conversion",
  "messaging",
  "trust",
  "ux",
  "seo",
  "localSeo",
  "performance",
  "mobile",
  "aiSearch",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORIES: Record<
  CategoryKey,
  { label: string; short: string; blurb: string }
> = {
  conversion: {
    label: "Conversion",
    short: "Conversion",
    blurb:
      "Whether it's obvious what a visitor should do next, and how easy it is to do it.",
  },
  messaging: {
    label: "Messaging",
    short: "Messaging",
    blurb:
      "Whether the page says what you do, who it's for, and why you're the right choice.",
  },
  trust: {
    label: "Trust",
    short: "Trust",
    blurb:
      "The proof a first-time visitor needs before handing over money or details.",
  },
  ux: {
    label: "User experience",
    short: "UX",
    blurb:
      "Navigation, hierarchy and readability — how much effort the page asks for.",
  },
  seo: {
    label: "Search visibility",
    short: "SEO",
    blurb:
      "The technical and on-page signals search engines use to understand the site.",
  },
  localSeo: {
    label: "Local presence",
    short: "Local",
    blurb:
      "Location, service areas and the details local customers search for.",
  },
  performance: {
    label: "Performance",
    short: "Speed",
    blurb: "Measured load behaviour — how long a real visitor waits.",
  },
  mobile: {
    label: "Mobile",
    short: "Mobile",
    blurb:
      "How the page behaves on a phone, where most of your traffic actually is.",
  },
  aiSearch: {
    label: "AI readability",
    short: "AI",
    blurb:
      "Whether the page is structured clearly enough for AI assistants to quote it.",
  },
};

/**
 * Business archetypes shift what matters. A local plumber lives and dies by
 * phone visibility and service areas; a SaaS is judged on positioning and
 * signup flow, and would be unfairly punished by the same weights.
 *
 * `localSeo` weight is zero for archetypes where local intent genuinely does
 * not apply — those audits drop the category entirely rather than scoring it
 * badly (see `resolveWeights`).
 */
export const ARCHETYPES = [
  "local_service",
  "professional_services",
  "hospitality",
  "ecommerce",
  "saas",
  "agency",
  "healthcare",
  "education",
  "nonprofit",
  "other",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

type Weights = Record<CategoryKey, number>;

const BASE: Weights = {
  conversion: 18,
  messaging: 16,
  trust: 14,
  ux: 12,
  seo: 12,
  localSeo: 8,
  performance: 8,
  mobile: 8,
  aiSearch: 4,
};

/** Only the deltas from BASE, so the intent of each archetype stays readable. */
const ARCHETYPE_WEIGHTS: Partial<Record<Archetype, Partial<Weights>>> = {
  local_service: {
    conversion: 20,
    trust: 16,
    localSeo: 14,
    seo: 8,
    aiSearch: 2,
  },
  professional_services: {
    trust: 18,
    messaging: 18,
    localSeo: 10,
    aiSearch: 4,
  },
  hospitality: {
    localSeo: 16,
    trust: 16,
    mobile: 10,
    conversion: 16,
    aiSearch: 2,
  },
  ecommerce: {
    conversion: 22,
    trust: 18,
    mobile: 12,
    localSeo: 0,
    performance: 10,
  },
  saas: { messaging: 22, conversion: 20, trust: 12, localSeo: 0, aiSearch: 6 },
  agency: { messaging: 20, trust: 18, localSeo: 0, aiSearch: 6 },
  healthcare: { trust: 20, localSeo: 14, conversion: 16, aiSearch: 2 },
  education: { messaging: 18, trust: 16, localSeo: 6 },
  nonprofit: { messaging: 20, trust: 18, conversion: 16, localSeo: 4 },
};

/**
 * Final per-category weights for an audit, renormalised to sum to 100 after
 * any category has been dropped. Dropping matters: a category with no
 * applicable criteria must not silently drag the average toward zero, which is
 * exactly how "score a SaaS on local SEO" produces a nonsense number.
 */
export function resolveWeights(
  archetype: Archetype,
  dropped: readonly CategoryKey[] = [],
): Weights {
  const merged = { ...BASE, ...(ARCHETYPE_WEIGHTS[archetype] ?? {}) };

  for (const key of dropped) merged[key] = 0;

  const total = CATEGORY_KEYS.reduce((sum, key) => sum + merged[key], 0);
  if (total === 0) return merged;

  const scaled = {} as Weights;
  for (const key of CATEGORY_KEYS) {
    scaled[key] = (merged[key] / total) * 100;
  }
  return scaled;
}

// ---------------------------------------------------------------------------
// Score presentation
// ---------------------------------------------------------------------------

export type ScoreBand = "strong" | "solid" | "mixed" | "weak";

/**
 * Colour here encodes STATUS, and a band colour is only ever shown on its own
 * — one overall score, one colour, always beside its label. That is why four
 * steps are fine: nobody has to tell two of them apart side by side.
 *
 * The previous values were tuned for a dark page. The report card is white
 * now, and re-running the palette validator against a white surface failed
 * them outright: the old amber sat at L 0.811 with 1.79:1 contrast, and amber
 * against the old orange measured ΔE 13.6 for normal vision — below the floor
 * where full-colour readers can reliably separate them. These steps are
 * re-picked and all clear 3:1 against white.
 *
 * Category meters deliberately do NOT use these — see CATEGORY_METER below.
 */
export const SCORE_BANDS: Record<
  ScoreBand,
  { label: string; hex: string; text: string; ring: string; chipBg: string }
> = {
  strong: {
    label: "Strong",
    hex: "#0f7a38",
    text: "text-[#0f7a38]",
    ring: "border-[#0f7a38]",
    chipBg: "bg-[#0f7a38]/12 text-[#0f7a38]",
  },
  solid: {
    label: "Solid, with gaps",
    hex: "#9a6b00",
    text: "text-[#9a6b00]",
    ring: "border-[#9a6b00]",
    chipBg: "bg-[#9a6b00]/12 text-[#9a6b00]",
  },
  mixed: {
    label: "Needs work",
    hex: "#c2410c",
    text: "text-[#c2410c]",
    ring: "border-[#c2410c]",
    chipBg: "bg-[#c2410c]/12 text-[#c2410c]",
  },
  weak: {
    // Not "losing customers" — the audit has no way to know that, and a band
    // label is exactly the kind of unevidenced claim about a named business
    // the moderation layer exists to catch. Describe the page, not outcomes.
    label: "Significant gaps",
    hex: "#c0202a",
    text: "text-[#c0202a]",
    ring: "border-[#c0202a]",
    chipBg: "bg-[#c0202a]/12 text-[#c0202a]",
  },
};

/**
 * The category meters are magnitude, not status — nine bars read together, in
 * a column. Colour-coding each one by its own band would put green, amber and
 * red adjacent, which is the single worst triad for red-green colour blindness
 * (measured ΔE 4.4 deutan between the amber and red steps — unreadable).
 *
 * So magnitude is encoded by bar length in one fixed hue, which is both the
 * correct encoding for a quantity and colourblind-safe by construction. The
 * score number sits beside every bar, so the value never depends on the bar at
 * all.
 */
export const CATEGORY_METER = {
  fill: "#c2410c",
  track: "#e7e5e4",
} as const;

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "strong";
  if (score >= 60) return "solid";
  if (score >= 40) return "mixed";
  return "weak";
}

export function bandFor(score: number) {
  return SCORE_BANDS[scoreBand(score)];
}
