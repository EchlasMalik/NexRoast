import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import {
  AuditSocialImage,
  IMAGE_CONTENT_TYPE,
  SOCIAL_IMAGE_SIZE,
  toShareProps,
} from "@/app/audit/[id]/share-render";
import { toPublicAudit } from "@/lib/audit/public";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

/**
 * Downloads the vertical (9:16) card as an attachment rather than rendering it
 * inline — the point is to get a file onto the device that can be dropped
 * straight into a video, not to preview it in a tab.
 *
 * Carries only what is already public on the audit page. This endpoint is
 * reachable by anyone with an audit id.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    return NextResponse.json(
      { error: "This audit's data can't be rendered." },
      { status: 500 },
    );
  }

  const props = toShareProps(audit, `${getSiteUrl()}/NexRoast-Logo.png`, 4);
  const image = new ImageResponse(<AuditSocialImage {...props} />, {
    ...SOCIAL_IMAGE_SIZE,
  });

  return new NextResponse(await image.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": IMAGE_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="nexroast-${audit.host}-audit.png"`,
    },
  });
}
