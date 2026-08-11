/**
 * The in-page extraction pass.
 *
 * Everything here runs inside the browser via `page.evaluate`, so it must be
 * entirely self-contained — no imports, no closure over module scope, no
 * TypeScript-only constructs that don't survive serialisation.
 *
 * This is what makes most of the score deterministic. Anything a browser can
 * establish, a browser establishes; the model is only asked what needs
 * perception. Performance in particular is measured only, so the audit never
 * guesses at numbers it can read directly from the Navigation Timing API.
 */

export type DesktopExtract = {
  finalUrl: string;
  isHttps: boolean;
  title: string;
  metaDescription: string | null;
  canonical: string | null;
  robotsNoindex: boolean;
  lang: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  ogSiteName: string | null;
  h1Count: number;
  h1Text: string | null;
  headingCount: number;
  headingOrderOk: boolean;
  wordCount: number;
  jsonLdTypes: string[];
  jsonLdName: string | null;
  hasOrganizationSchema: boolean;
  hasLocalBusinessSchema: boolean;
  sameAsCount: number;
  internalLinkCount: number;
  telLinkCount: number;
  mailtoLinkCount: number;
  hasContactLink: boolean;
  hasPrivacyLink: boolean;
  hasPostalAddress: boolean;
  imageCount: number;
  imagesWithAlt: number;
  formCount: number;
  aboveFoldCtas: string[];
  hasViewportMeta: boolean;
  domContentLoadedMs: number;
};

export type MobileExtract = {
  mobileHorizontalOverflow: boolean;
  tapTargetCount: number;
  smallTapTargetCount: number;
};

/**
 * Passed to `page.evaluate()`. Returns null-safe primitives only — anything
 * non-serialisable would come back as `{}`.
 */
export function extractDesktopFacts(): DesktopExtract {
  const text = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    return trimmed.length ? trimmed : null;
  };

  const meta = (selector: string) =>
    text(document.querySelector(selector)?.getAttribute("content"));

  // --- structured data -----------------------------------------------------
  const jsonLdTypes: string[] = [];
  let jsonLdName: string | null = null;
  let sameAsCount = 0;

  for (const node of Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  )) {
    try {
      const parsed: unknown = JSON.parse(node.textContent ?? "");
      const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];

      while (queue.length) {
        const entry = queue.shift();
        if (!entry || typeof entry !== "object") continue;
        const record = entry as Record<string, unknown>;

        if (Array.isArray(record["@graph"])) queue.push(...record["@graph"]);

        const type = record["@type"];
        for (const t of Array.isArray(type) ? type : [type]) {
          if (typeof t === "string") jsonLdTypes.push(t);
        }

        if (!jsonLdName && typeof record.name === "string") {
          jsonLdName = record.name.trim() || null;
        }
        if (Array.isArray(record.sameAs)) sameAsCount += record.sameAs.length;
      }
    } catch {
      // A malformed block shouldn't lose the well-formed ones.
    }
  }

  const LOCAL_TYPES = [
    "localbusiness",
    "restaurant",
    "store",
    "dentist",
    "plumber",
    "homeandconstructionbusiness",
    "professionalservice",
    "medicalbusiness",
    "legalservice",
    "lodgingbusiness",
    "healthandbeautybusiness",
    "automotivebusiness",
  ];
  const lowered = jsonLdTypes.map((t) => t.toLowerCase());

  // --- headings ------------------------------------------------------------
  const headings = Array.from(
    document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
  ) as HTMLElement[];
  const levels = headings.map((h) => Number(h.tagName.slice(1)));
  let headingOrderOk = true;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      headingOrderOk = false;
      break;
    }
  }
  const h1s = headings.filter((h) => h.tagName === "H1");

  // --- links ---------------------------------------------------------------
  const anchors = Array.from(
    document.querySelectorAll("a[href]"),
  ) as HTMLAnchorElement[];
  let internalLinkCount = 0;
  let telLinkCount = 0;
  let mailtoLinkCount = 0;
  let hasContactLink = false;
  let hasPrivacyLink = false;

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") ?? "";
    const label = (anchor.textContent ?? "").toLowerCase();

    if (href.startsWith("tel:")) telLinkCount++;
    else if (href.startsWith("mailto:")) mailtoLinkCount++;
    else if (anchor.hostname === location.hostname) internalLinkCount++;

    if (/contact|get in touch|enquir|inquir/.test(label + " " + href)) {
      hasContactLink = true;
    }
    if (/privacy/.test(label + " " + href)) hasPrivacyLink = true;
  }

  // --- postal address ------------------------------------------------------
  const bodyText = document.body?.innerText ?? "";
  const hasPostalAddress =
    document.querySelector("address") !== null ||
    lowered.includes("postaladdress") ||
    // UK postcode, then a loose US ZIP fallback.
    /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(bodyText) ||
    /\b\d{5}(-\d{4})?\b/.test(bodyText);

  // --- above-the-fold calls to action -------------------------------------
  const foldHeight = window.innerHeight;
  const aboveFoldCtas: string[] = [];
  const candidates = Array.from(
    document.querySelectorAll("a,button,input[type=submit]"),
  ) as HTMLElement[];

  for (const element of candidates) {
    if (aboveFoldCtas.length >= 8) break;
    const rect = element.getBoundingClientRect();
    if (rect.top >= foldHeight || rect.width < 40 || rect.height < 20) continue;

    const label = (
      element.textContent ||
      (element as HTMLInputElement).value ||
      element.getAttribute("aria-label") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();

    if (
      label.length >= 2 &&
      label.length <= 60 &&
      !aboveFoldCtas.includes(label)
    ) {
      aboveFoldCtas.push(label);
    }
  }

  // --- images --------------------------------------------------------------
  const images = Array.from(document.images);

  // --- timing --------------------------------------------------------------
  const nav = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;

  return {
    finalUrl: location.href,
    isHttps: location.protocol === "https:",
    title: document.title ?? "",
    metaDescription: meta('meta[name="description"]'),
    canonical: text(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ),
    robotsNoindex: /noindex/i.test(meta('meta[name="robots"]') ?? ""),
    lang: text(document.documentElement.getAttribute("lang")),
    ogTitle: meta('meta[property="og:title"]'),
    ogImage: meta('meta[property="og:image"]'),
    ogSiteName: meta('meta[property="og:site_name"]'),
    h1Count: h1s.length,
    h1Text: text(h1s[0]?.textContent),
    headingCount: headings.length,
    headingOrderOk,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    jsonLdTypes: Array.from(new Set(jsonLdTypes)).slice(0, 20),
    jsonLdName,
    hasOrganizationSchema: lowered.includes("organization"),
    hasLocalBusinessSchema: lowered.some((t) => LOCAL_TYPES.includes(t)),
    sameAsCount,
    internalLinkCount,
    telLinkCount,
    mailtoLinkCount,
    hasContactLink,
    hasPrivacyLink,
    hasPostalAddress,
    imageCount: images.length,
    imagesWithAlt: images.filter((img) =>
      (img.getAttribute("alt") ?? "").trim(),
    ).length,
    formCount: document.forms.length,
    aboveFoldCtas,
    hasViewportMeta: document.querySelector('meta[name="viewport"]') !== null,
    domContentLoadedMs: nav
      ? Math.max(0, Math.round(nav.domContentLoadedEventEnd))
      : 0,
  };
}

/**
 * Runs at a phone viewport. Two of the three mobile criteria genuinely cannot
 * be answered from a desktop capture — without this the Mobile category would
 * be scored from nothing, which is exactly the arbitrariness the rubric is
 * built to avoid.
 */
export function extractMobileFacts(): MobileExtract {
  const doc = document.documentElement;
  const mobileHorizontalOverflow = doc.scrollWidth > doc.clientWidth + 2;

  const targets = Array.from(
    document.querySelectorAll("a[href],button,input,select,textarea"),
  ) as HTMLElement[];

  let tapTargetCount = 0;
  let smallTapTargetCount = 0;

  for (const element of targets) {
    const rect = element.getBoundingClientRect();
    // Ignore anything not actually rendered.
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.top > 4000) continue;

    tapTargetCount++;
    // 44px is the long-standing platform guidance on both iOS and Android.
    if (rect.width < 44 || rect.height < 44) smallTapTargetCount++;
  }

  return { mobileHorizontalOverflow, tapTargetCount, smallTapTargetCount };
}
