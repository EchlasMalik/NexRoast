import {
  type Archetype,
  type CategoryKey,
  CATEGORY_KEYS,
  resolveWeights,
  type ScoreBand,
  scoreBand,
} from "@/lib/audit/categories";
import {
  type Criterion,
  CRITERIA,
  JUDGED_CRITERIA,
  MEASURED_CRITERIA,
  type Verdict,
  VERDICT_POINTS,
} from "@/lib/audit/criteria";
import type { PageFacts } from "@/lib/audit/facts";
import { type AuditResponse, schemaKey } from "@/lib/audit/schema";

export type CriterionResult = {
  id: string;
  label: string;
  category: CategoryKey;
  source: Criterion["source"];
  verdict: Verdict;
  /** Present for judged criteria — what the model said it saw. */
  evidence: string | null;
};

export type CategoryResult = {
  key: CategoryKey;
  score: number;
  /** Share of the overall score this category carried, as a percentage. */
  weight: number;
  applicable: boolean;
  criteria: CriterionResult[];
};

export type ScoredIssue = {
  id: string;
  title: string;
  category: CategoryKey;
  severity: "critical" | "high" | "medium" | "low";
  effort: "quick" | "moderate" | "involved";
  /** Computed, never model-authored. 1–10. */
  impact: number;
  evidence: string;
  problem: string;
  whyItMatters: string;
  recommendation: string;
  currentCopy: string | null;
  recommendedCopy: string | null;
};

export type AuditReport = {
  version: 1;
  businessName: string | null;
  businessType: string;
  archetype: Archetype;
  localRelevant: boolean;
  summary: string;
  overallScore: number;
  band: ScoreBand;
  categories: CategoryResult[];
  strengths: string[];
  issues: ScoredIssue[];
  quickWins: string[];
  suggestedActions: string[];
  biggestOpportunity: string;
  generatedAt: string;
};

const SEVERITY_WEIGHT = {
  critical: 1,
  high: 0.8,
  medium: 0.55,
  low: 0.3,
} as const;

/** Empty string is the schema's stand-in for "not applicable" (see schema.ts). */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Turns the model's verdicts plus the measured facts into the final report.
 *
 * The whole point: no number here comes from the model. Category scores are a
 * weighted mean of criterion verdicts, the overall score is a weighted mean of
 * category scores, and issue impact is derived from severity, category weight
 * and how badly that category actually scored. Every point is traceable to a
 * named criterion, which is what the audit page shows the user.
 */
export function buildReport(
  response: AuditResponse,
  facts: PageFacts,
  now: Date,
): AuditReport {
  // 1. Resolve every criterion to a verdict, or drop it as not applicable.
  const results = new Map<
    CategoryKey,
    { result: CriterionResult; weight: number }[]
  >();
  for (const key of CATEGORY_KEYS) results.set(key, []);

  for (const criterion of MEASURED_CRITERIA) {
    const verdict = criterion.evaluate(facts);
    if (verdict === null) continue;
    results.get(criterion.category)!.push({
      weight: criterion.weight,
      result: {
        id: criterion.id,
        label: criterion.label,
        category: criterion.category,
        source: "measured",
        verdict,
        evidence: null,
      },
    });
  }

  for (const criterion of JUDGED_CRITERIA) {
    const check = response.checks[schemaKey(criterion.id)];
    if (!check) continue;
    results.get(criterion.category)!.push({
      weight: criterion.weight,
      result: {
        id: criterion.id,
        label: criterion.label,
        category: criterion.category,
        source: "judged",
        verdict: check.verdict,
        evidence: orNull(check.evidence),
      },
    });
  }

  // 2. A category with no applicable criteria — or local presence on a
  //    business that has no local footprint — is dropped, not scored zero.
  //    Scoring it would be the exact arbitrariness this design removes.
  const dropped: CategoryKey[] = [];
  for (const key of CATEGORY_KEYS) {
    const entries = results.get(key)!;
    if (entries.length === 0) dropped.push(key);
    else if (key === "localSeo" && !response.localRelevant) dropped.push(key);
  }

  const weights = resolveWeights(response.archetype, dropped);

  // 3. Category scores: weighted mean of criterion verdicts.
  const categories: CategoryResult[] = CATEGORY_KEYS.map((key) => {
    const entries = results.get(key)!;
    const applicable = !dropped.includes(key);
    const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
    const earned = entries.reduce(
      (sum, e) => sum + e.weight * VERDICT_POINTS[e.result.verdict],
      0,
    );

    return {
      key,
      score: totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100),
      weight: Math.round(weights[key] * 10) / 10,
      applicable,
      criteria: entries.map((e) => e.result),
    };
  });

  // 4. Overall: weighted mean across applicable categories only.
  const scored = categories.filter((c) => c.applicable && weights[c.key] > 0);
  const weightSum = scored.reduce((sum, c) => sum + weights[c.key], 0);
  const overallScore =
    weightSum === 0
      ? 0
      : clamp(
          Math.round(
            scored.reduce((sum, c) => sum + c.score * weights[c.key], 0) /
              weightSum,
          ),
          0,
          100,
        );

  // 5. Issue impact: severity leads, modulated by how much that category
  //    matters for this archetype and how far short it actually fell.
  const maxWeight = Math.max(...CATEGORY_KEYS.map((k) => weights[k]), 1);
  const scoreByCategory = new Map(categories.map((c) => [c.key, c.score]));

  const issues: ScoredIssue[] = response.issues.map((issue, index) => {
    const severity = SEVERITY_WEIGHT[issue.severity];
    const categoryWeight = weights[issue.category] / maxWeight;
    const deficit = (100 - (scoreByCategory.get(issue.category) ?? 50)) / 100;

    return {
      id: `${index + 1}`,
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
      effort: issue.effort,
      // Severity leads. The deficit and category-weight terms only modulate
      // it, and both keep a high floor so a genuinely critical issue can never
      // be scored as mid-pack just because its category otherwise did well.
      impact: clamp(
        Math.round(
          10 * severity * (0.7 + 0.3 * deficit) * (0.7 + 0.3 * categoryWeight),
        ),
        1,
        10,
      ),
      evidence: issue.evidence,
      problem: issue.problem,
      whyItMatters: issue.whyItMatters,
      recommendation: issue.recommendation,
      currentCopy: orNull(issue.currentCopy),
      recommendedCopy: orNull(issue.recommendedCopy),
    };
  });

  issues.sort((a, b) => b.impact - a.impact);

  // 6. Quick wins and the action plan are views over the issue set, not
  //    separate model output that could contradict it.
  const quickWins = issues
    .filter((issue) => issue.effort === "quick")
    .slice(0, 4)
    .map((issue) => issue.recommendation);

  const suggestedActions = issues
    .slice(0, 5)
    .map((issue) => issue.recommendation);

  return {
    version: 1,
    businessName: orNull(response.businessName),
    businessType: response.businessType,
    archetype: response.archetype,
    localRelevant: response.localRelevant,
    summary: response.summary,
    overallScore,
    band: scoreBand(overallScore),
    categories,
    strengths: response.strengths,
    issues,
    quickWins,
    suggestedActions,
    biggestOpportunity: response.biggestOpportunity,
    generatedAt: now.toISOString(),
  };
}

/** Total criteria a report could have covered — shown as scoring transparency. */
export const TOTAL_CRITERIA = CRITERIA.length;
