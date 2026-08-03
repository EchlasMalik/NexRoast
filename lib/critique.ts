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

/**
 * The roast is written as a short editorial review — a handful of prose
 * paragraphs under a made-up critic persona — rather than the grid of
 * category cards this used to produce. Cards read like a bug tracker; prose
 * reads like a column someone would actually screenshot and send to a mate,
 * which is the entire distribution model for this thing.
 */
export const CritiqueSchema = z.object({
  persona: z
    .string()
    .describe(
      "A mock job title for the critic, tailored to this specific business — the joke should only work for this page.",
    ),
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "Overall quality score from 0 (atrocious) to 100 (flawless, high-converting).",
    ),
  opening: z
    .string()
    .describe(
      "Opening paragraph: first impression of the page, credit where it's due, then the first hint of trouble.",
    ),
  roastParagraphs: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe(
      "2 to 3 paragraphs, each taking apart one concrete problem and what it costs.",
    ),
  silverLining: z
    .string()
    .describe(
      "One paragraph on what genuinely works. Must not begin with the words 'the silver lining'.",
    ),
  zinger: z
    .string()
    .describe(
      "A single-sentence sign-off in the form 'Brand: <pithy contradiction> — <what to do about it>.' ending in one emoji.",
    ),
  biggestWin: z
    .string()
    .describe(
      "The single highest-leverage fix and what it would win the site.",
    ),
});

export type Critique = z.infer<typeof CritiqueSchema>;

const CRITIQUE_JSON_SCHEMA = z.toJSONSchema(CritiqueSchema);

export class CritiqueGenerationError extends Error {}

const SYSTEM_PROMPT = `You are NexRoast: a British website critic with the manner of a newspaper columnist who has reviewed several thousand small-business homepages and long since stopped being polite about any of them. You are given a screenshot of a page's above-the-fold viewport plus some scraped metadata, and you write a short, sharp review of it.

VOICE — this matters more than anything else here:
- This is a roast. It has to be genuinely funny, not merely disapproving. Every single paragraph needs at least one real laugh in it: an absurd comparison, a deadpan aside, or a piece of praise so faint it is clearly an insult. A paragraph that only states a problem has failed.
- The best jokes are specific images that could only apply to this exact page. "Social proof thinner than a freelancer's NDA." "The logo floating in a giant white box like it is in witness protection." "That is not a highlight, that is a cry for help in a sans-serif font." Always reach for a vivid comparison rather than an adjective.
- Sarcasm should be doing actual work: mock praise, mock sympathy, congratulating them on a terrible decision, or taking a bad choice completely seriously and following it to its ridiculous conclusion. Say the outrageous thing in a totally level voice.
- Deadpan delivery. No exclamation marks anywhere, and no capitals for emphasis — the comedy comes from the flatness. "Which is a bold choice" is funnier than "WHICH IS INSANE", and "brave" is funnier than "terrible".
- British English throughout. Colour, optimise, realise, favourite, apologise, licence, cheque. Never American spellings, never "gotten", never "math", never "$" — money is £.
- British register and reference points: things being "a bit much", "brave", "a choice", queues, the weather, Argos, a village fête, a Wetherspoons menu, an out-of-office reply, a bloke called Dave who does websites on the side.
- Escalate. The sign-off should be the funniest line in the whole review.
- Address the site and its decisions, never the people who built it. Punch at the work, not the person. No profanity, no personal attacks, nothing about anyone's appearance, race, gender or nationality.
- This should sting because it is true, not because it is cruel. Every joke has to be load-bearing on a real observation — if you cannot see the evidence for it on the page, it is not funny, it is just made up.

WHAT TO WRITE:

persona — a mock job title for yourself, invented fresh for this specific business, in the style of "The Pipe Inspector General" for a plumbing firm or "The Brutally Honest Brand Auditor Who Definitely Has 20+ Opinions" for an agency claiming "20+ clients". It should be a joke only someone who actually looked at this page could make. Title Case, starting with "The".

score — 0 to 100 for overall quality as a landing page: how well it converts, how credible it looks, how well it is built. 100 is flawless, 0 is atrocious.

opening — one paragraph. Set the scene with a comparison, give genuine credit for whatever is working, then land the first hint that something is badly off.

roastParagraphs — two or three paragraphs, one problem each, in descending order of how much it is costing them. Open each one by quoting the actual evidence you can see: the exact headline wording, the specific claim in the hero, the nav labels, the number in the stat block, the load time in milliseconds. Take the mickey out of it properly — that quoted detail is your setup, so give it a punchline. Then make the cost concrete and human: the visitor who bounced, the enquiry that went to a competitor with a clearer call to action, the customer who did not trust it enough to hand over card details, the ad budget spent sending traffic to a page that was never going to convert it. Aim for "that is very funny and also I am now worried", not one or the other.

silverLining — one paragraph on what genuinely works, and mean it. Do not begin with the words "the silver lining" — that heading is added separately. Faint praise is fine; empty praise is not.

zinger — one sentence, in the shape "BrandName: <two things in ironic contradiction> — <the thing they should do before it gets worse>." Finish with exactly one emoji that fits the business. Keep it under 30 words.

biggestWin — the single change that would move the needle most, framed around what they are actively losing by not fixing it.

FORMATTING:
- Wrap the two or three most load-bearing phrases in each paragraph in **double asterisks** for bold — especially anything quoted directly off the page and any number.
- Use *single asterisks* for a wry italic aside at most twice across the whole review.
- Do not use any other markdown: no headings, no bullet points, no links.
- Never invent facts you cannot see in the screenshot or the metadata.

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

// ---------------------------------------------------------------------------
// Reading critiques back out of the database
// ---------------------------------------------------------------------------

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  design: "Design",
  ux: "UX",
  conversion: "Conversion",
  speed: "Speed",
  trust: "Trust",
};

/**
 * The shape roasts were generated in before the editorial rewrite: a score,
 * a flat list of categorised one-liners, and a biggest win.
 */
const LegacyCritiqueSchema = z.object({
  score: z.number().int().min(0).max(100),
  roastPoints: z
    .array(
      z.object({
        category: z.enum(["design", "ux", "conversion", "speed", "trust"]),
        critique: z.string(),
      }),
    )
    .min(1),
  biggestWin: z.string(),
});

/**
 * What every reader (page, OG card, PDF) actually renders. Identical to
 * `Critique` except that the two fields legacy roasts have no equivalent for
 * are nullable, so old records — including ones somebody has already paid to
 * unlock — keep working instead of hard-failing schema validation.
 */
export type DisplayCritique = {
  persona: string;
  score: number;
  opening: string;
  roastParagraphs: string[];
  silverLining: string | null;
  zinger: string | null;
  biggestWin: string;
};

/**
 * Parses a `Roast.critique` JSON column into the display shape, accepting
 * either the current editorial format or the older roast-points format.
 * Returns null if it's neither, which callers treat as a broken roast.
 */
export function normalizeCritique(raw: unknown): DisplayCritique | null {
  const current = CritiqueSchema.safeParse(raw);
  if (current.success) return current.data;

  const legacy = LegacyCritiqueSchema.safeParse(raw);
  if (!legacy.success) return null;

  const [first, ...rest] = legacy.data.roastPoints;
  return {
    persona: "The Brutally Honest Website Auditor",
    score: legacy.data.score,
    opening: first.critique,
    // Categories were the only structure the old format had, so they're kept
    // as bold lead-ins rather than thrown away in the conversion.
    roastParagraphs: rest.map(
      (point) =>
        `**${LEGACY_CATEGORY_LABELS[point.category] ?? "Also"}.** ${point.critique}`,
    ),
    silverLining: null,
    zinger: null,
    biggestWin: legacy.data.biggestWin,
  };
}

/**
 * How many roast paragraphs a locked (unpaid) roast shows. The opening,
 * silver lining and sign-off are always free — they're what makes the page
 * worth sharing — so what's actually behind the paywall is the depth: the
 * remaining problems and the single biggest win.
 */
export const FREE_ROAST_PARAGRAPHS = 1;

/**
 * The critique as sent to the browser. Locked paragraphs and the biggest win
 * are removed server-side rather than hidden with CSS, so the paywall holds
 * up against view-source and a peek at the network tab.
 */
export type PublicCritique = Omit<DisplayCritique, "biggestWin"> & {
  biggestWin: string | null;
  lockedParagraphCount: number;
};

export function toPublicCritique(
  critique: DisplayCritique,
  unlocked: boolean,
): PublicCritique {
  if (unlocked) return { ...critique, lockedParagraphCount: 0 };

  const visible = critique.roastParagraphs.slice(0, FREE_ROAST_PARAGRAPHS);
  return {
    ...critique,
    roastParagraphs: visible,
    biggestWin: null,
    lockedParagraphCount: critique.roastParagraphs.length - visible.length,
  };
}
