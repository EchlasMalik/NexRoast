import { Filter } from "bad-words";
import type { AuditResponse } from "@/lib/audit/schema";

const filter = new Filter();

/**
 * Phrases that make a claim about the *business* rather than the website.
 *
 * The risk profile changed with the product: these audits name real companies
 * on public, indexable pages, so the failure mode is no longer "a rude joke
 * got through" but "we published something defamatory about a named
 * business". The prompt forbids this, but a prompt is guidance and this is the
 * backstop — a match regenerates the audit rather than sanitising it in place.
 */
const PERSONAL_CLAIM_PATTERNS: RegExp[] = [
  /\b(they|the (?:owner|company|business|team|staff)) (?:are|is|seems?|appears?) (?:unprofessional|incompetent|lazy|clueless|dishonest|a scam)/i,
  /\b(?:scam|fraudulent|dodgy|shady|cowboy|untrustworthy)\b/i,
  /\bdoesn'?t know what (?:they'?re|he'?s|she'?s) doing\b/i,
  /\b(?:probably|clearly|obviously) (?:going out of business|failing|broke)\b/i,
];

/**
 * Numeric claims the model has no basis for. The prompt bans these explicitly;
 * this catches the cases where it does it anyway, because a fabricated
 * "costing you £4,000 a month" is the single most damaging thing this product
 * could publish.
 */
const INVENTED_METRIC_PATTERNS: RegExp[] = [
  /[£$€]\s?\d[\d,.]*\s*(?:k|m|per|a|each)?\s*(?:month|year|week|day)/i,
  /\b\d{1,3}\s?%\s*(?:of|more|fewer|less|increase|decrease|drop|uplift)\b/i,
  /\b(?:losing|costing|missing out on)\s+[£$€]?\s?\d/i,
];

function collectText(audit: AuditResponse): string {
  return [
    audit.summary,
    audit.biggestOpportunity,
    ...audit.strengths,
    ...audit.issues.flatMap((issue) => [
      issue.title,
      issue.problem,
      issue.whyItMatters,
      issue.recommendation,
      issue.recommendedCopy,
    ]),
    ...Object.values(audit.checks).map((check) => check.evidence),
  ].join("\n");
}

export type SafetyResult =
  { safe: true } | { safe: false; reason: string; match: string };

export function checkAuditSafety(audit: AuditResponse): SafetyResult {
  const text = collectText(audit);

  if (filter.isProfane(text)) {
    return { safe: false, reason: "profanity", match: "" };
  }

  for (const pattern of PERSONAL_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        safe: false,
        reason: "claim about the business",
        match: match[0],
      };
    }
  }

  for (const pattern of INVENTED_METRIC_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { safe: false, reason: "invented metric", match: match[0] };
    }
  }

  return { safe: true };
}

export function isAuditSafe(audit: AuditResponse): boolean {
  const result = checkAuditSafety(audit);
  if (!result.safe) {
    console.warn(
      `Audit rejected (${result.reason})${result.match ? `: "${result.match}"` : ""}`,
    );
  }
  return result.safe;
}
