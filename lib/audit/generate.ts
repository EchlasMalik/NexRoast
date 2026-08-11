import { ApiError, GoogleGenAI } from "@google/genai";
import { factsForPrompt, type PageFacts } from "@/lib/audit/facts";
import { isAuditSafe } from "@/lib/audit/moderation";
import { AUDIT_SYSTEM_PROMPT } from "@/lib/audit/prompt";
import {
  AUDIT_JSON_SCHEMA,
  type AuditResponse,
  AuditResponseSchema,
} from "@/lib/audit/schema";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Ordered fallback chain, not just a single model. Each Gemini model has its
// own separate free-tier rate-limit bucket, so when one gets rate-limited
// (429), moving to the next model gets a genuinely fresh quota rather than
// hitting the same wall again. All four are pinned, non-preview,
// free-tier-eligible models supporting both multimodal image input and
// structured JSON output — the two things this app actually needs.
const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;

/**
 * Distinguishes failures that are worth retrying from ones that are not.
 * The Inngest function reads this to decide whether to hand the job back for
 * another attempt or fail it permanently — retrying a deterministic failure
 * just burns quota and delays the user's error message.
 */
export class AuditGenerationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AuditGenerationError";
  }
}

/**
 * Gemini takes images as inline base64 data rather than fetching a URL
 * server-side, so the screenshot has to be downloaded here before it can be
 * attached to the request.
 */
async function fetchScreenshot(
  screenshotUrl: string,
): Promise<{ data: string; mimeType: string }> {
  let response: Response;
  try {
    response = await fetch(screenshotUrl);
  } catch (error) {
    // Network blip reaching R2 — worth another attempt.
    throw new AuditGenerationError(
      `Could not reach the screenshot: ${error instanceof Error ? error.message : "unknown"}`,
      true,
    );
  }

  if (!response.ok) {
    // 4xx here means the object genuinely isn't there; retrying won't help.
    throw new AuditGenerationError(
      `Could not download screenshot (${response.status})`,
      response.status >= 500,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    data: buffer.toString("base64"),
    mimeType: response.headers.get("content-type") ?? "image/png",
  };
}

function userMessage(facts: PageFacts): string {
  const summary = factsForPrompt(facts);
  return [
    "Extracted page facts (measured, not guessed — treat these as ground truth):",
    ...Object.entries(summary).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "The screenshot shows the above-the-fold desktop viewport. Judge only what is visible in it, plus the facts above.",
  ].join("\n");
}

async function requestAudit(
  image: { data: string; mimeType: string },
  facts: PageFacts,
  model: string,
): Promise<AuditResponse | null> {
  // Transient API errors (503 "high demand", network blips — observed in
  // practice on the free tier) are treated the same as a parse failure:
  // return null and let the caller's retry take another swing. A 429 is
  // different — retrying the *same* model would just hit the same wall, so
  // it's rethrown to move on to the next model instead.
  let response;
  try {
    response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: image }, { text: userMessage(facts) }],
        },
      ],
      config: {
        systemInstruction: AUDIT_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: AUDIT_JSON_SCHEMA,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) throw error;
    console.error(`Gemini generateContent failed (${model})`, error);
    return null;
  }

  if (!response.text) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    return null;
  }

  const result = AuditResponseSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Generates a validated audit from the screenshot and the measured page facts.
 *
 * Works through MODELS in order; for each, retries once if the response fails
 * to parse, validate or pass the safety check. A rate-limit error skips
 * straight to the next model rather than burning a retry on one that's already
 * exhausted for the minute.
 *
 * Throws a retryable AuditGenerationError only when every model has been tried
 * — at that point the failure is more likely to be provider-wide than
 * deterministic, so Inngest is allowed one more go later.
 */
export async function generateAudit(input: {
  screenshotUrl: string;
  facts: PageFacts;
}): Promise<AuditResponse> {
  const image = await fetchScreenshot(input.screenshotUrl);

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let result: AuditResponse | null;
      try {
        result = await requestAudit(image, input.facts, model);
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) break;
        throw error;
      }
      if (result && isAuditSafe(result)) return result;
    }
  }

  throw new AuditGenerationError(
    "No Gemini model returned a valid audit after trying all fallbacks.",
    true,
  );
}
