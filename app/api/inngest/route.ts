import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { runAuditFunction } from "@/lib/inngest/functions";

// This route now launches Chromium: page capture moved out of the request
// handler and into the audit function, so both of these matter here rather
// than on /api/audit.
//
// - Playwright needs the Node runtime.
// - Inngest invokes each step as its own request, so the ceiling has to cover
//   the slowest single step. Capture (browser cold start + up to 15s
//   navigation + settle + the mobile pass) and generation (which can walk the
//   four-model fallback chain) are the two that need room.
export const runtime = "nodejs";
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAuditFunction],
});
