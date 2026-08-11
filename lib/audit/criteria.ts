import type { CategoryKey } from "@/lib/audit/categories";
import type { PageFacts } from "@/lib/audit/facts";

/**
 * The criterion registry — the reason the score is defensible rather than
 * arbitrary. Every point in every category traces back to one named entry
 * here, and the audit page shows the user exactly which ones passed.
 *
 * Two sources:
 * - `measured` — evaluated in code from PageFacts. Deterministic. The model
 *   never sees these, which keeps them out of the prompt and out of the
 *   response, and makes a large slice of the score reproducible.
 * - `judged`   — a verdict from the model, which must also supply evidence.
 *   Reserved for things that genuinely need perception or semantics.
 *
 * A measured `evaluate` returning `null` means "not applicable to this page",
 * and the criterion drops out of its category's denominator rather than
 * scoring zero.
 */

export type Verdict = "pass" | "partial" | "fail";

export const VERDICT_POINTS: Record<Verdict, number> = {
  pass: 1,
  partial: 0.5,
  fail: 0,
};

type Base = {
  id: string;
  category: CategoryKey;
  /** Shown to the user in the score breakdown. Plain, non-jargon. */
  label: string;
  /** Relative weight inside its own category. */
  weight: number;
};

export type MeasuredCriterion = Base & {
  source: "measured";
  evaluate: (facts: PageFacts) => Verdict | null;
};

export type JudgedCriterion = Base & {
  source: "judged";
  /**
   * Goes verbatim into the JSON Schema `description` for this criterion's
   * verdict field — i.e. it reaches the model at the exact point it writes the
   * answer, rather than hundreds of tokens away in the system prompt.
   */
  question: string;
};

export type Criterion = MeasuredCriterion | JudgedCriterion;

/** Helper: three-way threshold check. */
const band = (value: number, good: number, ok: number): Verdict =>
  value >= good ? "pass" : value >= ok ? "partial" : "fail";

/** Helper: inverse threshold (lower is better). */
const bandDesc = (value: number, good: number, ok: number): Verdict =>
  value <= good ? "pass" : value <= ok ? "partial" : "fail";

const MEASURED: MeasuredCriterion[] = [
  // ---- SEO -------------------------------------------------------------
  {
    id: "seo.title",
    category: "seo",
    label: "Page title is present and a usable length",
    weight: 3,
    source: "measured",
    evaluate: (f) => {
      const n = f.title.trim().length;
      if (n === 0) return "fail";
      return n >= 25 && n <= 65 ? "pass" : "partial";
    },
  },
  {
    id: "seo.metaDescription",
    category: "seo",
    label: "Meta description is present and a usable length",
    weight: 2,
    source: "measured",
    evaluate: (f) => {
      const n = f.metaDescription?.trim().length ?? 0;
      if (n === 0) return "fail";
      return n >= 70 && n <= 160 ? "pass" : "partial";
    },
  },
  {
    id: "seo.singleH1",
    category: "seo",
    label: "Exactly one main heading",
    weight: 2,
    source: "measured",
    evaluate: (f) =>
      f.h1Count === 1 ? "pass" : f.h1Count === 0 ? "fail" : "partial",
  },
  {
    id: "seo.headingOrder",
    category: "seo",
    label: "Headings run in order without skipped levels",
    weight: 1,
    source: "measured",
    evaluate: (f) =>
      f.headingCount === 0 ? "fail" : f.headingOrderOk ? "pass" : "partial",
  },
  {
    id: "seo.canonical",
    category: "seo",
    label: "Canonical URL declared",
    weight: 1,
    source: "measured",
    evaluate: (f) => (f.canonical ? "pass" : "fail"),
  },
  {
    id: "seo.indexable",
    category: "seo",
    label: "Page is not blocked from search engines",
    weight: 3,
    source: "measured",
    evaluate: (f) => (f.robotsNoindex ? "fail" : "pass"),
  },
  {
    id: "seo.internalLinks",
    category: "seo",
    label: "Links through to the rest of the site",
    weight: 2,
    source: "measured",
    evaluate: (f) => band(f.internalLinkCount, 8, 3),
  },
  {
    id: "seo.https",
    category: "seo",
    label: "Served over HTTPS",
    weight: 2,
    source: "measured",
    evaluate: (f) => (f.isHttps ? "pass" : "fail"),
  },

  // ---- Performance (measured only, never judged) -----------------------
  {
    id: "perf.loadTime",
    category: "performance",
    label: "Page finishes loading quickly",
    weight: 4,
    source: "measured",
    evaluate: (f) => bandDesc(f.loadTimeMs, 2500, 5000),
  },
  {
    id: "perf.firstContent",
    category: "performance",
    label: "Content becomes available early",
    weight: 3,
    source: "measured",
    evaluate: (f) => bandDesc(f.domContentLoadedMs, 1800, 3500),
  },
  {
    id: "perf.weight",
    category: "performance",
    label: "Page weight is reasonable",
    weight: 2,
    source: "measured",
    evaluate: (f) =>
      f.transferredBytes === 0
        ? null
        : bandDesc(f.transferredBytes, 2_000_000, 5_000_000),
  },
  {
    id: "perf.requests",
    category: "performance",
    label: "Doesn't make an excessive number of requests",
    weight: 1,
    source: "measured",
    evaluate: (f) =>
      f.requestCount === 0 ? null : bandDesc(f.requestCount, 60, 120),
  },

  // ---- Mobile ----------------------------------------------------------
  {
    id: "mobile.viewport",
    category: "mobile",
    label: "Declares a mobile viewport",
    weight: 3,
    source: "measured",
    evaluate: (f) => (f.hasViewportMeta ? "pass" : "fail"),
  },
  {
    id: "mobile.noOverflow",
    category: "mobile",
    label: "No sideways scrolling on a phone",
    weight: 3,
    source: "measured",
    evaluate: (f) => (f.mobileHorizontalOverflow ? "fail" : "pass"),
  },
  {
    id: "mobile.tapTargets",
    category: "mobile",
    label: "Buttons and links are big enough to tap",
    weight: 2,
    source: "measured",
    evaluate: (f) => {
      if (f.tapTargetCount === 0) return null;
      const ratio = f.smallTapTargetCount / f.tapTargetCount;
      return ratio <= 0.05 ? "pass" : ratio <= 0.2 ? "partial" : "fail";
    },
  },

  // ---- Trust -----------------------------------------------------------
  {
    id: "trust.contactRoute",
    category: "trust",
    label: "There's an obvious way to make contact",
    weight: 3,
    source: "measured",
    evaluate: (f) => {
      const routes =
        (f.telLinkCount > 0 ? 1 : 0) +
        (f.mailtoLinkCount > 0 ? 1 : 0) +
        (f.hasContactLink ? 1 : 0) +
        (f.formCount > 0 ? 1 : 0);
      return band(routes, 2, 1);
    },
  },
  {
    id: "trust.postalAddress",
    category: "trust",
    label: "A real address is published",
    weight: 2,
    source: "measured",
    evaluate: (f) => (f.hasPostalAddress ? "pass" : "fail"),
  },
  {
    id: "trust.privacyPolicy",
    category: "trust",
    label: "Privacy policy is linked",
    weight: 1,
    source: "measured",
    evaluate: (f) => (f.hasPrivacyLink ? "pass" : "fail"),
  },

  // ---- AI readability --------------------------------------------------
  {
    id: "ai.organizationSchema",
    category: "aiSearch",
    label: "Identifies the business in structured data",
    weight: 3,
    source: "measured",
    evaluate: (f) =>
      f.hasOrganizationSchema || f.hasLocalBusinessSchema
        ? "pass"
        : f.jsonLdTypes.length > 0
          ? "partial"
          : "fail",
  },
  {
    id: "ai.contentDepth",
    category: "aiSearch",
    label: "Enough written content to be quotable",
    weight: 2,
    source: "measured",
    evaluate: (f) => band(f.wordCount, 300, 120),
  },
  {
    id: "ai.language",
    category: "aiSearch",
    label: "Declares its language",
    weight: 1,
    source: "measured",
    evaluate: (f) => (f.lang ? "pass" : "fail"),
  },

  // ---- UX --------------------------------------------------------------
  {
    id: "ux.imageAlt",
    category: "ux",
    label: "Images carry text alternatives",
    weight: 2,
    source: "measured",
    evaluate: (f) => {
      if (f.imageCount === 0) return null;
      return band(f.imagesWithAlt / f.imageCount, 0.9, 0.5);
    },
  },

  // ---- Local -----------------------------------------------------------
  {
    id: "local.businessSchema",
    category: "localSeo",
    label: "LocalBusiness structured data",
    weight: 3,
    source: "measured",
    evaluate: (f) => (f.hasLocalBusinessSchema ? "pass" : "fail"),
  },
  {
    id: "local.phone",
    category: "localSeo",
    label: "Phone number is tappable",
    weight: 3,
    source: "measured",
    evaluate: (f) => (f.telLinkCount > 0 ? "pass" : "fail"),
  },
  {
    id: "local.address",
    category: "localSeo",
    label: "Address is on the page",
    weight: 2,
    source: "measured",
    evaluate: (f) => (f.hasPostalAddress ? "pass" : "fail"),
  },
];

/**
 * Judged criteria. Each `question` is what the model actually answers, placed
 * inline in the response schema. Questions are phrased so that "pass" is
 * unambiguous and a cautious model isn't pushed toward inventing a fault —
 * the prompt explicitly permits passing everything.
 */
const JUDGED: JudgedCriterion[] = [
  // ---- Conversion ------------------------------------------------------
  {
    id: "conv.primaryCta",
    category: "conversion",
    label: "One obvious primary action",
    weight: 4,
    source: "judged",
    question:
      "Is there a single, visually obvious primary call to action in the first screen? pass = one clear dominant action; partial = present but competing with others or visually weak; fail = no clear action.",
  },
  {
    id: "conv.ctaClarity",
    category: "conversion",
    label: "The action says what happens next",
    weight: 2,
    source: "judged",
    question:
      "Does the main call-to-action wording say what actually happens (e.g. 'Get a free quote') rather than being generic ('Submit', 'Click here', 'Learn more')? pass = specific; partial = mildly generic; fail = meaningless.",
  },
  {
    id: "conv.friction",
    category: "conversion",
    label: "Nothing blocks the visitor",
    weight: 2,
    source: "judged",
    question:
      "Is the path to acting free of obvious friction — no intrusive popup, cookie wall covering content, or demand for details before any value is given? pass = clear path; partial = mild friction; fail = blocked.",
  },
  {
    id: "conv.guidance",
    category: "conversion",
    label: "The page leads somewhere",
    weight: 2,
    source: "judged",
    question:
      "Does the visible page guide a visitor toward converting, rather than ending without a next step? pass = clear guidance; partial = weak; fail = dead end.",
  },

  // ---- Messaging -------------------------------------------------------
  {
    id: "msg.whatYouDo",
    category: "messaging",
    label: "Clear within five seconds what the business does",
    weight: 4,
    source: "judged",
    question:
      "From the visible page alone, can you tell what this business actually does within about five seconds? pass = immediately clear; partial = inferable with effort; fail = genuinely unclear.",
  },
  {
    id: "msg.audience",
    category: "messaging",
    label: "Obvious who it's for",
    weight: 3,
    source: "judged",
    question:
      "Is the intended customer obvious from the visible content? pass = clearly stated or strongly implied; partial = vague; fail = no indication.",
  },
  {
    id: "msg.valueProp",
    category: "messaging",
    label: "A reason to choose this business",
    weight: 3,
    source: "judged",
    question:
      "Does the page give a concrete reason to choose this business over an alternative — a specific benefit, differentiator or proof point, not just a category description? pass = concrete; partial = generic claim; fail = none.",
  },
  {
    id: "msg.plainLanguage",
    category: "messaging",
    label: "Written in plain language",
    weight: 2,
    source: "judged",
    question:
      "Is the copy free of empty jargon and filler ('synergistic solutions', 'world-class innovation')? pass = plain and specific; partial = some filler; fail = mostly meaningless.",
  },

  // ---- Trust -----------------------------------------------------------
  {
    id: "trust.socialProof",
    category: "trust",
    label: "Visible social proof",
    weight: 4,
    source: "judged",
    question:
      "Is there visible social proof — testimonials, reviews, ratings, named clients, case studies, certifications or accreditation logos? pass = specific and credible; partial = present but thin or unattributed; fail = none visible.",
  },
  {
    id: "trust.credibility",
    category: "trust",
    label: "Looks professionally built",
    weight: 3,
    source: "judged",
    question:
      "Does the page look professionally designed and maintained — consistent typography and spacing, deliberate colour use, no obviously broken or placeholder content? Judge the page only, never the business. pass = credible; partial = dated or inconsistent; fail = visibly broken.",
  },
  {
    id: "trust.specificity",
    category: "trust",
    label: "Claims are specific rather than vague",
    weight: 2,
    source: "judged",
    question:
      "Are the claims specific enough to be checkable (real numbers, named services, actual locations) rather than unverifiable superlatives? pass = specific; partial = mixed; fail = all vague.",
  },

  // ---- UX --------------------------------------------------------------
  {
    id: "ux.hierarchy",
    category: "ux",
    label: "Clear visual hierarchy",
    weight: 3,
    source: "judged",
    question:
      "Does the page have a clear visual hierarchy that leads the eye in a sensible order? pass = clear; partial = flat or competing; fail = chaotic.",
  },
  {
    id: "ux.navigation",
    category: "ux",
    label: "Navigation makes sense",
    weight: 3,
    source: "judged",
    question:
      "Is the navigation understandable, with labels a customer would recognise and a sensible number of options? pass = clear; partial = cluttered or oddly labelled; fail = confusing or absent.",
  },
  {
    id: "ux.readability",
    category: "ux",
    label: "Comfortable to read",
    weight: 2,
    source: "judged",
    question:
      "Is the text comfortable to read — adequate size and contrast, sensible line length, not dense walls of copy? pass = comfortable; partial = strained in places; fail = hard to read.",
  },
  {
    id: "ux.distractions",
    category: "ux",
    label: "Free of unnecessary distractions",
    weight: 2,
    source: "judged",
    question:
      "Is the page free of unnecessary distractions such as autoplaying carousels, competing animations or intrusive banners? pass = calm; partial = some noise; fail = distracting.",
  },

  // ---- Local -----------------------------------------------------------
  {
    id: "local.intent",
    category: "localSeo",
    label: "Location and service area are clear",
    weight: 4,
    source: "judged",
    question:
      "Is it clear where this business operates — a town, city, region or stated service area visible on the page? pass = clear; partial = implied only; fail = no location signal.",
  },

  // ---- AI readability --------------------------------------------------
  {
    id: "ai.answerable",
    category: "aiSearch",
    label: "Answers questions directly",
    weight: 2,
    source: "judged",
    question:
      "Does the content answer the questions a customer would actually ask (what is offered, where, for whom, how to start) in direct, self-contained sentences an assistant could quote? pass = direct; partial = partial coverage; fail = marketing copy only.",
  },
];

export const CRITERIA: Criterion[] = [...MEASURED, ...JUDGED];

export const JUDGED_CRITERIA: JudgedCriterion[] = JUDGED;

export const MEASURED_CRITERIA: MeasuredCriterion[] = MEASURED;

export const CRITERIA_BY_ID = new Map(CRITERIA.map((c) => [c.id, c]));

/** Stable, schema-safe keys for the judged block of the model response. */
export const JUDGED_IDS = JUDGED.map((c) => c.id);
