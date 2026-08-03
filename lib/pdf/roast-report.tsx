import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Critique } from "@/lib/critique";
import { scoreBucket, STATUS_STYLES } from "@/lib/score-style";

// Single source of truth shared with components/roast-status.tsx's "book a
// call" CTA — both read the same env var rather than hardcoding the URL in
// two places.
const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL;

const CATEGORY_LABELS: Record<
  Critique["roastPoints"][number]["category"],
  string
> = {
  design: "Design",
  ux: "UX",
  conversion: "Conversion",
  speed: "Speed",
  trust: "Trust",
};

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
    marginBottom: 20,
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
  screenshot: {
    width: "100%",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  pointCard: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  pointCategory: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: "#ea580c",
    marginBottom: 4,
  },
  pointText: {
    fontSize: 11,
    lineHeight: 1.4,
  },
  winCard: {
    borderWidth: 1,
    borderColor: "#fdba74",
    backgroundColor: "#fff7ed",
    borderRadius: 6,
    padding: 14,
    marginTop: 6,
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

export function RoastReportDocument({
  url,
  score,
  critique,
  screenshotUrl,
  generatedAt,
}: {
  url: string;
  score: number;
  critique: Critique;
  screenshotUrl: string | null;
  generatedAt: Date;
}) {
  const style = STATUS_STYLES[scoreBucket(score)];

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

        {screenshotUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no `alt` prop
          <Image style={styles.screenshot} src={screenshotUrl} />
        )}

        <Text style={styles.sectionTitle}>
          All roast points ({critique.roastPoints.length})
        </Text>
        {critique.roastPoints.map((point, index) => (
          <View key={index} style={styles.pointCard}>
            <Text style={styles.pointCategory}>
              {CATEGORY_LABELS[point.category].toUpperCase()}
            </Text>
            <Text style={styles.pointText}>{point.critique}</Text>
          </View>
        ))}

        <View style={styles.winCard}>
          <Text style={styles.winLabel}>BIGGEST WIN</Text>
          <Text style={styles.pointText}>{critique.biggestWin}</Text>
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
