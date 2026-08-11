import type { NextConfig } from "next";

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

// Audit screenshots are served from R2's public r2.dev subdomain by default,
// or from R2_PUBLIC_URL's custom domain when one is configured — allow both
// so next/image can optimize them.
const remotePatterns: RemotePattern[] = [
  { protocol: "https", hostname: "*.r2.dev" },
];

if (process.env.R2_PUBLIC_URL) {
  try {
    const { hostname } = new URL(process.env.R2_PUBLIC_URL);
    if (!remotePatterns.some((p) => p.hostname === hostname)) {
      remotePatterns.push({ protocol: "https", hostname });
    }
  } catch {
    // Invalid R2_PUBLIC_URL — ignore; the r2.dev pattern still covers the default case.
  }
}

const nextConfig: NextConfig = {
  images: { remotePatterns },
  // Keep these `require()`-resolved at runtime instead of webpack-bundled —
  // both playwright-core and @sparticuz/chromium ship native binaries that
  // don't survive bundling, and @sparticuz/chromium's executablePath() needs
  // to find its own package directory on disk.
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@sparticuz/chromium",
  ],
  // serverExternalPackages keeps @sparticuz/chromium out of the webpack
  // bundle, but its compressed Chromium binary (node_modules/@sparticuz/chromium/bin/*.br)
  // is only ever referenced dynamically at runtime (chromium.executablePath()),
  // never via a static import — so Next's file tracer doesn't discover it on
  // its own and it silently gets left out of the deployed function. This
  // forces it in for the one route that actually launches a browser.
  // Targets /api/inngest, not /api/audit — capture runs inside the audit
  // function now, so the browser binary has to be traced into the function
  // that actually launches it. Getting this wrong is invisible in development
  // (where the local Playwright browser is used) and fails on Vercel with
  // "executable doesn't exist".
  outputFileTracingIncludes: {
    "/api/inngest": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  /**
   * The product used to live at /roast/{id} and those links are already out in
   * the world — shared, bookmarked, possibly linked to. They must not 404.
   *
   * A config-level redirect rather than middleware: this is a static path
   * rewrite with no request inspection, so it costs nothing at the edge, and
   * the project has no middleware.ts to justify introducing one.
   */
  async redirects() {
    return [
      { source: "/roast/:id", destination: "/audit/:id", permanent: true },
      {
        source: "/api/roast/:id",
        destination: "/api/audit/:id/status",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
