import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { isCritiqueSafe } from "@/lib/moderation";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.6-flash";

export const RoastCategory = z.enum([
  "design",
  "ux",
  "conversion",
  "speed",
  "trust",
]);

export const RoastPointSchema = z.object({
  category: RoastCategory,
  critique: z
    .string()
    .describe("A punchy 1-2 sentence roast of this specific issue."),
});

export const CritiqueSchema = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "Overall quality score from 0 (atrocious) to 100 (flawless, high-converting).",
    ),
  roastPoints: z
    .array(RoastPointSchema)
    .min(4)
    .max(6)
    .describe("4 to 6 distinct roast points covering different categories."),
  biggestWin: z
    .string()
    .describe(
      "The single highest-leverage fix and what it would win the site.",
    ),
});

export type Critique = z.infer<typeof CritiqueSchema>;

const CRITIQUE_JSON_SCHEMA = z.toJSONSchema(CritiqueSchema);

export class CritiqueGenerationError extends Error {}

const SYSTEM_PROMPT = `You are NexRoast, an AI that roasts websites for a living. Given a screenshot of a page's above-the-fold viewport plus some scraped metadata, you produce a structured critique.

Tone: confident, witty, TikTok-friendly — the kind of roast that gets screenshotted and shared. Punchy and funny, never mean-spirited or personal; roast the design and decisions, not the people who made them.

Score 0-100 reflects overall quality as a landing page: how well it converts, how credible it looks, and how well it's built — 100 is flawless and high-converting, 0 is atrocious.

Give 4-6 roast points. Each must have a category (design, ux, conversion, speed, or trust) and a 1-2 sentence critique in the tone above. Cover a mix of categories rather than repeating the same one.

Then give one "biggest win" recommendation: the single change that would move the needle most if fixed.

Respond with JSON matching the provided schema only.`;

/**
 * Gemini takes images as inline base64 data rather than fetching a URL
 * server-side (unlike the Claude API this replaced) — so the screenshot has
 * to be downloaded here before it can be attached to the request.
 */
async function fetchScreenshotAsInlineData(
  screenshotUrl: string,
): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(screenshotUrl);
  if (!response.ok) {
    throw new CritiqueGenerationError(
      `Could not download screenshot for critique generation: ${response.status}`,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    data: buffer.toString("base64"),
    mimeType: response.headers.get("content-type") ?? "image/png",
  };
}

async function requestCritique(input: {
  screenshotUrl: string;
  title: string;
  description: string | null;
  loadTimeMs: number;
}): Promise<Critique | null> {
  const image = await fetchScreenshotAsInlineData(input.screenshotUrl);

  // Transient API errors (503 "high demand", 429 quota, network blips —
  // all observed in practice on the free tier) are treated the same as a
  // parse/moderation failure: return null and let the existing retry-once
  // in generateCritique() take another swing, rather than throwing and
  // failing the whole roast on what's often a one-off hiccup.
  let response;
  try {
    response = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: image },
            {
              text: [
                `Page title: ${input.title || "(none)"}`,
                `Meta description: ${input.description ?? "(none)"}`,
                `Load time: ${input.loadTimeMs}ms`,
              ].join("\n"),
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: CRITIQUE_JSON_SCHEMA,
      },
    });
  } catch (error) {
    console.error("Gemini generateContent call failed", error);
    return null;
  }

  if (!response.text) return null;

  const parsed = CritiqueSchema.safeParse(JSON.parse(response.text));
  return parsed.success ? parsed.data : null;
}

/**
 * Generates a structured roast critique from a screenshot + page metadata,
 * validating the response against `CritiqueSchema` and running it through a
 * basic profanity/safety filter. Retries once (a single fresh model call) if
 * the first response fails to parse, validate, or pass moderation — a
 * moderation failure is treated the same as a parse failure rather than
 * silently sanitizing the text, since we want a clean regeneration, not a
 * roast with words blanked out.
 */
export async function generateCritique(input: {
  screenshotUrl: string;
  title: string;
  description: string | null;
  loadTimeMs: number;
}): Promise<Critique> {
  const first = await requestCritique(input);
  if (first && isCritiqueSafe(first)) return first;

  const retry = await requestCritique(input);
  if (retry && isCritiqueSafe(retry)) return retry;

  throw new CritiqueGenerationError(
    "Gemini did not return a valid, safe critique after one retry.",
  );
}
