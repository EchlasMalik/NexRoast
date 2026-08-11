import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditPending } from "@/components/audit/audit-pending";
import { AuditReport } from "@/components/audit/audit-report";
import { NexioraCta } from "@/components/audit/nexiora-cta";
import { ShareActions } from "@/components/audit/share-actions";
import { bandFor } from "@/lib/audit/categories";
import { toPublicAudit } from "@/lib/audit/public";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

async function loadAudit(id: string) {
  return prisma.audit.findUnique({ where: { id } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await loadAudit(id);

  if (!row) {
    return { title: "Audit not found — NexRoast", robots: { index: false } };
  }

  const canonical = `${getSiteUrl()}/audit/${row.id}`;

  // Only a completed, quality-checked audit is indexable. Everything else —
  // pending, failed, or a superseded repeat audit of the same site — stays out
  // of the index while remaining reachable by anyone with the link.
  if (row.status !== "complete") {
    return {
      title: `Auditing ${row.host}… — NexRoast`,
      description: "This website audit is being generated right now.",
      robots: { index: false, follow: true },
      alternates: { canonical },
    };
  }

  const audit = toPublicAudit(row);
  if (!audit) {
    return { title: "Audit unavailable — NexRoast", robots: { index: false } };
  }

  const { report } = audit;
  const title = `${audit.displayName} website audit — ${report.overallScore}/100 | NexRoast`;
  const description = report.summary.slice(0, 155);

  return {
    title,
    description,
    robots: audit.indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await loadAudit(id);
  if (!row) notFound();

  if (row.status === "failed") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center sm:px-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          We couldn&apos;t audit that site.
        </h1>
        <p className="max-w-md text-base text-neutral-400">
          It might be unreachable, blocking automated visitors, or something
          broke on our end. Trying again often works.
        </p>
        <Link
          href="/#audit"
          className="mt-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20"
        >
          Audit another site
        </Link>
      </main>
    );
  }

  // Still working — hand to the one client component on this route. It polls a
  // status endpoint and refreshes; it never renders the report.
  if (row.status !== "complete") {
    return (
      <AuditPending
        id={row.id}
        host={row.host}
        businessName={row.businessName}
      />
    );
  }

  const audit = toPublicAudit(row);
  if (!audit) {
    // A completed row whose stored report this build can't read. Better an
    // honest message than a half-rendered page.
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center sm:px-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          This audit can&apos;t be displayed.
        </h1>
        <Link
          href="/#audit"
          className="mt-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-sm font-bold text-white"
        >
          Run a new audit
        </Link>
      </main>
    );
  }

  const { report } = audit;
  const band = bandFor(report.overallScore);

  // Structured data so the audit is machine-readable as the review it is.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Report",
    name: `${audit.displayName} website audit`,
    url: `${getSiteUrl()}/audit/${audit.id}`,
    datePublished:
      audit.completedAt?.toISOString() ?? audit.createdAt.toISOString(),
    about: { "@type": "WebSite", name: audit.displayName, url: audit.url },
    publisher: { "@type": "Organization", name: "NexRoast" },
    description: report.summary,
  };

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        // Serialised from values we control; no user HTML can reach this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="flex w-full max-w-3xl flex-col items-center gap-2 text-center">
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.14em] uppercase ${band.chipBg}`}
        >
          {band.label}
        </span>
        <p className="max-w-full truncate text-sm text-neutral-500">
          {audit.url}
        </p>
      </div>

      <AuditReport audit={audit} />

      <NexioraCta auditId={audit.id} displayName={audit.displayName} />

      <ShareActions
        auditId={audit.id}
        displayName={audit.displayName}
        score={report.overallScore}
      />
    </main>
  );
}
