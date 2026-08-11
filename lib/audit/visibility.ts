import type { AuditReport } from "@/lib/audit/scoring";
import { prisma } from "@/lib/prisma";

/**
 * The one place that decides whether an audit may be indexed and listed in the
 * sitemap. Everything — the page's robots meta, the canonical tag and the
 * sitemap query — reads the `indexable` column this sets, so a crawler and a
 * visitor can never disagree about a given audit.
 *
 * Decided once at completion rather than at render time. A rule evaluated per
 * request would let the same URL flip between indexable and not depending on
 * what else happened to be in the database that second.
 */

/** Enough substance to be worth a search result rather than a thin page. */
const MIN_ISSUES = 3;
const MIN_STRENGTHS = 2;
const MIN_SUMMARY_CHARS = 80;

export type VisibilityDecision = {
  indexable: boolean;
  reason: string;
};

export function assessReport(report: AuditReport): VisibilityDecision {
  if (report.issues.length < MIN_ISSUES) {
    return { indexable: false, reason: "too few issues to be useful content" };
  }
  if (report.strengths.length < MIN_STRENGTHS) {
    return { indexable: false, reason: "too few strengths" };
  }
  if (report.summary.trim().length < MIN_SUMMARY_CHARS) {
    return { indexable: false, reason: "summary too short" };
  }
  // A report with no scored categories means every criterion dropped out —
  // the page would show a score with nothing behind it.
  if (!report.categories.some((category) => category.applicable)) {
    return { indexable: false, reason: "no applicable categories" };
  }
  return { indexable: true, reason: "meets the quality bar" };
}

/**
 * Applies the decision, and enforces one indexable audit per host.
 *
 * Repeat audits of the same site would otherwise produce near-identical pages
 * competing with each other in search. Newest wins: older audits for the host
 * stay live and reachable at their own URLs, they simply stop being indexable
 * and drop out of the sitemap.
 */
export async function finaliseVisibility(
  auditId: string,
  host: string,
  report: AuditReport,
): Promise<VisibilityDecision> {
  const decision = assessReport(report);

  await prisma.audit.update({
    where: { id: auditId },
    data: { indexable: decision.indexable },
  });

  if (decision.indexable) {
    await prisma.audit.updateMany({
      where: { host, indexable: true, id: { not: auditId } },
      data: { indexable: false },
    });
  }

  return decision;
}

/**
 * Normalised host used for grouping repeat audits. Lowercased with `www.`
 * stripped, so example.com and www.example.com are one site.
 */
export function normaliseHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url.toLowerCase();
  }
}
