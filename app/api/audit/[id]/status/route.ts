import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Status only — deliberately not the report.
 *
 * The pending page polls this and calls `router.refresh()` once the audit
 * completes, so the finished report is rendered by the server component and
 * exists in the HTML. Serving the report here too would mean maintaining a
 * second client-side copy of the entire renderer, which is what the old
 * implementation did and what made completed pages invisible to crawlers.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: { status: true, businessName: true },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  }

  return NextResponse.json(
    { status: audit.status, businessName: audit.businessName },
    { headers: { "Cache-Control": "no-store" } },
  );
}
