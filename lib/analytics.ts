import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type EventType =
  | "page_view"
  | "audit_submitted"
  | "audit_completed"
  | "share_click"
  | "tiktok_image_download"
  | "pdf_download"
  | "book_call_click"
  | "copy_fix_clicked";

/**
 * Records a lightweight analytics event.
 *
 * Deliberately NOT awaited by request handlers — see `trackFireAndForget`.
 * The previous version was described as non-blocking but every caller awaited
 * it, so an analytics write sat on the critical path of user-facing requests.
 */
export async function track(
  type: EventType,
  data?: {
    auditId?: string;
    path?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        type,
        auditId: data?.auditId,
        path: data?.path,
        metadata: data?.metadata,
      },
    });
  } catch (error) {
    console.error(`Failed to record analytics event "${type}"`, error);
  }
}

/**
 * Fire-and-forget wrapper for request handlers. Analytics must never be the
 * reason a user waits, and must never be the reason a request fails.
 */
export function trackAsync(...args: Parameters<typeof track>): void {
  void track(...args);
}
