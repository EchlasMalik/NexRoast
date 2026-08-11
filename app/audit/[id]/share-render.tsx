import { bandFor, CATEGORIES, type CategoryKey } from "@/lib/audit/categories";
import type { PublicAudit } from "@/lib/audit/public";

/**
 * The two share cards, in one module.
 *
 * They previously lived in byte-identical `opengraph-image.tsx` and
 * `twitter-image.tsx` files that each ran their own database query for the
 * same row. Both now render from here, and both are fed by one loader.
 *
 * Rendered by Satori (next/og), which lays out flex only — hence the explicit
 * `display: flex` on every container — resolves no external CSS, and needs
 * absolute URLs for images.
 */

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const SOCIAL_IMAGE_SIZE = { width: 1080, height: 1920 };
export const IMAGE_CONTENT_TYPE = "image/png";

export type ShareProps = {
  displayName: string;
  host: string;
  score: number;
  bandLabel: string;
  bandHex: string;
  summary: string;
  headline: string;
  categories: { label: string; score: number }[];
  screenshotUrl: string | null;
  logoUrl: string;
};

/**
 * Only ever built from content that is public on the audit page — these
 * endpoints are reachable by anyone holding an audit id.
 */
export function toShareProps(
  audit: PublicAudit,
  logoUrl: string,
  categoryLimit: number,
): ShareProps {
  const { report } = audit;
  const band = bandFor(report.overallScore);

  return {
    displayName: audit.displayName,
    host: audit.host,
    score: report.overallScore,
    bandLabel: band.label,
    bandHex: band.hex,
    summary: report.summary,
    headline: report.issues[0]?.title ?? report.biggestOpportunity,
    categories: report.categories
      .filter((category) => category.applicable)
      .sort((a, b) => a.score - b.score)
      .slice(0, categoryLimit)
      .map((category) => ({
        label: CATEGORIES[category.key as CategoryKey].short,
        score: category.score,
      })),
    screenshotUrl: audit.screenshotUrl,
    logoUrl,
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function firstSentences(text: string, target: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g) ?? [text];
  let result = "";
  for (const sentence of sentences) {
    const next = result + sentence;
    if (result && next.trim().length > target) break;
    result = next;
  }
  return result.trim() || text.trim();
}

const BG = {
  backgroundColor: "#0a0a0a",
  backgroundImage:
    "linear-gradient(160deg, #0a0a0a 0%, #0a0a0a 52%, #2c1006 80%, #4a1608 100%)",
} as const;

function Wordmark({ logoUrl, size }: { logoUrl: string; size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori has no next/image */}
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: size / 2 }}
      />
      <span
        style={{
          fontSize: size * 0.5,
          fontWeight: 800,
          letterSpacing: size * 0.09,
          color: "#ffffff",
        }}
      >
        NEXROAST
      </span>
    </div>
  );
}

/** Landscape link-preview card. */
export function AuditOgImage(props: ShareProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
        fontFamily: "sans-serif",
        ...BG,
      }}
    >
      <Wordmark logoUrl={props.logoUrl} size={56} />

      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 200,
            height: 200,
            borderRadius: 100,
            border: `10px solid ${props.bandHex}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 76, fontWeight: 800, color: "#ffffff" }}>
            {props.score}
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#a3a3a3" }}>
            / 100
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              color: "#fb923c",
            }}
          >
            WEBSITE AUDIT
          </span>
          <span
            style={{
              fontSize: 46,
              fontWeight: 800,
              color: "#ffffff",
              maxWidth: 760,
            }}
          >
            {truncate(props.displayName, 38)}
          </span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: "#d4d4d4",
              maxWidth: 760,
              lineHeight: 1.35,
            }}
          >
            {firstSentences(props.summary, 130)}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 600, color: "#737373" }}>
          {props.host}
        </span>
        <span
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            color: props.bandHex,
          }}
        >
          {props.bandLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Vertical 9:16 card, built to sit under a phone-shot video rather than to be
 * posted alone. The top ~110px and bottom ~380px stay clear because TikTok
 * overlays the caption, username, sound title and engagement rail there.
 */
export function AuditSocialImage(props: ShareProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "110px 60px 380px",
        textAlign: "center",
        fontFamily: "sans-serif",
        ...BG,
      }}
    >
      <Wordmark logoUrl={props.logoUrl} size={78} />

      <span
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 4,
          color: "#fb923c",
          marginTop: 40,
        }}
      >
        WEBSITE AUDIT
      </span>
      <span
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: "#ffffff",
          marginTop: 12,
          maxWidth: 940,
        }}
      >
        {truncate(props.displayName, 30)}
      </span>

      {props.screenshotUrl && (
        <div
          style={{
            display: "flex",
            width: 900,
            height: 470,
            borderRadius: 20,
            overflow: "hidden",
            border: "4px solid rgba(255,255,255,0.14)",
            marginTop: 30,
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
          <img
            src={props.screenshotUrl}
            alt=""
            width={900}
            height={470}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          marginTop: 34,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            padding: "12px 30px",
            borderRadius: 18,
            border: `5px solid ${props.bandHex}`,
          }}
        >
          <span style={{ fontSize: 68, fontWeight: 800, color: "#ffffff" }}>
            {props.score}
          </span>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#a3a3a3" }}>
            /100
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            textAlign: "left",
          }}
        >
          {props.categories.map((category) => (
            <div
              key={category.label}
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <span
                style={{
                  display: "flex",
                  width: 150,
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#a3a3a3",
                }}
              >
                {category.label}
              </span>
              <span
                style={{
                  display: "flex",
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                {category.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 34,
          maxWidth: 900,
          padding: "26px 32px",
          borderRadius: 20,
          borderLeft: "10px solid #f97316",
          backgroundColor: "rgba(249,115,22,0.10)",
        }}
      >
        <span
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.25,
            textAlign: "left",
          }}
        >
          {truncate(props.headline, 110)}
        </span>
      </div>

      <span
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: 3,
          color: "#fb923c",
          marginTop: 40,
        }}
      >
        AUDIT YOURS FREE — LINK IN BIO
      </span>
    </div>
  );
}
