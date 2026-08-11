import { NonRetriableError } from "inngest";
import { track } from "@/lib/analytics";
import type { PageFacts } from "@/lib/audit/facts";
import { AuditGenerationError, generateAudit } from "@/lib/audit/generate";
import { buildReport } from "@/lib/audit/scoring";
import { finaliseVisibility } from "@/lib/audit/visibility";
import { capturePage, CaptureError, resolveBusinessName } from "@/lib/capture";
import { inngest } from "@/lib/inngest/client";
import { auditRequested } from "@/lib/inngest/events";
import { prisma } from "@/lib/prisma";
import { uploadScreenshot } from "@/lib/r2";

/**
 * The whole audit: capture the page, generate the analysis, score it, publish.
 *
 * Capture lives here rather than in the request handler because it is the
 * expensive part. Inline, a queue outage or a transient model error threw away
 * a completed browser capture — roughly fifteen seconds of work — and the
 * 45-second serverless ceiling capped what capture was allowed to do. In a
 * step it inherits the retry policy instead.
 *
 * Step results are memoised, which is what makes retries cheap: if generation
 * fails, the retry replays the capture result rather than relaunching Chromium.
 *
 * Failures are split by whether retrying could plausibly help:
 * - deterministic (site unreachable, screenshot missing) -> NonRetriableError,
 *   failed immediately, because a retry would burn quota to reach the same end
 * - transient (provider 5xx, network, every model exhausted) -> rethrown so
 *   Inngest backs off and tries again later
 */
export const runAuditFunction = inngest.createFunction(
  {
    id: "run-audit",
    retries: 2,
    triggers: [auditRequested],
    /**
     * Runs only once every retry is exhausted. Without it a transiently
     * failing audit would sit at "processing" forever and the page would poll
     * indefinitely — the user would never see an error.
     */
    onFailure: async ({ event, step }) => {
      const auditId = (event.data.event.data as unknown as { auditId?: string })
        ?.auditId;
      if (!auditId) return;

      await step.run("mark-failed", () =>
        prisma.audit.updateMany({
          where: { id: auditId, status: { in: ["pending", "processing"] } },
          data: { status: "failed" },
        }),
      );
    },
  },
  async ({ event, step }) => {
    const { auditId, url, host } = event.data;

    try {
      // Returns only serialisable values — the PNG buffer is uploaded here
      // rather than handed back, since step results are memoised as JSON.
      const captured = await step.run("capture-page", async () => {
        const { screenshot, facts } = await capturePage(url);
        const screenshotUrl = await uploadScreenshot(
          `audits/${auditId}.png`,
          screenshot,
        );

        await prisma.audit.update({
          where: { id: auditId },
          data: {
            screenshotUrl,
            // Stored now rather than waiting for the model, so the pending
            // page can name whose site is being audited.
            businessName: resolveBusinessName(facts),
            status: "processing",
          },
        });

        return { screenshotUrl, facts };
      });

      const facts = captured.facts as unknown as PageFacts;

      const response = await step.run("generate-audit", () =>
        generateAudit({ screenshotUrl: captured.screenshotUrl, facts }),
      );

      const report = await step.run("build-report", async () =>
        buildReport(response, facts, new Date()),
      );

      await step.run("save-report", () =>
        prisma.audit.update({
          where: { id: auditId },
          data: {
            report,
            overallScore: report.overallScore,
            businessName: report.businessName,
            businessType: report.businessType,
            status: "complete",
            completedAt: new Date(),
          },
        }),
      );

      // Indexability is decided once, here, so the sitemap and the page's
      // robots meta can never disagree.
      await step.run("finalise-visibility", () =>
        finaliseVisibility(auditId, host, report),
      );

      await step.run("track-completion", () =>
        track("audit_completed", {
          auditId,
          metadata: { score: report.overallScore, archetype: report.archetype },
        }),
      );

      return { auditId, status: "complete" as const };
    } catch (error) {
      const deterministic =
        error instanceof CaptureError ||
        (error instanceof AuditGenerationError && !error.retryable);

      if (deterministic) {
        await step
          .run("mark-failed", () =>
            prisma.audit.update({
              where: { id: auditId },
              data: { status: "failed" },
            }),
          )
          .catch(() => {});

        throw new NonRetriableError(
          error instanceof Error ? error.message : "Audit failed",
        );
      }

      throw error;
    }
  },
);
