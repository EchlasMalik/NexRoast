/**
 * Everything a browser can determine about a page without asking a model.
 *
 * The split matters: any criterion answerable from these facts is scored in
 * code and is bit-for-bit reproducible, which is what stops the overall score
 * drifting between two audits of an unchanged site. The model is only asked
 * questions that genuinely need perception or semantics.
 *
 * Performance in particular is measured *only* — the brief requires real data
 * rather than guesses, and the reliable way to guarantee that is never to let
 * the model near it.
 */
export type PageFacts = {
  finalUrl: string;
  isHttps: boolean;

  // Head / indexability
  title: string;
  metaDescription: string | null;
  canonical: string | null;
  robotsNoindex: boolean;
  lang: string | null;
  ogTitle: string | null;
  ogImage: string | null;

  // Structure
  h1Count: number;
  h1Text: string | null;
  headingCount: number;
  /** No skipped levels (h1 → h3 with no h2). */
  headingOrderOk: boolean;
  wordCount: number;

  // Structured data
  jsonLdTypes: string[];
  hasOrganizationSchema: boolean;
  hasLocalBusinessSchema: boolean;
  sameAsCount: number;

  // Links and contact routes
  internalLinkCount: number;
  telLinkCount: number;
  mailtoLinkCount: number;
  hasContactLink: boolean;
  hasPrivacyLink: boolean;
  hasPostalAddress: boolean;

  // Media
  imageCount: number;
  imagesWithAlt: number;

  // Interaction surface
  formCount: number;
  /** Text of prominent links/buttons in the first viewport — CTA candidates. */
  aboveFoldCtas: string[];

  // Measured performance (Navigation Timing + response accounting)
  loadTimeMs: number;
  domContentLoadedMs: number;
  transferredBytes: number;
  requestCount: number;

  // Mobile (second capture at 390×844)
  hasViewportMeta: boolean;
  mobileHorizontalOverflow: boolean;
  tapTargetCount: number;
  smallTapTargetCount: number;

  /** Candidate business names, best source first. Never invented. */
  nameCandidates: {
    jsonLd: string | null;
    ogSiteName: string | null;
    title: string | null;
  };
};

/**
 * The subset the model is shown. Deliberately narrower than PageFacts: the
 * model does not need byte counts or tap-target tallies to answer a perception
 * question, and every extra number is a number it might try to reason about
 * and get wrong.
 */
export function factsForPrompt(facts: PageFacts) {
  return {
    url: facts.finalUrl,
    title: facts.title || "(none)",
    metaDescription: facts.metaDescription ?? "(none)",
    h1: facts.h1Text ?? "(none)",
    headings: facts.headingCount,
    approxWordCount: facts.wordCount,
    structuredDataTypes: facts.jsonLdTypes.length
      ? facts.jsonLdTypes.join(", ")
      : "(none)",
    aboveFoldCallsToAction: facts.aboveFoldCtas.length
      ? facts.aboveFoldCtas.join(" | ")
      : "(none detected)",
    phoneLinks: facts.telLinkCount,
    emailLinks: facts.mailtoLinkCount,
    hasContactPageLink: facts.hasContactLink,
    postalAddressPresent: facts.hasPostalAddress,
    forms: facts.formCount,
    loadTimeMs: facts.loadTimeMs,
  };
}
