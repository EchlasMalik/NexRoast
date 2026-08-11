import { z } from "zod";
import {
  type Archetype,
  ARCHETYPES,
  CATEGORY_KEYS,
} from "@/lib/audit/categories";
import type {
  AuditReport,
  CategoryResult,
  CriterionResult,
} from "@/lib/audit/scoring";

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
  /** True once paid. Drives the PDF gate and what the card renders. */
  unlocked: boolean;
  /** How many issues are withheld. 0 when unlocked or when there were none. */
  lockedIssueCount: number;
  report: PublicReport;
};

/**
 * A category as rendered. Carries the *true* criterion totals alongside the
 * possibly-truncated list, so the "4 of 9 checks passed" line stays accurate
 * even when half the checks themselves are behind the paywall.
 */
export type PublicCategory = CategoryResult & {
  criteriaTotal: number;
  criteriaPassed: number;
  /** How many checks in this category are withheld. 0 once unlocked. */
  criteriaHidden: number;
};

export type PublicReport = Omit<AuditReport, "categories"> & {
  categories: PublicCategory[];
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
  unlockedAt: Date | null;
  report: unknown;
};

/**
 * Issues shown before paying: the single biggest opportunity, in full.
 *
 * It is shown complete — problem, why it matters, the fix and the suggested
 * wording — rather than truncated, because a free tier that withholds the
 * useful half of what it does show demonstrates nothing worth paying for.
 *
 * The free audit still carries the score, all nine category breakdowns with
 * every underlying check, the summary and the strengths. Only the remaining
 * issues, the action plan and the PDF are gated.
 */
export const FREE_ISSUES = 1;

/**
 * Every other check is withheld from a free audit — roughly half per category.
 *
 * Taking alternate entries rather than the first half is deliberate: criteria
 * are stored measured-first, so a straight `slice` would show every measured
 * check and hide every judged one (or the reverse), which reads as a category
 * of one kind. Alternating keeps a representative mix of measured and judged,
 * and of passes and failures — a preview that is only good news would misprice
 * the site to its owner.
 */
function halveCriteria(criteria: CriterionResult[]): CriterionResult[] {
  return criteria.filter((_, index) => index % 2 === 0);
}

/**
 * Applies the paywall by *removing* content, not hiding it.
 *
 * Nothing withheld leaves the server, so the blurred blocks in the UI are
 * decorative and there is nothing to recover from view-source or the network
 * tab. This is the whole reason gating lives here rather than in the component.
 *
 * The headline numbers are never gated: the overall score, every category
 * score, and the true passed/total counts all stay visible, so the free audit
 * remains an honest summary rather than a number with nothing behind it.
 */
function gateReport(
  report: AuditReport,
  unlocked: boolean,
): { report: PublicReport; lockedIssueCount: number } {
  const categories: PublicCategory[] = report.categories.map((category) => {
    const criteriaTotal = category.criteria.length;
    // Counted before any truncation so the summary line stays truthful.
    const criteriaPassed = category.criteria.filter(
      (criterion) => criterion.verdict === "pass",
    ).length;

    const criteria = unlocked
      ? category.criteria
      : halveCriteria(category.criteria);

    return {
      ...category,
      criteria,
      criteriaTotal,
      criteriaPassed,
      criteriaHidden: criteriaTotal - criteria.length,
    };
  });

  if (unlocked) {
    return { report: { ...report, categories }, lockedIssueCount: 0 };
  }

  const visible = report.issues.slice(0, FREE_ISSUES);

  return {
    lockedIssueCount: report.issues.length - visible.length,
    report: {
      ...report,
      categories,
      issues: visible,
      // The action plan is a view over the full issue set, so publishing it
      // would leak the titles of everything withheld.
      suggestedActions: [],
      quickWins: [],
    },
  };
}

export function toPublicAudit(row: AuditRow): PublicAudit | null {
  const parsed = parseReport(row.report);
  if (!parsed) return null;

  const unlocked = row.unlockedAt !== null;
  const { report, lockedIssueCount } = gateReport(parsed, unlocked);
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
    unlocked,
    lockedIssueCount,
    report,
  };
}
