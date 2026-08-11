import { z } from "zod";
import {
  type Archetype,
  ARCHETYPES,
  CATEGORY_KEYS,
} from "@/lib/audit/categories";
import type { AuditReport } from "@/lib/audit/scoring";

/**
 * Reading a stored report back out of the database.
 *
 * The `report` column is JSON, so it is validated rather than trusted — a row
 * written by an older build must be detected, not crashed on. `reportVersion`
 * is the coarse gate; this schema is the fine one.
 *
 * There is deliberately no legacy adapter here. The previous roast formats were
 * removed from the database entirely rather than translated, because they had
 * no category scores, no issues and no business name — anything rendered from
 * them would have been invented.
 */

const CriterionResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum([...CATEGORY_KEYS]),
  source: z.enum(["measured", "judged"]),
  verdict: z.enum(["pass", "partial", "fail"]),
  evidence: z.string().nullable(),
});

const CategoryResultSchema = z.object({
  key: z.enum([...CATEGORY_KEYS]),
  score: z.number(),
  weight: z.number(),
  applicable: z.boolean(),
  criteria: z.array(CriterionResultSchema),
});

const ScoredIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum([...CATEGORY_KEYS]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  effort: z.enum(["quick", "moderate", "involved"]),
  impact: z.number(),
  evidence: z.string(),
  problem: z.string(),
  whyItMatters: z.string(),
  recommendation: z.string(),
  currentCopy: z.string().nullable(),
  recommendedCopy: z.string().nullable(),
});

export const StoredReportSchema = z.object({
  version: z.literal(1),
  businessName: z.string().nullable(),
  businessType: z.string(),
  archetype: z.enum([...ARCHETYPES]),
  localRelevant: z.boolean(),
  summary: z.string(),
  overallScore: z.number(),
  band: z.enum(["strong", "solid", "mixed", "weak"]),
  categories: z.array(CategoryResultSchema),
  strengths: z.array(z.string()),
  issues: z.array(ScoredIssueSchema),
  quickWins: z.array(z.string()),
  suggestedActions: z.array(z.string()),
  biggestOpportunity: z.string(),
  generatedAt: z.string(),
});

/** Returns null when the JSON isn't a report this build knows how to render. */
export function parseReport(raw: unknown): AuditReport | null {
  const parsed = StoredReportSchema.safeParse(raw);
  return parsed.success ? (parsed.data as AuditReport) : null;
}

/** Everything a renderer needs, with the display fallbacks already applied. */
export type PublicAudit = {
  id: string;
  url: string;
  host: string;
  /** The business name, or the host when none could be confidently detected. */
  displayName: string;
  /** True when `displayName` is a real detected name rather than the host. */
  hasBusinessName: boolean;
  businessType: string;
  archetype: Archetype;
  screenshotUrl: string | null;
  indexable: boolean;
  createdAt: Date;
  completedAt: Date | null;
  report: AuditReport;
};

type AuditRow = {
  id: string;
  url: string;
  host: string;
  screenshotUrl: string | null;
  businessName: string | null;
  indexable: boolean;
  createdAt: Date;
  completedAt: Date | null;
  report: unknown;
};

export function toPublicAudit(row: AuditRow): PublicAudit | null {
  const report = parseReport(row.report);
  if (!report) return null;

  const name = row.businessName ?? report.businessName;

  return {
    id: row.id,
    url: row.url,
    host: row.host,
    // Never fabricate a company name — fall back to the host, which is a fact.
    displayName: name ?? row.host,
    hasBusinessName: Boolean(name),
    businessType: report.businessType,
    archetype: report.archetype,
    screenshotUrl: row.screenshotUrl,
    indexable: row.indexable,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    report,
  };
}
