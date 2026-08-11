import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

// Sitemaps cap at 50,000 URLs; this is well under that and keeps the query
// bounded as the audit table grows.
const MAX_AUDITS = 5_000;

/**
 * Public audits are content now, so they belong in the sitemap — but only the
 * ones that earned it.
 *
 * The `indexable` flag is set once when an audit completes
 * (lib/audit/visibility.ts): it excludes failed and incomplete audits, ones
 * too thin to be worth a search result, and repeat audits of a host that a
 * newer audit has superseded. Reading the flag rather than recomputing the
 * rules here is what keeps this list identical to what each page's robots meta
 * claims.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const entries: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  try {
    const audits = await prisma.audit.findMany({
      where: { indexable: true, status: "complete" },
      select: { id: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take: MAX_AUDITS,
    });

    for (const audit of audits) {
      entries.push({
        url: `${base}/audit/${audit.id}`,
        lastModified: audit.completedAt ?? undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (error) {
    // A database blip should degrade the sitemap to the homepage, not return
    // a 500 to a crawler.
    console.error("Could not list audits for the sitemap", error);
  }

  return entries;
}
