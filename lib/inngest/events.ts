import { eventType } from "inngest";
import { z } from "zod";

/**
 * Emitted as soon as a URL has been validated — before any expensive work.
 *
 * The payload is deliberately tiny. Capture used to happen in the request
 * handler and its results travelled through here, which meant the whole
 * PageFacts object rode the event bus and, worse, a failure to dispatch threw
 * away a completed browser capture. Now the event is the *first* thing that
 * happens, so nothing is wasted if the queue is unreachable.
 */
export const auditRequested = eventType("audit/requested", {
  schema: z.object({
    auditId: z.string(),
    url: z.string(),
    host: z.string(),
  }),
});
