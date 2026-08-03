import { CritiqueSchema } from "@/lib/critique";
import { scoreBucket, STATUS_STYLES } from "@/lib/score-style";
import { getSiteUrl } from "@/lib/site-url";

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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
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
                &ldquo;{truncate(headline, 130)}&rdquo;
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
 * RoastOgImage above it has no clickable URL to lean on. The domain is shown
 * large and explicitly as "type this in", since a video has no link to tap.
 */
export function RoastTikTokImage({
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
  const siteHost = new URL(getSiteUrl()).host;

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
        padding: "96px 64px 360px",
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "linear-gradient(160deg, #0a0a0a 0%, #0a0a0a 55%, #431407 100%)",
        fontFamily: "sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 48 }}>🔥</span>
        <span
          style={{
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 8,
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
            gap: 40,
          }}
        >
          {score !== null && style && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 420,
                height: 420,
                borderRadius: 210,
                border: `16px solid ${style.hex}`,
                backgroundColor: "rgba(255,255,255,0.04)",
                flexShrink: 0,
              }}
            >
              <span
                style={{ fontSize: 150, fontWeight: 800, color: "#ffffff" }}
              >
                {score}
              </span>
              <span style={{ fontSize: 40, fontWeight: 700, color: "#a3a3a3" }}>
                /100
              </span>
            </div>
          )}

          {style && (
            <span
              style={{
                display: "flex",
                fontSize: 40,
                fontWeight: 700,
                color: style.hex,
              }}
            >
              🔥 {style.label}
            </span>
          )}

          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#ffffff",
              maxWidth: 900,
            }}
          >
            {truncate(hostnameOf(url), 32)}
          </span>

          {headline && (
            <span
              style={{
                fontSize: 38,
                fontWeight: 500,
                color: "#e5e5e5",
                maxWidth: 900,
                lineHeight: 1.4,
              }}
            >
              &ldquo;{truncate(headline, 110)}&rdquo;
            </span>
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
          gap: 8,
        }}
      >
        <span style={{ fontSize: 30, fontWeight: 500, color: "#a3a3a3" }}>
          Get yours roasted free at
        </span>
        <span style={{ fontSize: 46, fontWeight: 800, color: "#ffffff" }}>
          {siteHost}
        </span>
      </div>
    </div>
  );
}
