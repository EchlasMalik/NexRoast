import type { Critique } from "@/lib/critique";
import { CritiqueSchema } from "@/lib/critique";
import { scoreBucket, STATUS_STYLES } from "@/lib/score-style";

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

  const parsed = CritiqueSchema.safeParse(roast.critique);
  return {
    url: roast.url,
    score: roast.score,
    headline: parsed.success
      ? (parsed.data.roastPoints[0]?.critique ?? null)
      : null,
  };
}

type RoastPoint = Critique["roastPoints"][number];

const CATEGORY_META: Record<
  RoastPoint["category"],
  { label: string; icon: string }
> = {
  design: { label: "Design", icon: "🎨" },
  ux: { label: "UX", icon: "🧭" },
  conversion: { label: "Conversion", icon: "💸" },
  speed: { label: "Speed", icon: "⚡" },
  trust: { label: "Trust", icon: "🛡️" },
};

/**
 * Props for the TikTok share card — needs more than the OG card (the
 * screenshot, more than one roast point) since it's meant to stand on its
 * own as content, not just caption a link. Capped at 2 roast points, same as
 * FREE_ROAST_POINTS in components/roast-status.tsx: this is promotional
 * material, not a way to leak what's behind the paywall.
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
  roastPoints: RoastPoint[];
} {
  if (!roast) {
    return { url: null, score: null, screenshotUrl: null, roastPoints: [] };
  }

  const parsed = CritiqueSchema.safeParse(roast.critique);
  return {
    url: roast.url,
    score: roast.score,
    screenshotUrl: roast.screenshotUrl,
    roastPoints: parsed.success ? parsed.data.roastPoints.slice(0, 2) : [],
  };
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
                justifyContent: "center",
                width: 220,
                height: 220,
                borderRadius: 110,
                border: `10px solid ${style.hex}`,
                backgroundColor: "rgba(255,255,255,0.04)",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 80, fontWeight: 800, color: "#ffffff" }}>
                {score}
              </span>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#a3a3a3" }}>
                /100
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
 * Vertical (9:16) share card meant to be saved and dropped straight into a
 * TikTok/Reels video as visual content — not a link-preview card, so unlike
 * RoastOgImage above it stands on its own: it shows the actual screenshot,
 * a real "roast summary" pull-quote (not just a fact card), and a second
 * roast point as its own distinct "still needs work" section. No URL is
 * shown — a video has nothing to tap, so the CTA points at the bio link
 * instead, which is how creators actually drive traffic on this platform.
 */
export function RoastTikTokImage({
  url,
  score,
  screenshotUrl,
  roastPoints,
}: {
  url: string | null;
  score: number | null;
  screenshotUrl: string | null;
  roastPoints: RoastPoint[];
}) {
  const bucket = score !== null ? scoreBucket(score) : null;
  const style = bucket ? STATUS_STYLES[bucket] : null;
  const [summaryPoint, secondPoint] = roastPoints;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        // Asymmetric bottom padding is deliberate: TikTok's own UI (caption,
        // sound title, engagement buttons) typically overlays roughly the
        // bottom fifth of the screen when this is used as a video
        // background, so the CTA needs real clearance above that, not just
        // even padding.
        padding: "48px 56px 360px",
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "linear-gradient(160deg, #0a0a0a 0%, #0a0a0a 55%, #431407 100%)",
        fontFamily: "sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 34 }}>🔥</span>
        <span
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 6,
            color: "#fb923c",
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
            gap: 28,
            width: "100%",
          }}
        >
          {screenshotUrl && (
            <div
              style={{
                display: "flex",
                width: 968,
                height: 605,
                borderRadius: 16,
                overflow: "hidden",
                border: "3px solid rgba(255,255,255,0.15)",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered by
              Satori (next/og's ImageResponse), which has no next/image support */}
              <img
                src={screenshotUrl}
                alt=""
                width={968}
                height={605}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {score !== null && style && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  border: `10px solid ${style.hex}`,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{ fontSize: 56, fontWeight: 800, color: "#ffffff" }}
                >
                  {score}
                </span>
                <span
                  style={{ fontSize: 20, fontWeight: 700, color: "#a3a3a3" }}
                >
                  /100
                </span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              {style && (
                <span
                  style={{
                    display: "flex",
                    fontSize: 30,
                    fontWeight: 700,
                    color: style.hex,
                  }}
                >
                  🔥 {style.label}
                </span>
              )}
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: "#ffffff",
                  maxWidth: 700,
                }}
              >
                {truncate(hostnameOf(url), 28)}
              </span>
            </div>
          </div>

          {summaryPoint && (
            <span
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: "#ffffff",
                maxWidth: 950,
                lineHeight: 1.35,
              }}
            >
              &ldquo;{firstSentences(summaryPoint.critique, 150)}&rdquo;
            </span>
          )}

          {secondPoint && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                maxWidth: 950,
                padding: "24px 32px",
                borderRadius: 16,
                border: "2px solid rgba(251,146,60,0.4)",
                backgroundColor: "rgba(251,146,60,0.08)",
              }}
            >
              <span
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: "#fb923c",
                }}
              >
                {CATEGORY_META[secondPoint.category].icon} ALSO NEEDS WORK:{" "}
                {CATEGORY_META[secondPoint.category].label.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 500,
                  color: "#e5e5e5",
                  lineHeight: 1.35,
                }}
              >
                {firstSentences(secondPoint.critique, 150)}
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
            gap: 16,
          }}
        >
          <span style={{ fontSize: 64, fontWeight: 800, color: "#ffffff" }}>
            Get your website roasted.
          </span>
          <span style={{ fontSize: 34, fontWeight: 500, color: "#a3a3a3" }}>
            A free, brutally honest AI critique.
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 40 }}>👆</span>
        <span
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: "#ffffff",
            maxWidth: 820,
            lineHeight: 1.3,
          }}
        >
          Click the link in bio for your free website roast
        </span>
      </div>
    </div>
  );
}
