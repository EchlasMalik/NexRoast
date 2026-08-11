import { describe, expect, it } from "vitest";
import {
  CATEGORY_KEYS,
  resolveWeights,
  scoreBand,
} from "@/lib/audit/categories";
import { JUDGED_CRITERIA, MEASURED_CRITERIA } from "@/lib/audit/criteria";
import type { PageFacts } from "@/lib/audit/facts";
import { type AuditResponse, schemaKey } from "@/lib/audit/schema";
import { buildReport } from "@/lib/audit/scoring";

const NOW = new Date("2026-01-01T00:00:00Z");

function facts(over: Partial<PageFacts> = {}): PageFacts {
  return {
    finalUrl: "https://x.test/",
    isHttps: true,
    title: "Acme Plumbing | Emergency Plumbers in Leeds",
    metaDescription:
      "Emergency plumbing across Leeds, 24 hours a day, Gas Safe registered.",
    canonical: "https://x.test/",
    robotsNoindex: false,
    lang: "en",
    ogTitle: null,
    ogImage: null,
    h1Count: 1,
    h1Text: "Emergency plumbers in Leeds",
    headingCount: 8,
    headingOrderOk: true,
    wordCount: 500,
    jsonLdTypes: ["LocalBusiness"],
    hasOrganizationSchema: false,
    hasLocalBusinessSchema: true,
    sameAsCount: 2,
    internalLinkCount: 12,
    telLinkCount: 2,
    mailtoLinkCount: 1,
    hasContactLink: true,
    hasPrivacyLink: true,
    hasPostalAddress: true,
    imageCount: 10,
    imagesWithAlt: 10,
    formCount: 1,
    aboveFoldCtas: ["Call now"],
    loadTimeMs: 1500,
    domContentLoadedMs: 900,
    transferredBytes: 900_000,
    requestCount: 30,
    hasViewportMeta: true,
    mobileHorizontalOverflow: false,
    tapTargetCount: 40,
    smallTapTargetCount: 0,
    nameCandidates: { jsonLd: "Acme Plumbing", ogSiteName: null, title: null },
    ...over,
  };
}

function response(
  verdict: "pass" | "partial" | "fail",
  over: Partial<AuditResponse> = {},
): AuditResponse {
  return {
    businessName: "Acme Plumbing",
    businessType: "emergency plumber",
    archetype: "local_service",
    localRelevant: true,
    summary: "s".repeat(120),
    checks: Object.fromEntries(
      JUDGED_CRITERIA.map((c) => [
        schemaKey(c.id),
        { evidence: "seen", verdict },
      ]),
    ) as AuditResponse["checks"],
    strengths: ["a", "b"],
    issues: [
      {
        title: "T1",
        category: "conversion",
        severity: "critical",
        effort: "quick",
        evidence: "e",
        problem: "p",
        whyItMatters: "w",
        recommendation: "r",
        currentCopy: "old wording",
        recommendedCopy: "new wording",
      },
      {
        title: "T2",
        category: "seo",
        severity: "medium",
        effort: "moderate",
        evidence: "e",
        problem: "p",
        whyItMatters: "w",
        recommendation: "r",
        currentCopy: "",
        recommendedCopy: "",
      },
      {
        title: "T3",
        category: "trust",
        severity: "low",
        effort: "involved",
        evidence: "e",
        problem: "p",
        whyItMatters: "w",
        recommendation: "r",
        currentCopy: "",
        recommendedCopy: "",
      },
    ],
    biggestOpportunity: "o",
    ...over,
  };
}

describe("buildReport", () => {
  it("spans the full range", () => {
    const best = buildReport(response("pass"), facts(), NOW);
    const worst = buildReport(
      response("fail"),
      facts({
        isHttps: false,
        title: "",
        metaDescription: null,
        canonical: null,
        robotsNoindex: true,
        lang: null,
        h1Count: 0,
        h1Text: null,
        headingCount: 0,
        headingOrderOk: false,
        wordCount: 40,
        jsonLdTypes: [],
        hasLocalBusinessSchema: false,
        internalLinkCount: 0,
        telLinkCount: 0,
        mailtoLinkCount: 0,
        hasContactLink: false,
        hasPrivacyLink: false,
        hasPostalAddress: false,
        imagesWithAlt: 0,
        formCount: 0,
        loadTimeMs: 9000,
        domContentLoadedMs: 7000,
        transferredBytes: 9_000_000,
        requestCount: 200,
        hasViewportMeta: false,
        mobileHorizontalOverflow: true,
        smallTapTargetCount: 40,
      }),
      NOW,
    );

    expect(best.overallScore).toBe(100);
    expect(worst.overallScore).toBe(0);
    expect(best.band).toBe("strong");
    expect(worst.band).toBe("weak");
  });

  it("never emits a score outside 0-100", () => {
    for (const verdict of ["pass", "partial", "fail"] as const) {
      const report = buildReport(response(verdict), facts(), NOW);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      for (const category of report.categories) {
        expect(category.score).toBeGreaterThanOrEqual(0);
        expect(category.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("drops local presence entirely for a business with no local footprint", () => {
    const report = buildReport(
      response("pass", { archetype: "saas", localRelevant: false }),
      facts({
        hasLocalBusinessSchema: false,
        telLinkCount: 0,
        hasPostalAddress: false,
      }),
      NOW,
    );

    const local = report.categories.find((c) => c.key === "localSeo")!;
    expect(local.applicable).toBe(false);
    expect(local.weight).toBe(0);
    // Crucially, the missing local signals must not drag the overall score down.
    expect(report.overallScore).toBeGreaterThan(90);
  });

  it("derives quick wins and the action plan from the issues, not the model", () => {
    const report = buildReport(response("pass"), facts(), NOW);
    expect(report.quickWins).toEqual(
      report.issues
        .filter((i) => i.effort === "quick")
        .map((i) => i.recommendation),
    );
    expect(report.suggestedActions.length).toBeLessThanOrEqual(5);
  });

  it("orders issues by computed impact, highest first", () => {
    const report = buildReport(response("partial"), facts(), NOW);
    const impacts = report.issues.map((i) => i.impact);
    expect([...impacts].sort((a, b) => b - a)).toEqual(impacts);
    expect(report.issues[0].severity).toBe("critical");
  });

  it("converts empty-string sentinels to null", () => {
    const report = buildReport(response("pass"), facts(), NOW);
    const withCopy = report.issues.find((i) => i.title === "T1")!;
    const withoutCopy = report.issues.find((i) => i.title === "T2")!;

    expect(withCopy.currentCopy).toBe("old wording");
    expect(withoutCopy.currentCopy).toBeNull();
    expect(withoutCopy.recommendedCopy).toBeNull();
  });

  it("returns null for a business name the model could not determine", () => {
    const report = buildReport(
      response("pass", { businessName: "  " }),
      facts(),
      NOW,
    );
    expect(report.businessName).toBeNull();
  });
});

describe("resolveWeights", () => {
  it("always sums to 100", () => {
    for (const archetype of [
      "local_service",
      "saas",
      "ecommerce",
      "other",
    ] as const) {
      const weights = resolveWeights(archetype);
      const total = CATEGORY_KEYS.reduce((sum, key) => sum + weights[key], 0);
      expect(total).toBeCloseTo(100, 6);
    }
  });

  it("redistributes a dropped category rather than losing its weight", () => {
    const weights = resolveWeights("saas", ["localSeo"]);
    expect(weights.localSeo).toBe(0);
    const total = CATEGORY_KEYS.reduce((sum, key) => sum + weights[key], 0);
    expect(total).toBeCloseTo(100, 6);
  });
});

describe("scoreBand", () => {
  it("maps boundaries as documented", () => {
    expect(scoreBand(100)).toBe("strong");
    expect(scoreBand(80)).toBe("strong");
    expect(scoreBand(79)).toBe("solid");
    expect(scoreBand(60)).toBe("solid");
    expect(scoreBand(59)).toBe("mixed");
    expect(scoreBand(40)).toBe("mixed");
    expect(scoreBand(39)).toBe("weak");
    expect(scoreBand(0)).toBe("weak");
  });
});

describe("criterion registry", () => {
  it("has no duplicate ids", () => {
    const ids = [...MEASURED_CRITERIA, ...JUDGED_CRITERIA].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every category with at least one criterion", () => {
    const covered = new Set(
      [...MEASURED_CRITERIA, ...JUDGED_CRITERIA].map((c) => c.category),
    );
    for (const key of CATEGORY_KEYS) expect(covered.has(key)).toBe(true);
  });
});
