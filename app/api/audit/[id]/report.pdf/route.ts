import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { toPublicAudit } from "@/lib/audit/public";
import { AuditReportDocument } from "@/lib/pdf/audit-report";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * The full audit as a PDF. No longer paywalled — the audit is free — but
 * rendering one is comparatively expensive, so it keeps a modest rate limit of
 * its own rather than being an unbounded CPU endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const key = rateLimitKey("pdf", request);
  if (key) {
    const limit = await checkRateLimit(key, {
      windowMs: 60_000,
      maxRequests: 10,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many downloads. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }
  }

  const { id } = await params;
  const row = await prisma.audit.findUnique({ where: { id } });

  if (!row) {
    return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  }
  if (row.status !== "complete") {
    return NextResponse.json(
      { error: "This audit isn't ready yet." },
      { status: 400 },
    );
  }

  const audit = toPublicAudit(row);
  if (!audit) {
    console.error("Stored report failed validation", row.id);
    return NextResponse.json(
      { error: "This audit's data can't be rendered." },
      { status: 500 },
    );
  }

  const buffer = await renderToBuffer(
    AuditReportDocument({ audit, generatedAt: new Date() }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nexroast-audit-${audit.host}.pdf"`,
    },
  });
}
