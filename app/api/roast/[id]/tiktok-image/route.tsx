import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTikTokImageProps,
  RoastTikTokImage,
  TIKTOK_IMAGE_CONTENT_TYPE,
  TIKTOK_IMAGE_SIZE,
} from "@/app/roast/[id]/og-render";

// Fetches via Prisma (pg driver), which needs the Node.js runtime — same
// reason opengraph-image.tsx needs it.
export const runtime = "nodejs";

/**
 * Downloads the vertical (9:16) share card as an attachment, rather than
 * just rendering it — the point is to get a file onto the creator's device
 * that they can drop straight into a TikTok video, not to preview it inline.
 * Available for any complete roast regardless of unlock status: it only
 * shows the screenshot and the same first two roast points already visible
 * on a free, locked roast page, so there's nothing paywalled to protect here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const roast = await prisma.roast.findUnique({ where: { id } });
  if (!roast) {
    return NextResponse.json({ error: "Roast not found." }, { status: 404 });
  }
  if (roast.status !== "complete") {
    return NextResponse.json(
      { error: "This roast isn't ready yet." },
      { status: 400 },
    );
  }

  const props = getTikTokImageProps(roast);
  const image = new ImageResponse(<RoastTikTokImage {...props} />, {
    ...TIKTOK_IMAGE_SIZE,
  });
  const buffer = await image.arrayBuffer();

  let filename = "nexroast-tiktok.png";
  try {
    filename = `nexroast-${new URL(roast.url).hostname}-tiktok.png`;
  } catch {
    // Keep the generic filename if the stored URL is somehow unparseable.
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": TIKTOK_IMAGE_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
