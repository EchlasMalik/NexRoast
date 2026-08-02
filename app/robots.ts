import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Roast pages stay crawlable but carry a page-level `noindex` (see
// app/roast/[id]/page.tsx) — Google explicitly recommends against
// Disallow-ing pages you want deindexed, since a disallowed page's crawler
// never sees the noindex tag in the first place.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
