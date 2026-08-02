import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import {
  getOgImageProps,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  RoastOgImage,
} from "./og-render";

// Fetches via Prisma (pg driver), which needs the Node.js runtime.
export const runtime = "nodejs";

export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "NexRoast — your website, roasted";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const roast = await prisma.roast.findUnique({ where: { id } });
  const props = getOgImageProps(roast);

  return new ImageResponse(<RoastOgImage {...props} />, { ...OG_IMAGE_SIZE });
}
