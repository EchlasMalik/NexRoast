import { eventType } from "inngest";
import { z } from "zod";

export const screenshotCaptured = eventType("roast/screenshot.captured", {
  schema: z.object({
    roastId: z.string(),
    url: z.string(),
    screenshotUrl: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    loadTimeMs: z.number(),
  }),
});
