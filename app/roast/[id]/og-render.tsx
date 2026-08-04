import { normalizeCritique } from "@/lib/critique";
import { stripEmphasis } from "@/lib/rich-text";
import {
  scoreBucket,
  STATUS_STYLES,
  SURVIVAL_MAX,
  survivalStars,
} from "@/lib/score-style";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

// 9:16 — TikTok/Reels/Stories canvas. The landscape OG image above is built
// for link-preview cards; this is built to actually be used as visual
// content inside a vertical video (dropped in as a background clip, held on
// screen while narrating over it, etc.), which is a different job.
export const TIKTOK_IMAGE_SIZE = { width: 1080, height: 1920 };
export const TIKTOK_IMAGE_CONTENT_TYPE = "image/png";

/**
 * Derives the OG image props from a Roast record, validating the `critique`
 * JSON column against its Zod schema rather than trusting its shape blindly.
 */
export function getOgImageProps(
  roast: { url: string; score: number | null; critique: unknown } | null,
): { url: string | null; score: number | null; headline: string | null } {
  if (!roast) return { url: null, score: null, headline: null };

  const critique = normalizeCritique(roast.critique);
  return {
    url: roast.url,
    score: roast.score,
    // The sign-off is written to be quoted, so it's the better card headline
    // when there is one; legacy roasts fall back to the opening paragraph.
    headline: critique
      ? stripEmphasis(critique.zinger ?? critique.opening)
      : null,
  };
}

/**
 * Props for the TikTok share card.
 *
 * The headline is the critique's `hook` — the line the model is asked to
 * write specifically to stop a stranger scrolling. That is deliberately not
 * the opening paragraph, which is the softest thing in the review: it opens
 * with a comparison and hands out credit before it gets to the point, which
 * is right for a written review and useless as a three-second hook.
 *
 * Everything here is content that is free on the roast page anyway. This
 * endpoint is public — anyone holding a roast ID can fetch the image — so
 * pulling the locked paragraphs in for extra spice would quietly hand away
 * what the £9 is for.
 */
export function getTikTokImageProps(
  roast: {
    url: string;
    score: number | null;
    critique: unknown;
    screenshotUrl: string | null;
  } | null,
): {
  url: string | null;
  score: number | null;
  screenshotUrl: string | null;
  hook: string | null;
} {
  if (!roast) {
    return { url: null, score: null, screenshotUrl: null, hook: null };
  }

  const critique = normalizeCritique(roast.critique);
  // Legacy roasts predate `hook`, so they fall back through the sign-off to
  // the opening — worse hooks, but never a blank card.
  const headline =
    critique && (critique.hook ?? critique.zinger ?? critique.opening);

  return {
    url: roast.url,
    score: roast.score,
    screenshotUrl: roast.screenshotUrl,
    hook: headline ? stripEmphasis(headline) : null,
  };
}

/**
 * Filled stars only, as emoji. next/og renders emoji through Twemoji, so a
 * filled star is guaranteed a glyph; the hollow ☆ is an ordinary text
 * character with no such guarantee, and a row of tofu boxes on a share card
 * is worse than showing the count alongside.
 */
function starRow(score: number): string {
  return "⭐".repeat(survivalStars(score));
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Cuts at the last full word within the budget rather than a raw character
 * count — a plain slice can land mid-word (e.g. "forcing po…" from
 * "…forcing poor readability"), which reads as broken rather than trimmed.
 * Falls back to a hard cut only if there's no reasonable word boundary
 * (e.g. one very long word), so this can't regress into never truncating.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const safeCut = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${safeCut.trimEnd()}…`;
}

/**
 * For actual roast critique text specifically (not hostnames, which
 * `truncate()` above still handles) — a critique cut off mid-sentence is
 * unreadable in a static image the viewer can't scroll or click "more" on,
 * so this always keeps at least one full sentence, even if that runs over
 * `targetChars`, rather than ever fragmenting one. Adds more complete
 * sentences only while they still fit. No ellipsis: real sentences already
 * end in ./!/?, and appending "…" after that looks broken, not trimmed.
 */
function firstSentences(text: string, targetChars: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g) ?? [text];
  let result = "";
  for (const sentence of sentences) {
    const next = result + sentence;
    if (result && next.trim().length > targetChars) break;
    result = next;
  }
  return result.trim() || text.trim();
}

/**
 * Shared JSX tree for the roast OG/Twitter card image, rendered via
 * next/og's ImageResponse (Satori) — hence the explicit `display: flex`
 * on every container: Satori only lays out flex, not block, children.
 */
export function RoastOgImage({
  url,
  score,
  headline,
}: {
  url: string | null;
  score: number | null;
  headline: string | null;
}) {
  const bucket = score !== null ? scoreBucket(score) : null;
  const style = bucket ? STATUS_STYLES[bucket] : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 55%, #431407 100%)",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 36 }}>🔥</span>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 6,
            color: "#fb923c",
          }}
        >
          NEXROAST
        </span>
      </div>

      {url ? (
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {score !== null && style && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  border: `10px solid ${style.hex}`,
                  backgroundColor: "rgba(255,255,255,0.04)",
                }}
              >
                <span
                  style={{ fontSize: 80, fontWeight: 800, color: "#ffffff" }}
                >
                  {score}
                </span>
                <span
                  style={{ fontSize: 24, fontWeight: 700, color: "#a3a3a3" }}
                >
                  /100
                </span>
              </div>
              <span style={{ display: "flex", fontSize: 26 }}>
                {starRow(score)}
              </span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#ffffff",
                maxWidth: 820,
              }}
            >
              {truncate(hostnameOf(url), 45)}
            </span>
            {headline && (
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 500,
                  color: "#e5e5e5",
                  maxWidth: 820,
                  lineHeight: 1.35,
                }}
              >
                &ldquo;{firstSentences(headline, 130)}&rdquo;
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 56, fontWeight: 800, color: "#ffffff" }}>
            Get your website roasted.
          </span>
          <span style={{ fontSize: 28, fontWeight: 500, color: "#a3a3a3" }}>
            A free, brutally honest AI critique — screenshot, score, and all.
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 600, color: "#737373" }}>
          {url ? "nexroast.app" : "Free. No signup. Brutal honesty guaranteed."}
        </span>
        {style && (
          <span
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              color: style.hex,
            }}
          >
            {style.label}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Vertical (9:16) share card, built to be dropped into a TikTok/Reels video
 * as a background clip rather than posted as a static image — so the layout
 * is organised around the platform's furniture, not around looking balanced
 * in isolation:
 *
 * - The top ~120px and bottom ~420px are left clear. TikTok overlays the
 *   caption, username, sound title and the engagement rail over those bands,
 *   and anything placed there gets covered on playback.
 * - Everything readable sits in the middle third, in the order a viewer
 *   processes it: who is being roasted, the evidence, the number, then the
 *   line worth stopping for.
 * - The hook is set at 54px because it has to survive being watched at
 *   phone size, half-attention, with the sound off.
 * - The persona and sign-off are dropped entirely. They are good on the
 *   page and they are clutter here — a hook competing with two other pieces
 *   of copy stops being a hook.
 */
export function RoastTikTokImage({
  url,
  score,
  screenshotUrl,
  hook,
  logoUrl,
}: {
  url: string | null;
  score: number | null;
  screenshotUrl: string | null;
  hook: string | null;
  logoUrl: string;
}) {
  const bucket = score !== null ? scoreBucket(score) : null;
  const style = bucket ? STATUS_STYLES[bucket] : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Centred within the padding box rather than pinned to the top, so
        // the block stays balanced whether or not there's a screenshot to
        // show. The asymmetric padding is the safe area, not styling.
        justifyContent: "center",
        padding: "110px 60px 380px",
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "linear-gradient(165deg, #0a0a0a 0%, #0a0a0a 48%, #2c1006 78%, #4a1608 100%)",
        fontFamily: "sans-serif",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginBottom: 44,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by
        Satori (next/og's ImageResponse), which has no next/image support */}
        <img
          src={logoUrl}
          alt=""
          width={78}
          height={78}
          style={{ borderRadius: 39 }}
        />
        <span
          style={{
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: 7,
            color: "#ffffff",
          }}
        >
          NEXROAST
        </span>
      </div>

      {url ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          <span
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 4,
              color: "#fb923c",
              marginBottom: 14,
            }}
          >
            WE ROASTED
          </span>
          <span
            style={{
              fontSize: 46,
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: 30,
            }}
          >
            {truncate(hostnameOf(url), 30)}
          </span>

          {screenshotUrl && (
            <div
              style={{
                display: "flex",
                width: 960,
                height: 500,
                borderRadius: 22,
                overflow: "hidden",
                border: "4px solid rgba(255,255,255,0.14)",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Satori again */}
              <img
                src={screenshotUrl}
                alt=""
                width={960}
                height={500}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </div>
          )}

          {score !== null && style && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 26,
                marginTop: 34,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  padding: "14px 34px",
                  borderRadius: 20,
                  border: `5px solid ${style.hex}`,
                  backgroundColor: "rgba(255,255,255,0.04)",
                }}
              >
                <span
                  style={{ fontSize: 74, fontWeight: 800, color: "#ffffff" }}
                >
                  {score}
                </span>
                <span
                  style={{ fontSize: 30, fontWeight: 700, color: "#a3a3a3" }}
                >
                  /100
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "flex", fontSize: 34 }}>
                    {starRow(score)}
                  </span>
                  {/* The count in words, because only the filled stars are
                      drawn — without it a two-star rating is just two stars
                      with no scale to read them against. */}
                  <span
                    style={{
                      display: "flex",
                      fontSize: 26,
                      fontWeight: 700,
                      color: "#a3a3a3",
                    }}
                  >
                    {survivalStars(score)}/{SURVIVAL_MAX} SURVIVAL
                  </span>
                </div>
                <span
                  style={{
                    display: "flex",
                    fontSize: 28,
                    fontWeight: 700,
                    color: style.hex,
                  }}
                >
                  {style.label.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {hook && (
            <div
              style={{
                display: "flex",
                marginTop: 40,
                maxWidth: 960,
                padding: "34px 40px",
                borderRadius: 22,
                borderLeft: "10px solid #f97316",
                backgroundColor: "rgba(249,115,22,0.10)",
              }}
            >
              <span
                style={{
                  fontSize: 54,
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.25,
                  textAlign: "left",
                }}
              >
                &ldquo;{firstSentences(hook, 150)}&rdquo;
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          <span style={{ fontSize: 72, fontWeight: 800, color: "#ffffff" }}>
            Get your website roasted.
          </span>
          <span style={{ fontSize: 36, fontWeight: 500, color: "#a3a3a3" }}>
            A free, brutally honest AI critique.
          </span>
        </div>
      )}

      {/* Sits directly under the content rather than pinned to the bottom of
          the canvas — the bottom of the frame belongs to TikTok's own UI. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          marginTop: 48,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 3,
            color: "#fb923c",
          }}
        >
          ROAST YOURS FREE
        </span>
        <span style={{ fontSize: 28, fontWeight: 600, color: "#a3a3a3" }}>
          link in bio
        </span>
      </div>
    </div>
  );
}
