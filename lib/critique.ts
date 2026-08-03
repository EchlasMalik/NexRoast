import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { isCritiqueSafe } from "@/lib/moderation";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Ordered fallback chain, not just a single model. Each Gemini model has its
// own separate free-tier rate-limit bucket, so when one gets rate-limited
// (429), moving to the next model gets a genuinely fresh quota rather than
// hitting the same wall again — see generateCritique() below. All four are
// pinned, non-preview, free-tier-eligible models, verified directly against
// the API (not just docs, which drift) for both multimodal image input and
// structured JSON output — the two things this app actually needs.
const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;

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

async function requestCritique(
  image: { data: string; mimeType: string },
  input: { title: string; description: string | null; loadTimeMs: number },
  model: string,
): Promise<Critique | null> {
  // Transient API errors (503 "high demand", network blips — observed in
  // practice on the free tier) are treated the same as a parse/moderation
  // failure: return null and let generateCritique()'s retry take another
  // swing, rather than failing the whole roast on what's often a one-off
  // hiccup. A 429 (rate limit) is different — retrying the *same* model
  // would just hit the same wall, so it's rethrown for generateCritique()
  // to catch and move on to the next model instead.
  let response;
  try {
    response = await client.models.generateContent({
      model,
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
    if (error instanceof ApiError && error.status === 429) throw error;
    console.error(`Gemini generateContent call failed (${model})`, error);
    return null;
  }

  if (!response.text) return null;

  const parsed = CritiqueSchema.safeParse(JSON.parse(response.text));
  return parsed.success ? parsed.data : null;
}

/**
 * Generates a structured roast critique from a screenshot + page metadata,
 * validating the response against `CritiqueSchema` and running it through a
 * basic profanity/safety filter. Works through MODELS in order; for each
 * model, retries once (a single fresh call) if the response fails to parse,
 * validate, or pass moderation — a moderation failure is treated the same as
 * a parse failure rather than silently sanitizing the text, since we want a
 * clean regeneration, not a roast with words blanked out. A rate-limit error
 * skips straight to the next model instead of burning a retry on one that's
 * already exhausted for the minute.
 */
export async function generateCritique(input: {
  screenshotUrl: string;
  title: string;
  description: string | null;
  loadTimeMs: number;
}): Promise<Critique> {
  const image = await fetchScreenshotAsInlineData(input.screenshotUrl);

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let result: Critique | null;
      try {
        result = await requestCritique(image, input, model);
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) break;
        throw error;
      }
      if (result && isCritiqueSafe(result)) return result;
    }
  }

  throw new CritiqueGenerationError(
    "No Gemini model returned a valid, safe critique after trying all fallbacks.",
  );
}
