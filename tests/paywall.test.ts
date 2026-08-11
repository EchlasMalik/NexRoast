import { describe, expect, it } from "vitest";
import { FREE_ISSUES, toPublicAudit } from "@/lib/audit/public";
import type { AuditReport, ScoredIssue } from "@/lib/audit/scoring";

/**
 * The paywall's only real job is that withheld content never leaves the
 * server. A regression here doesn't throw or fail a build — it silently
 * publishes what people paid for, so it gets tested directly.
 */

function issue(n: number): ScoredIssue {
  return {
    id: String(n),
    title: `Issue ${n}`,
    category: "conversion",
    severity: "high",
    effort: "quick",
    impact: 10 - n,
    evidence: `evidence ${n}`,
    problem: `problem ${n}`,
    whyItMatters: `why ${n}`,
    recommendation: `SECRET-RECOMMENDATION-${n}`,
    currentCopy: `current ${n}`,
    recommendedCopy: `SECRET-COPY-${n}`,
  };
}

const report: AuditReport = {
  version: 1,
  businessName: "Acme",
  businessType: "plumber",
  archetype: "local_service",
  localRelevant: true,
  summary: "A summary.",
  overallScore: 62,
  band: "solid",
  categories: [
    { key: "seo", score: 50, weight: 12, applicable: true, criteria: [] },
  ],
  strengths: ["one", "two"],
  issues: [1, 2, 3, 4, 5].map(issue),
  quickWins: ["SECRET-QUICKWIN"],
  suggestedActions: ["SECRET-ACTION-1", "SECRET-ACTION-2"],
  biggestOpportunity: "Do the thing.",
  generatedAt: "2026-01-01T00:00:00Z",
};

function row(unlockedAt: Date | null) {
  return {
    id: "a1",
    url: "https://acme.test/",
    host: "acme.test",
    screenshotUrl: null,
    businessName: "Acme",
    indexable: true,
    createdAt: new Date("2026-01-01"),
    completedAt: new Date("2026-01-01"),
    unlockedAt,
    report,
  };
}

describe("free audit", () => {
  const audit = toPublicAudit(row(null))!;

  it("shows exactly the free allowance of issues", () => {
    expect(audit.unlocked).toBe(false);
    expect(audit.report.issues).toHaveLength(FREE_ISSUES);
    expect(audit.lockedIssueCount).toBe(5 - FREE_ISSUES);
  });

  it("does not leak any withheld issue anywhere in the payload", () => {
    // Serialise the whole thing — this is what would reach the browser.
    const wire = JSON.stringify(audit);
    for (const n of [3, 4, 5]) {
      expect(wire).not.toContain(`SECRET-RECOMMENDATION-${n}`);
      expect(wire).not.toContain(`SECRET-COPY-${n}`);
      expect(wire).not.toContain(`Issue ${n}`);
    }
  });

  it("withholds the action plan, which would otherwise name locked issues", () => {
    const wire = JSON.stringify(audit);
    expect(audit.report.suggestedActions).toEqual([]);
    expect(audit.report.quickWins).toEqual([]);
    expect(wire).not.toContain("SECRET-ACTION");
    expect(wire).not.toContain("SECRET-QUICKWIN");
  });

  it("still publishes everything the free tier promises", () => {
    // The free audit has to stand on its own as an indexable, shareable page.
    expect(audit.report.overallScore).toBe(62);
    expect(audit.report.categories).toHaveLength(1);
    expect(audit.report.strengths).toEqual(["one", "two"]);
    expect(audit.report.summary).toBe("A summary.");
    expect(audit.report.biggestOpportunity).toBe("Do the thing.");
    // And the free issues keep their full detail, including the copy rewrite —
    // a teaser with the useful part removed doesn't demonstrate value.
    expect(audit.report.issues[0].recommendation).toBe(
      "SECRET-RECOMMENDATION-1",
    );
    expect(audit.report.issues[0].recommendedCopy).toBe("SECRET-COPY-1");
  });
});

describe("paid audit", () => {
  const audit = toPublicAudit(row(new Date("2026-01-02")))!;

  it("returns everything", () => {
    expect(audit.unlocked).toBe(true);
    expect(audit.lockedIssueCount).toBe(0);
    expect(audit.report.issues).toHaveLength(5);
    expect(audit.report.suggestedActions).toHaveLength(2);
    expect(audit.report.quickWins).toHaveLength(1);
  });
});

describe("an audit with fewer issues than the free allowance", () => {
  it("locks nothing and offers no upsell", () => {
    const short = { ...row(null), report: { ...report, issues: [issue(1)] } };
    const audit = toPublicAudit(short)!;

    expect(audit.report.issues).toHaveLength(1);
    expect(audit.lockedIssueCount).toBe(0);
  });
});
