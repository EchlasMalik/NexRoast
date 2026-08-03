import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { DisplayCritique } from "@/lib/critique";
import { parseRichText } from "@/lib/rich-text";
import {
  scoreBucket,
  STATUS_STYLES,
  SURVIVAL_LABELS,
  SURVIVAL_MAX,
  survivalStars,
} from "@/lib/score-style";

// Single source of truth shared with components/roast-status.tsx's "book a
// call" CTA — both read the same env var rather than hardcoding the URL in
// two places.
const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL;

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#171717",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  wordmark: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: "#ea580c",
  },
  meta: {
    fontSize: 9,
    color: "#737373",
  },
  urlLine: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
  },
  scoreBadge: {
    borderWidth: 3,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  scoreNumber: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
  },
  scoreOutOf: {
    fontSize: 11,
    color: "#737373",
  },
  statusLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  survivalLine: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: "#737373",
    marginBottom: 20,
  },
  screenshot: {
    width: "100%",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  persona: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
  },
  personaMeta: {
    fontSize: 9,
    color: "#737373",
    marginBottom: 14,
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 10,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  italic: {
    fontFamily: "Helvetica-Oblique",
  },
  zinger: {
    fontSize: 11,
    fontFamily: "Helvetica-Oblique",
    lineHeight: 1.6,
    color: "#525252",
    marginBottom: 10,
  },
  winCard: {
    borderWidth: 1,
    borderColor: "#fdba74",
    backgroundColor: "#fff7ed",
    borderRadius: 6,
    padding: 14,
    marginTop: 10,
    marginBottom: 32,
  },
  winLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: "#c2410c",
    marginBottom: 4,
  },
  ctaBox: {
    borderTopWidth: 2,
    borderTopColor: "#171717",
    paddingTop: 16,
  },
  ctaHeading: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  ctaBody: {
    fontSize: 11,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  ctaContact: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ea580c",
  },
  ctaButton: {
    alignSelf: "flex-start",
    backgroundColor: "#ea580c",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  ctaButtonText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#a3a3a3",
    textAlign: "center",
  },
});

/**
 * The same `**bold**` / `*italic*` subset the web report renders, mapped onto
 * react-pdf's nested <Text> and the built-in Helvetica variants — so emphasis
 * survives the export instead of the PDF showing raw asterisks.
 */
function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((part, index) => {
        if (part.type === "bold") {
          return (
            <Text key={index} style={styles.bold}>
              {part.text}
            </Text>
          );
        }
        if (part.type === "italic") {
          return (
            <Text key={index} style={styles.italic}>
              {part.text}
            </Text>
          );
        }
        return <Text key={index}>{part.text}</Text>;
      })}
    </>
  );
}

export function RoastReportDocument({
  url,
  score,
  critique,
  screenshotUrl,
  generatedAt,
}: {
  url: string;
  score: number;
  critique: DisplayCritique;
  screenshotUrl: string | null;
  generatedAt: Date;
}) {
  const style = STATUS_STYLES[scoreBucket(score)];
  const stars = survivalStars(score);

  return (
    <Document title={`NexRoast Full Report — ${url}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.wordmark}>NEXROAST — FULL REPORT</Text>
          <Text style={styles.meta}>
            Generated {generatedAt.toLocaleDateString("en-GB")}
          </Text>
        </View>

        <Text style={styles.urlLine}>{url}</Text>

        <View style={styles.scoreRow}>
          <View style={[styles.scoreBadge, { borderColor: style.hex }]}>
            <Text style={styles.scoreNumber}>
              {score}
              <Text style={styles.scoreOutOf}> /100</Text>
            </Text>
          </View>
          <Text style={[styles.statusLabel, { color: style.hex }]}>
            {style.label}
          </Text>
        </View>
        <Text style={styles.survivalLine}>
          SURVIVAL RATING {stars}/{SURVIVAL_MAX} — {SURVIVAL_LABELS[stars]}
        </Text>

        {screenshotUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no `alt` prop
          <Image style={styles.screenshot} src={screenshotUrl} />
        )}

        <Text style={styles.persona}>{critique.persona}</Text>
        <Text style={styles.personaMeta}>NexRoast v2.0 — Brutal Mode</Text>
        <View style={styles.rule} />

        <Text style={styles.paragraph}>
          <RichText text={critique.opening} />
        </Text>

        {critique.roastParagraphs.map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            <RichText text={paragraph} />
          </Text>
        ))}

        {critique.silverLining && (
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>The silver lining? </Text>
            <RichText text={critique.silverLining} />
          </Text>
        )}

        {critique.zinger && (
          <Text style={styles.zinger}>{critique.zinger}</Text>
        )}

        <View style={styles.winCard}>
          <Text style={styles.winLabel}>BIGGEST WIN</Text>
          <Text style={styles.paragraph}>
            <RichText text={critique.biggestWin} />
          </Text>
        </View>

        <View style={styles.ctaBox}>
          <Text style={styles.ctaHeading}>
            Want this fixed, not just diagnosed?
          </Text>
          <Text style={styles.ctaBody}>
            Nexiora Studio builds fast, high-converting websites — and we
            already know exactly what&apos;s holding this one back. Book a free
            call and we&apos;ll turn this list into a plan.
          </Text>
          {CALENDLY_URL && (
            <Link src={CALENDLY_URL} style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>Book a free call →</Text>
            </Link>
          )}
          <Text style={styles.ctaContact}>echlas@nexiorastudio.com</Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `NexRoast — ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
