import { describe, expect, it } from "vitest";
import { JUDGED_CRITERIA } from "@/lib/audit/criteria";
import { checkAuditSafety } from "@/lib/audit/moderation";
import {
  AUDIT_JSON_SCHEMA,
  AuditResponseSchema,
  type AuditResponse,
  schemaKey,
} from "@/lib/audit/schema";
import { assessReport, normaliseHost } from "@/lib/audit/visibility";
import type { AuditReport } from "@/lib/audit/scoring";

describe("the Gemini-facing JSON schema", () => {
  const json = JSON.stringify(AUDIT_JSON_SCHEMA);

  it("contains no anyOf", () => {
    // `.nullable()` compiles to anyOf, which is the weakest construct in
    // Gemini's structured output and gives the model a null escape hatch on
    // every field. A regression here degrades output quality silently.
    expect(json).not.toContain("anyOf");
  });

  it("contains no $ref or $defs", () => {
    expect(json).not.toContain("$ref");
    expect(json).not.toContain("$defs");
  });

  it("requires every field, so the model cannot skip one", () => {
    const root = AUDIT_JSON_SCHEMA as unknown as {
      required?: string[];
      properties: Record<string, unknown>;
    };
    expect(new Set(root.required ?? [])).toEqual(
      new Set(Object.keys(root.properties)),
    );
  });

  it("asks exactly one question per judged criterion", () => {
    const checks = (
      AUDIT_JSON_SCHEMA as unknown as {
        properties: { checks: { properties: Record<string, unknown> } };
      }
    ).properties.checks.properties;

    expect(Object.keys(checks).length).toBe(JUDGED_CRITERIA.length);
    for (const criterion of JUDGED_CRITERIA) {
      expect(checks[schemaKey(criterion.id)]).toBeDefined();
    }
  });

  it("puts each criterion's question where the model answers it", () => {
    const checks = (
      AUDIT_JSON_SCHEMA as unknown as {
        properties: {
          checks: {
            properties: Record<
              string,
              { properties: { verdict: { description?: string } } }
            >;
          };
        };
      }
    ).properties.checks.properties;

    for (const criterion of JUDGED_CRITERIA) {
      expect(
        checks[schemaKey(criterion.id)].properties.verdict.description,
      ).toBe(criterion.question);
    }
  });

  it("rejects a response missing a judged criterion", () => {
    const partial = {
      businessName: "X",
      businessType: "y",
      archetype: "other",
      localRelevant: false,
      summary: "s",
      checks: {},
      strengths: ["a", "b"],
      issues: [],
      biggestOpportunity: "o",
    };
    expect(AuditResponseSchema.safeParse(partial).success).toBe(false);
  });
});

function auditResponse(over: Partial<AuditResponse> = {}): AuditResponse {
  return {
    businessName: "Acme",
    businessType: "plumber",
    archetype: "local_service",
    localRelevant: true,
    summary: "fine",
    strengths: ["a", "b"],
    checks: Object.fromEntries(
      JUDGED_CRITERIA.map((c) => [
        schemaKey(c.id),
        { evidence: "e", verdict: "pass" as const },
      ]),
    ) as AuditResponse["checks"],
    issues: [],
    biggestOpportunity: "o",
    ...over,
  };
}

describe("moderation", () => {
  it("passes an ordinary audit", () => {
    expect(checkAuditSafety(auditResponse()).safe).toBe(true);
  });

  it("blocks invented revenue figures", () => {
    // The single most damaging thing this product could publish about a real
    // named business is a number it has no basis for.
    const result = checkAuditSafety(
      auditResponse({
        summary: "This is costing you £4,000 a month in lost work.",
      }),
    );
    expect(result.safe).toBe(false);
  });

  it("blocks invented percentages", () => {
    expect(
      checkAuditSafety(
        auditResponse({
          biggestOpportunity: "You are losing 40% of visitors here.",
        }),
      ).safe,
    ).toBe(false);
  });

  it("blocks claims about the business rather than the website", () => {
    expect(
      checkAuditSafety(
        auditResponse({ summary: "The company seems unprofessional." }),
      ).safe,
    ).toBe(false);
    expect(
      checkAuditSafety(auditResponse({ summary: "This looks like a scam." }))
        .safe,
    ).toBe(false);
  });

  it("allows legitimate criticism of the page itself", () => {
    expect(
      checkAuditSafety(
        auditResponse({
          summary:
            "The homepage does not say what the business does, and the phone number is hard to find.",
        }),
      ).safe,
    ).toBe(true);
  });
});

describe("visibility", () => {
  const report = (over: Partial<AuditReport> = {}): AuditReport =>
    ({
      version: 1,
      businessName: "Acme",
      businessType: "plumber",
      archetype: "local_service",
      localRelevant: true,
      summary:
        "A summary long enough to clear the thin-content bar that keeps flimsy audits out of the index.",
      overallScore: 60,
      band: "solid",
      categories: [
        { key: "seo", score: 50, weight: 10, applicable: true, criteria: [] },
      ],
      strengths: ["a", "b"],
      issues: [
        {
          id: "1",
          title: "a",
          category: "seo",
          severity: "high",
          effort: "quick",
          impact: 5,
          evidence: "e",
          problem: "p",
          whyItMatters: "w",
          recommendation: "r",
          currentCopy: null,
          recommendedCopy: null,
        },
        {
          id: "2",
          title: "b",
          category: "seo",
          severity: "high",
          effort: "quick",
          impact: 5,
          evidence: "e",
          problem: "p",
          whyItMatters: "w",
          recommendation: "r",
          currentCopy: null,
          recommendedCopy: null,
        },
        {
          id: "3",
          title: "c",
          category: "seo",
          severity: "high",
          effort: "quick",
          impact: 5,
          evidence: "e",
          problem: "p",
          whyItMatters: "w",
          recommendation: "r",
          currentCopy: null,
          recommendedCopy: null,
        },
      ],
      quickWins: [],
      suggestedActions: [],
      biggestOpportunity: "o",
      generatedAt: "2026-01-01T00:00:00Z",
      ...over,
    }) as AuditReport;

  it("indexes a substantial audit", () => {
    expect(assessReport(report()).indexable).toBe(true);
  });

  it("refuses to index thin audits", () => {
    expect(assessReport(report({ issues: [] })).indexable).toBe(false);
    expect(assessReport(report({ strengths: [] })).indexable).toBe(false);
    expect(assessReport(report({ summary: "Too short." })).indexable).toBe(
      false,
    );
  });

  it("refuses to index an audit with nothing actually scored", () => {
    expect(
      assessReport(
        report({
          categories: [
            {
              key: "seo",
              score: 0,
              weight: 0,
              applicable: false,
              criteria: [],
            },
          ],
        }),
      ).indexable,
    ).toBe(false);
  });
});

describe("normaliseHost", () => {
  it("groups www and apex as one site", () => {
    expect(normaliseHost("https://www.Example.com/path")).toBe("example.com");
    expect(normaliseHost("https://example.com/")).toBe("example.com");
  });
});
