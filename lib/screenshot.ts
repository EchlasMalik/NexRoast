import { chromium, type Browser } from "playwright-core";

const VIEWPORT = { width: 1440, height: 900 };
const NAVIGATION_TIMEOUT_MS = 15_000;
// Many sites still have entrance animations, lazy-loaded images, or
// client-side rendering running after the `load` event fires — screenshotting
// immediately can catch things mid-fade-in or still blank. A fixed settle
// delay is blunter than waiting for a specific condition, but there's no
// single condition that reliably signals "animations are done" across
// arbitrary third-party sites, so this is the pragmatic choice.
const SETTLE_DELAY_MS = 5_000;

export class ScreenshotError extends Error {}

export type PageCapture = {
  screenshot: Buffer;
  title: string;
  description: string | null;
  loadTimeMs: number;
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
 * Launches headless Chromium, navigates to `url`, and captures the
 * above-the-fold viewport (no fullPage scroll-and-stitch) as a PNG buffer,
 * along with basic page metadata gathered from the same load.
 */
export async function captureScreenshot(url: string): Promise<PageCapture> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({ viewport: VIEWPORT });

    const startedAt = Date.now();
    try {
      await page.goto(url, {
        waitUntil: "load",
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new ScreenshotError(`Could not load "${url}": ${reason}`);
    }
    const loadTimeMs = Date.now() - startedAt;

    // Deliberately after loadTimeMs is captured — that metric describes the
    // actual page load (shown to the user via the critique), not this
    // artificial wait.
    await page.waitForTimeout(SETTLE_DELAY_MS);

    const [screenshot, title, description] = await Promise.all([
      page.screenshot({ type: "png" }),
      page.title(),
      page.evaluate(
        () =>
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") ?? null,
      ),
    ]);

    return { screenshot, title, description, loadTimeMs };
  } finally {
    await browser.close();
  }
}
