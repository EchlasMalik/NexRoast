import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type EventType =
  | "page_view"
  | "roast_submitted"
  | "share_click"
  | "paywall_conversion"
  | "lead_submitted"
  | "book_call_click"
  | "tiktok_image_download";

/**
 * Records a lightweight analytics event. Best-effort and non-blocking by
 * design — analytics must never be the reason a real user-facing request
 * fails, so failures are logged and swallowed rather than thrown.
 */
export async function track(
  type: EventType,
  data?: {
    roastId?: string;
    path?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        type,
        roastId: data?.roastId,
        path: data?.path,
        metadata: data?.metadata,
      },
    });
  } catch (error) {
    console.error(`Failed to record analytics event "${type}"`, error);
  }
}
