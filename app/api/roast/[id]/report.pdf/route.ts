import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { CritiqueSchema } from "@/lib/critique";
import { RoastReportDocument } from "@/lib/pdf/roast-report";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const roast = await prisma.roast.findUnique({ where: { id } });
  if (!roast) {
    return NextResponse.json({ error: "Roast not found." }, { status: 404 });
  }

  // Gate the download itself, not just the UI — otherwise the paywall is
  // just a suggestion for anyone who guesses or bookmarks this URL.
  if (!roast.unlockedAt) {
    return NextResponse.json(
      { error: "This report hasn't been unlocked yet." },
      { status: 402 },
    );
  }

  if (roast.status !== "complete" || roast.score === null) {
    return NextResponse.json(
      { error: "This roast isn't ready yet." },
      { status: 400 },
    );
  }

  const parsed = CritiqueSchema.safeParse(roast.critique);
  if (!parsed.success) {
    console.error("Roast critique failed schema validation", roast.id);
    return NextResponse.json(
      { error: "This report's data looks corrupted." },
      { status: 500 },
    );
  }

  const buffer = await renderToBuffer(
    RoastReportDocument({
      url: roast.url,
      score: roast.score,
      critique: parsed.data,
      screenshotUrl: roast.screenshotUrl,
      generatedAt: new Date(),
    }),
  );

  let filename = "nexroast-report.pdf";
  try {
    filename = `nexroast-${new URL(roast.url).hostname}.pdf`;
  } catch {
    // Keep the generic filename if the stored URL is somehow unparseable.
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
