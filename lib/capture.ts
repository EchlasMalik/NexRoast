import { chromium, type Browser } from "playwright-core";
import { extractDesktopFacts, extractMobileFacts } from "@/lib/audit/extract";
import type { PageFacts } from "@/lib/audit/facts";

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const NAVIGATION_TIMEOUT_MS = 15_000;
// Many sites still have entrance animations, lazy-loaded images, or
// client-side rendering running after the `load` event fires — screenshotting
// immediately can catch things mid-fade-in or still blank. A fixed settle
// delay is blunter than waiting for a specific condition, but there's no
// single condition that reliably signals "animations are done" across
// arbitrary third-party sites, so this is the pragmatic choice.
const SETTLE_DELAY_MS = 4_000;
// The mobile pass reuses the warm browser and an already-cached page, so it
// costs far less than the first load. Kept deliberately short — it only needs
// layout, not polish.
const MOBILE_SETTLE_MS = 800;

export class CaptureError extends Error {}

export type PageCapture = {
  screenshot: Buffer;
  facts: PageFacts;
};

/**
 * On Vercel there's no room to bundle a full Chromium download (the default
 * serverless function size limit is far smaller than the ~300MB browser
 * `playwright install` pulls down, and there's no persistent disk to cache
 * it on anyway) — `@sparticuz/chromium` ships a compressed build made for
 * exactly this constraint. Locally, `playwright-core` reuses whatever
 * `npx playwright install chromium` already put in the shared browser
 * cache, so no extra config is needed for dev.
 */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const { default: chromiumBinary } = await import("@sparticuz/chromium");
    return chromium.launch({
      args: chromiumBinary.args,
      executablePath: await chromiumBinary.executablePath(),
      headless: true,
    });
  }

  return chromium.launch({ headless: true });
}

/**
 * Picks the business name from the most trustworthy source available, and
 * returns null rather than guessing. A fabricated company name on a public,
 * indexed page about a real business is the worst failure this product has, so
 * the domain is deliberately *not* a fallback — the UI shows the host instead.
 */
export function resolveBusinessName(
  facts: Pick<PageFacts, "nameCandidates">,
): string | null {
  const { jsonLd, ogSiteName, title } = facts.nameCandidates;

  const clean = (value: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length >= 2 && trimmed.length <= 80 ? trimmed : null;
  };

  // Structured data first — it's the only source that's explicitly declaring
  // a name rather than incidentally containing one.
  const fromJsonLd = clean(jsonLd);
  if (fromJsonLd) return fromJsonLd;

  const fromOg = clean(ogSiteName);
  if (fromOg) return fromOg;

  // Titles are usually "Name | Tagline" or "Tagline - Name". Take the shortest
  // segment that still looks like a name, which is nearly always the brand.
  const segments = (title ?? "")
    .split(/[|–—·»]|\s-\s/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 40);

  if (segments.length > 1) {
    const shortest = segments.reduce((a, b) => (a.length <= b.length ? a : b));
    // A segment full of marketing words isn't a name.
    if (!/\b(welcome|home|official|best|cheap|top|leading)\b/i.test(shortest)) {
      return clean(shortest);
    }
  }

  return null;
}

/**
 * Loads the page once, captures the above-the-fold desktop screenshot, runs
 * the deterministic extraction pass, then re-lays-out the same page at a phone
 * viewport for the mobile-only measurements.
 *
 * Reuses one page for both viewports rather than navigating twice: the second
 * load would cost another round trip against the 45s function budget, and the
 * only thing the mobile pass needs is layout.
 */
export async function capturePage(url: string): Promise<PageCapture> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({ viewport: DESKTOP_VIEWPORT });

    // Response accounting for the measured performance criteria — the only
    // honest source for "how heavy is this page".
    let transferredBytes = 0;
    let requestCount = 0;
    page.on("response", (response) => {
      requestCount++;
      const length = Number(response.headers()["content-length"] ?? 0);
      if (Number.isFinite(length)) transferredBytes += length;
    });

    const startedAt = Date.now();
    try {
      await page.goto(url, {
        waitUntil: "load",
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new CaptureError(`Could not load "${url}": ${reason}`);
    }
    const loadTimeMs = Date.now() - startedAt;

    // Deliberately after loadTimeMs is captured — that metric describes the
    // actual page load the visitor experiences, not this artificial wait.
    await page.waitForTimeout(SETTLE_DELAY_MS);

    const [screenshot, desktop] = await Promise.all([
      page.screenshot({ type: "png" }),
      page.evaluate(extractDesktopFacts),
    ]);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.waitForTimeout(MOBILE_SETTLE_MS);
    const mobile = await page.evaluate(extractMobileFacts);

    const facts: PageFacts = {
      ...desktop,
      loadTimeMs,
      transferredBytes,
      requestCount,
      ...mobile,
      nameCandidates: {
        jsonLd: desktop.jsonLdName,
        ogSiteName: desktop.ogSiteName,
        title: desktop.title || null,
      },
    };

    return { screenshot, facts };
  } finally {
    await browser.close();
  }
}
