import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Audit pages are crawlable. The ones that shouldn't be indexed carry a
 * page-level `noindex` instead of being disallowed here, because a disallowed
 * page's crawler never fetches it and so never sees the noindex — Google
 * explicitly recommends against that combination.
 */
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
