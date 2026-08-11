// Loaded explicitly so the seed works when run directly with tsx, not only
// through `prisma db seed` (which loads prisma.config.ts, and with it dotenv).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildReport } from "../lib/audit/scoring";
import type { PageFacts } from "../lib/audit/facts";
import type { AuditResponse } from "../lib/audit/schema";
import { JUDGED_CRITERIA } from "../lib/audit/criteria";
import { schemaKey } from "../lib/audit/schema";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Seed data goes through the real `buildReport` rather than hand-writing a
 * stored report. The previous seed hard-coded the critique JSON, which meant
 * it silently drifted out of sync with the schema and ended up exercising a
 * legacy code path that production never used.
 */
const FACTS: PageFacts = {
  finalUrl: "https://example.com/",
  isHttps: true,
  title: "Example Plumbing | Emergency Plumbers in Manchester",
  metaDescription:
    "Emergency plumbing across Greater Manchester, available 24 hours a day. Gas Safe registered, no call-out fee.",
  canonical: "https://example.com/",
  robotsNoindex: false,
  lang: "en-GB",
  ogTitle: "Example Plumbing",
  ogImage: null,
  h1Count: 1,
  h1Text: "Emergency plumbers in Manchester",
  headingCount: 9,
  headingOrderOk: true,
  wordCount: 480,
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
  imageCount: 8,
  imagesWithAlt: 7,
  formCount: 1,
  aboveFoldCtas: ["Call now", "Request a quote"],
  loadTimeMs: 2100,
  domContentLoadedMs: 1400,
  transferredBytes: 1_400_000,
  requestCount: 42,
  hasViewportMeta: true,
  mobileHorizontalOverflow: false,
  tapTargetCount: 30,
  smallTapTargetCount: 1,
  nameCandidates: {
    jsonLd: "Example Plumbing",
    ogSiteName: "Example Plumbing",
    title: "Example Plumbing | Emergency Plumbers in Manchester",
  },
};

/** Every judged criterion answered, so the report is structurally complete. */
const checks = Object.fromEntries(
  JUDGED_CRITERIA.map((criterion, index) => [
    schemaKey(criterion.id),
    {
      evidence: "Seed data — not a real observation.",
      verdict: (index % 3 === 0
        ? "partial"
        : index % 5 === 0
          ? "fail"
          : "pass") as "pass" | "partial" | "fail",
    },
  ]),
) as AuditResponse["checks"];

const RESPONSE: AuditResponse = {
  businessName: "Example Plumbing",
  businessType: "emergency plumber",
  archetype: "local_service",
  localRelevant: true,
  summary:
    "The site covers the basics well and loads quickly, but the homepage buries the one thing an emergency customer needs — the phone number — below content that can wait.",
  checks,
  strengths: [
    "The headline names both the service and the city, which is exactly what someone searching in a panic needs to see.",
    "Gas Safe registration is visible above the fold and carries real weight for this trade.",
    "The page loads in about two seconds, comfortably ahead of most local trade sites.",
  ],
  issues: [
    {
      title: "Phone number is not the primary action",
      category: "conversion",
      severity: "high",
      effort: "quick",
      evidence:
        "Two 'Call now' links exist but neither is the dominant element above the fold.",
      problem:
        "The most likely action for an emergency customer competes visually with a quote form.",
      whyItMatters:
        "Someone with a burst pipe wants to call, not fill in a form. Making them look for the number adds friction at the worst possible moment.",
      recommendation:
        "Promote the phone number to a large, tappable button in the header, visible without scrolling on mobile.",
      currentCopy: "Request a quote",
      recommendedCopy: "Call now — 24/7 emergency line",
    },
    {
      title: "No reviews or testimonials on the homepage",
      category: "trust",
      severity: "high",
      effort: "moderate",
      evidence:
        "No testimonial, rating or review content is visible on the homepage.",
      problem: "There is no third-party evidence that the work is good.",
      whyItMatters:
        "Trade customers routinely compare two or three local firms. The one showing reviews has an advantage before anything else is read.",
      recommendation:
        "Add three short customer reviews with first name and area near the top of the page.",
      currentCopy: "",
      recommendedCopy: "",
    },
    {
      title: "Service area is implied rather than stated",
      category: "localSeo",
      severity: "medium",
      effort: "quick",
      evidence:
        "The headline names Manchester, but no towns or coverage radius are listed.",
      problem:
        "Customers outside the city centre cannot tell whether they are covered.",
      whyItMatters:
        "Someone in an outlying town who cannot confirm coverage will usually call a firm that lists their area explicitly.",
      recommendation:
        "Add a short list of covered towns, and mention the coverage radius in the hero.",
      currentCopy: "Emergency plumbers in Manchester",
      recommendedCopy:
        "Emergency plumbers in Manchester, Salford, Stockport and across Greater Manchester",
    },
  ],
  biggestOpportunity:
    "Make the phone number the single most obvious thing on the page. For an emergency trade, every other improvement is worth less than removing a step between panic and a ringing phone.",
};

async function main() {
  await prisma.event.deleteMany();
  await prisma.audit.deleteMany();

  const report = buildReport(RESPONSE, FACTS, new Date("2026-08-04T09:00:00Z"));

  await prisma.audit.create({
    data: {
      url: "https://example.com/",
      host: "example.com",
      status: "complete",
      // Points at the r2.dev wildcard allowed in next.config.ts so next/image
      // accepts the domain in dev; the file itself doesn't exist, so this
      // renders as a broken image until real R2 data replaces it.
      screenshotUrl: "https://pub-seed-demo.r2.dev/audits/example.png",
      businessName: report.businessName,
      businessType: report.businessType,
      overallScore: report.overallScore,
      indexable: true,
      report,
      createdAt: new Date("2026-08-04T09:00:00Z"),
      completedAt: new Date("2026-08-04T09:00:30Z"),
    },
  });

  await prisma.audit.create({
    data: {
      url: "https://another-example.com/",
      host: "another-example.com",
      status: "pending",
      createdAt: new Date("2026-08-04T10:30:00Z"),
    },
  });

  console.log(`Seeded 2 audits (one complete, score ${report.overallScore}).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
