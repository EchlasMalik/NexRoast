import { NextResponse } from "next/server";
import { normalizeCritique, toPublicCritique } from "@/lib/critique";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const roast = await prisma.roast.findUnique({ where: { id } });
  if (!roast) {
    return NextResponse.json({ error: "Roast not found." }, { status: 404 });
  }

  // Redact the paywalled parts here rather than in the component: the browser
  // should never receive text it isn't allowed to show, or the paywall is a
  // CSS effect that anyone can defeat from the network tab.
  const critique = normalizeCritique(roast.critique);
  const unlocked = roast.unlockedAt !== null;

  return NextResponse.json({
    roast: {
      id: roast.id,
      url: roast.url,
      screenshotUrl: roast.screenshotUrl,
      status: roast.status,
      score: roast.score,
      critique: critique && toPublicCritique(critique, unlocked),
      createdAt: roast.createdAt,
      unlockedAt: roast.unlockedAt,
    },
  });
}
