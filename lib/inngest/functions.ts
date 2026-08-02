import { inngest } from "@/lib/inngest/client";
import { screenshotCaptured } from "@/lib/inngest/events";
import { prisma } from "@/lib/prisma";
import { generateCritique } from "@/lib/critique";

export const generateRoastCritique = inngest.createFunction(
  {
    id: "generate-roast-critique",
    retries: 0,
    triggers: [screenshotCaptured],
  },
  async ({ event, step }) => {
    const { roastId, screenshotUrl, title, description, loadTimeMs } =
      event.data;

    try {
      const critique = await step.run("generate-critique", () =>
        generateCritique({ screenshotUrl, title, description, loadTimeMs }),
      );

      await step.run("save-critique", () =>
        prisma.roast.update({
          where: { id: roastId },
          data: { critique, score: critique.score, status: "complete" },
        }),
      );

      return { roastId, status: "complete" as const };
    } catch (error) {
      await step
        .run("mark-failed", () =>
          prisma.roast.update({
            where: { id: roastId },
            data: { status: "failed" },
          }),
        )
        .catch(() => {});

      throw error;
    }
  },
);
