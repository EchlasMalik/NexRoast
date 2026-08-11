import { ImageResponse } from "next/og";
import {
  AuditOgImage,
  IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  toShareProps,
} from "./share-render";
import { toPublicAudit } from "@/lib/audit/public";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

// Fetches via Prisma (pg driver), which needs the Node.js runtime.
export const runtime = "nodejs";

export const size = OG_IMAGE_SIZE;
export const contentType = IMAGE_CONTENT_TYPE;
export const alt = "NexRoast website audit";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.audit.findUnique({ where: { id } });
  const audit = row ? toPublicAudit(row) : null;

  if (!audit) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          fontSize: 56,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        NexRoast — website audits
      </div>,
      { ...OG_IMAGE_SIZE },
    );
  }

  // Satori resolves images over HTTP, so the logo needs an absolute URL.
  const props = toShareProps(audit, `${getSiteUrl()}/NexRoast-Logo.png`, 4);
  return new ImageResponse(<AuditOgImage {...props} />, { ...OG_IMAGE_SIZE });
}
