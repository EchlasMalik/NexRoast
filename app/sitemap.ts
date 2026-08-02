import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Roast pages are ephemeral, per-visitor share links rather than durable
// content (and are marked `noindex` individually), so the sitemap only
// lists the one evergreen marketing page.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getSiteUrl(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
