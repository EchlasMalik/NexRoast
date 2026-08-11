import { z } from "zod";
import { ARCHETYPES, CATEGORY_KEYS } from "@/lib/audit/categories";
import { JUDGED_CRITERIA } from "@/lib/audit/criteria";

/**
 * The schema the model must fill in.
 *
 * Two hard rules, both load-bearing:
 *
 * 1. **No `.nullable()` and no `.optional()`.** `.nullable()` compiles to
 *    `anyOf: [{...},{"type":"null"}]`, which is Gemini's weakest structured-output
 *    construct and hands the model a legitimate "null" escape hatch on every
 *    field. `.optional()` drops the key from `required`, which is a field the
 *    model can silently skip — pure variance. Absence is expressed with an
 *    explicit empty string instead, and converted to a real `null` after
 *    parsing.
 * 2. **The model never emits a number the code can compute.** No overall score,
 *    no category scores, no impact score. Those are derived in
 *    lib/audit/scoring.ts from the verdicts below, which is what makes the
 *    score traceable to named criteria instead of being a vibe.
 */

/** Registry ids contain dots; JSON keys stay boring. */
export function schemaKey(criterionId: string): string {
  return criterionId.replace(/\./g, "_");
}

const VERDICTS = ["pass", "partial", "fail"] as const;

/**
 * One object per judged criterion, keyed by criterion. A fixed-key object
 * rather than an array of `{id, verdict}` because `required` then structurally
 * guarantees every criterion is answered exactly once, with no invented ids
 * and no missing entries to reconcile — a missing verdict would silently move
 * the score.
 *
 * `evidence` is declared before `verdict` on purpose: the model states what it
 * saw before it judges, which is per-criterion reasoning for free, and gives
 * the audit page something concrete to show the user.
 */
const checkShape = Object.fromEntries(
  JUDGED_CRITERIA.map((criterion) => [
    schemaKey(criterion.id),
    z.object({
      evidence: z
        .string()
        .max(240)
        .describe(
          "What you actually saw on the page that justifies this verdict. Concrete and specific — quote the wording or name the element. If you cannot point to anything, say so and mark the verdict accordingly.",
        ),
      verdict: z.enum(VERDICTS).describe(criterion.question),
    }),
  ]),
);

const IssueSchema = z.object({
  title: z
    .string()
    .max(80)
    .describe("Short label for the problem, in plain language."),
  category: z.enum([...CATEGORY_KEYS]),
  severity: z
    .enum(["critical", "high", "medium", "low"])
    .describe(
      "How much this holds the site back. Reserve 'critical' for something that actively prevents visitors converting.",
    ),
  effort: z
    .enum(["quick", "moderate", "involved"])
    .describe(
      "Rough implementation effort. 'quick' means a copy or settings change achievable in under an hour.",
    ),
  evidence: z
    .string()
    .max(240)
    .describe(
      "The specific thing on the page this is about. Required — never raise an issue you cannot point at.",
    ),
  problem: z.string().max(400).describe("What is currently wrong. Factual."),
  whyItMatters: z
    .string()
    .max(400)
    .describe(
      "The likely effect on visitors or enquiries. Never invent revenue figures, traffic numbers or conversion percentages.",
    ),
  recommendation: z
    .string()
    .max(400)
    .describe(
      "Exactly what to change. Concrete and actionable, not 'improve your SEO'.",
    ),
  currentCopy: z
    .string()
    .max(300)
    .describe(
      "If this is a wording problem, the exact current wording. Empty string if it is not a wording problem.",
    ),
  recommendedCopy: z
    .string()
    .max(300)
    .describe(
      "If this is a wording problem, your suggested replacement, ready to paste. Empty string if it is not a wording problem.",
    ),
});

export const AuditResponseSchema = z.object({
  businessName: z
    .string()
    .max(80)
    .describe(
      "The business or site name as it presents itself. Empty string if you cannot determine it confidently — never guess from the domain.",
    ),
  businessType: z
    .string()
    .max(60)
    .describe(
      "What kind of business this is, in two or three plain words (e.g. 'emergency plumber', 'dental practice', 'B2B software').",
    ),
  archetype: z
    .enum([...ARCHETYPES])
    .describe(
      "Closest category. Drives which parts of the audit are weighted most heavily.",
    ),
  localRelevant: z
    .boolean()
    .describe(
      "True only if this business serves customers in a specific geographic area. False for software, online-only and national businesses — a false here removes local presence from scoring entirely rather than penalising it.",
    ),
  summary: z
    .string()
    .max(400)
    .describe(
      "Two or three sentences a busy owner could read and act on: the overall state of the site and the single theme running through the findings.",
    ),
  checks: z.object(checkShape),
  strengths: z
    .array(z.string().max(180))
    .min(2)
    .max(4)
    .describe(
      "What genuinely works, specific to this page. Never invented — if the page is weak, say what is least weak.",
    ),
  issues: z
    .array(IssueSchema)
    .min(3)
    .max(6)
    .describe("Ordered most important first."),
  biggestOpportunity: z
    .string()
    .max(400)
    .describe(
      "The single change that would move the needle most, and what improving it would realistically achieve.",
    ),
});

export type AuditResponse = z.infer<typeof AuditResponseSchema>;
export type AuditIssue = z.infer<typeof IssueSchema>;

export const AUDIT_JSON_SCHEMA = z.toJSONSchema(AuditResponseSchema);
