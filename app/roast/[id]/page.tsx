import type { Metadata } from "next";
import { RoastStatus } from "@/components/roast-status";
import { normalizeCritique } from "@/lib/critique";
import { prisma } from "@/lib/prisma";
import { stripEmphasis } from "@/lib/rich-text";

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const roast = await prisma.roast.findUnique({ where: { id } });

  // Roast pages are per-visitor share links, not search-facing content —
  // keep them out of search indexes regardless of status (see app/sitemap.ts).
  const robots = { index: false, follow: true };

  if (!roast) {
    return { title: "Roast not found — NexRoast", robots };
  }

  const hostname = hostnameOf(roast.url);

  if (roast.status !== "complete") {
    return {
      title: `Roasting ${hostname}… — NexRoast`,
      description:
        "This site is getting roasted right now — check back in a few seconds.",
      robots,
    };
  }

  const critique = normalizeCritique(roast.critique);
  const headline = critique
    ? stripEmphasis(critique.zinger ?? critique.opening)
    : undefined;

  return {
    title: `${hostname} scored ${roast.score}/100 — NexRoast`,
    description: headline ?? `See the full AI roast of ${hostname}.`,
    robots,
  };
}

export default async function RoastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoastStatus roastId={id} />;
}
