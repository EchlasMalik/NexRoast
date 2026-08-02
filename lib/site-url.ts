// The canonical production URL, used to build absolute links in robots.txt
// and sitemap.xml. Vercel's own VERCEL_URL is deployment-specific (it
// changes per preview/production build), so SITE_URL should be set
// explicitly to the real custom domain once one is attached.
export function getSiteUrl(): string {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "http://localhost:3000";
}
