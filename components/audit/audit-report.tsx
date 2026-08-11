import Image from "next/image";
import { CopyButton } from "@/components/audit/copy-button";
import { LockedIssues } from "@/components/audit/paywall";
import {
  bandFor,
  CATEGORIES,
  CATEGORY_METER,
  type CategoryKey,
} from "@/lib/audit/categories";
import type { PublicAudit } from "@/lib/audit/public";
import type { CategoryResult, ScoredIssue } from "@/lib/audit/scoring";

/**
 * The audit report — a white document card on the dark page.
 *
 * Entirely server-rendered apart from the copy buttons. That is deliberate:
 * these pages are meant to be indexed, so the text has to be in the HTML
 * rather than assembled by client JS after a fetch.
 */

function ScoreHero({ audit }: { audit: PublicAudit }) {
  const { report } = audit;
  const band = bandFor(report.overallScore);

  return (
    <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.18em] text-neutral-500 uppercase">
          Website audit
        </p>
        <h1 className="font-display mt-1 truncate text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {audit.displayName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {audit.host}
          {report.businessType ? ` · ${report.businessType}` : ""}
        </p>
      </div>

      {/* Hero number, not a chart — a single headline value reads faster as a
          number than as any plot of one datum. */}
      <div className="flex shrink-0 items-center gap-4">
        <div
          className={`flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 ${band.ring}`}
        >
          <span className="font-display text-3xl leading-none font-bold text-neutral-900">
            {report.overallScore}
          </span>
          <span className="mt-0.5 text-[11px] font-semibold text-neutral-500">
            / 100
          </span>
        </div>
        <div className="sm:text-right">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${band.chipBg}`}
          >
            {band.label}
          </span>
          <p className="mt-1.5 max-w-[10rem] text-xs text-neutral-500">
            Scored across {report.categories.filter((c) => c.applicable).length}{" "}
            areas
          </p>
        </div>
      </div>
    </div>
  );
}

function CategoryMeter({ category }: { category: CategoryResult }) {
  const meta = CATEGORIES[category.key];
  const passed = category.criteria.filter((c) => c.verdict === "pass").length;

  return (
    <details className="group border-b border-neutral-200 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="w-28 shrink-0 truncate text-sm font-semibold text-neutral-700 sm:w-36">
          {meta.label}
        </span>

        {/* Magnitude is length in one fixed hue. Nine bars sit in a column
            here; colouring each by its own score band would place green,
            amber and red adjacent, which is unreadable for red-green colour
            blindness. The number beside it carries the exact value. */}
        <span
          className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
          style={{ backgroundColor: CATEGORY_METER.track }}
          role="img"
          aria-label={`${meta.label}: ${category.score} out of 100`}
        >
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.max(2, category.score)}%`,
              backgroundColor: CATEGORY_METER.fill,
            }}
          />
        </span>

        <span className="w-10 shrink-0 text-right text-sm font-bold text-neutral-900 tabular-nums">
          {category.score}
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </summary>

      {/* The breakdown is disclosed rather than hovered: a tooltip would need
          client JS on a page built to render without it, and this works on
          touch, in print and for screen readers. */}
      <div className="pb-4 pl-0 sm:pl-36">
        <p className="mb-3 text-xs text-neutral-500">
          {meta.blurb} {passed} of {category.criteria.length} checks passed.
        </p>
        <ul className="flex flex-col gap-1.5">
          {category.criteria.map((criterion) => (
            <li key={criterion.id} className="flex items-start gap-2 text-xs">
              <span
                aria-hidden
                className={
                  criterion.verdict === "pass"
                    ? "text-[#0f7a38]"
                    : criterion.verdict === "partial"
                      ? "text-[#9a6b00]"
                      : "text-[#c0202a]"
                }
              >
                {criterion.verdict === "pass"
                  ? "✓"
                  : criterion.verdict === "partial"
                    ? "~"
                    : "✕"}
              </span>
              <span className="text-neutral-600">
                {criterion.label}
                <span className="sr-only"> — {criterion.verdict}</span>
                {criterion.evidence && (
                  <span className="text-neutral-400">
                    {" "}
                    — {criterion.evidence}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

const SEVERITY_LABEL = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;

function IssueCard({
  issue,
  index,
  auditId,
}: {
  issue: ScoredIssue;
  index: number;
  auditId: string;
}) {
  return (
    <li className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="font-display mt-0.5 text-sm font-bold text-neutral-400 tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h4 className="font-display text-base font-bold tracking-tight text-neutral-900 sm:text-lg">
              {issue.title}
            </h4>
            <p className="mt-0.5 text-xs text-neutral-500">
              {CATEGORIES[issue.category as CategoryKey].label} ·{" "}
              {SEVERITY_LABEL[issue.severity]} ·{" "}
              {issue.effort === "quick"
                ? "Quick fix"
                : issue.effort === "moderate"
                  ? "Moderate"
                  : "Larger job"}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
          {issue.impact}/10
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-[15px] leading-relaxed text-neutral-700">
        <p>{issue.problem}</p>
        <p className="text-neutral-600">{issue.whyItMatters}</p>

        <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4">
          <p className="text-[11px] font-bold tracking-[0.14em] text-orange-700 uppercase">
            What to do
          </p>
          <p className="mt-1.5 text-[15px] text-neutral-800">
            {issue.recommendation}
          </p>
        </div>

        {issue.recommendedCopy && (
          <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
            {issue.currentCopy && (
              <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-neutral-400 uppercase">
                  Current
                </p>
                <p className="mt-1 text-sm text-neutral-500 line-through decoration-neutral-300">
                  {issue.currentCopy}
                </p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] text-neutral-400 uppercase">
                Suggested
              </p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="font-serif text-base text-neutral-900">
                  {issue.recommendedCopy}
                </p>
                <CopyButton value={issue.recommendedCopy} auditId={auditId} />
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-neutral-400">
          Seen on the page: {issue.evidence}
        </p>
      </div>
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h3 className="font-display text-[11px] font-bold tracking-[0.18em] text-neutral-500 uppercase">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AuditReport({ audit }: { audit: PublicAudit }) {
  const { report } = audit;
  const applicable = report.categories.filter((c) => c.applicable);

  return (
    <article className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/50">
      {audit.screenshotUrl && (
        <div className="relative bg-neutral-950">
          <Image
            src={audit.screenshotUrl}
            alt={`Screenshot of ${audit.host}`}
            width={1440}
            height={900}
            className="max-h-64 w-full object-cover object-top"
            priority
          />
        </div>
      )}

      <div className="p-6 sm:p-9">
        <ScoreHero audit={audit} />

        <p className="mt-6 border-l-2 border-orange-300 pl-4 font-serif text-lg leading-relaxed text-neutral-700">
          {report.summary}
        </p>

        <Section title="Scores by area">
          <div className="rounded-2xl border border-neutral-200 px-4">
            {applicable.map((category) => (
              <CategoryMeter key={category.key} category={category} />
            ))}
          </div>
          {applicable.length < report.categories.length && (
            <p className="mt-2 text-xs text-neutral-400">
              Local presence was not scored — this business does not appear to
              serve a specific geographic area.
            </p>
          )}
        </Section>

        <Section
          title={
            report.issues.length === 1
              ? "Biggest opportunity"
              : "Biggest opportunities"
          }
        >
          <ul className="flex flex-col gap-4">
            {report.issues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                auditId={audit.id}
              />
            ))}
            {audit.lockedIssueCount > 0 && (
              <LockedIssues auditId={audit.id} count={audit.lockedIssueCount} />
            )}
          </ul>
        </Section>

        {report.strengths.length > 0 && (
          <Section title="What's already working">
            <ul className="flex flex-col gap-2.5">
              {report.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 text-[#0f7a38]">
                    ✓
                  </span>
                  <span className="text-[15px] leading-relaxed text-neutral-700">
                    {strength}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Where to start">
          <div className="rounded-2xl border border-neutral-900/10 bg-neutral-900 p-5 sm:p-6">
            <p className="font-serif text-lg leading-relaxed text-white">
              {report.biggestOpportunity}
            </p>
          </div>

          {!audit.unlocked && (
            <p className="mt-4 text-sm text-neutral-500">
              The ordered action plan is part of the full audit — it lists every
              issue by priority, including the {audit.lockedIssueCount} not
              shown above.
            </p>
          )}

          {report.suggestedActions.length > 0 && (
            <ol className="mt-4 flex flex-col gap-2.5">
              {report.suggestedActions.map((action, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="font-display mt-0.5 text-xs font-bold text-neutral-400 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15px] leading-relaxed text-neutral-700">
                    {action}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </article>
  );
}
