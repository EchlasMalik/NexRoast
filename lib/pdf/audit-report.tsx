import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { bandFor, CATEGORIES, type CategoryKey } from "@/lib/audit/categories";
import type { PublicAudit } from "@/lib/audit/public";

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL;
const AGENCY_URL = "https://nexiorastudio.com";

const styles = StyleSheet.create({
  page: {
    padding: 44,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: "#171717",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  wordmark: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: "#c2410c",
  },
  meta: { fontSize: 8.5, color: "#737373" },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  host: { fontSize: 10, color: "#737373", marginBottom: 16 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 8,
  },
  scoreBadge: {
    borderWidth: 3,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  scoreNumber: { fontSize: 26, fontFamily: "Helvetica-Bold" },
  scoreOutOf: { fontSize: 10, color: "#737373" },
  bandLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  summary: {
    fontSize: 11,
    lineHeight: 1.55,
    marginBottom: 18,
    color: "#404040",
  },
  screenshot: {
    width: "100%",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.4,
    color: "#737373",
    marginBottom: 8,
    marginTop: 6,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  categoryLabel: { width: 120, fontSize: 10 },
  track: { flex: 1, height: 7, backgroundColor: "#e7e5e4", borderRadius: 4 },
  fill: { height: 7, backgroundColor: "#c2410c", borderRadius: 4 },
  categoryScore: {
    width: 28,
    textAlign: "right",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  issue: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 6,
    padding: 11,
    marginBottom: 9,
  },
  issueHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  issueTitle: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    flex: 1,
    paddingRight: 8,
  },
  impact: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#c2410c" },
  issueMeta: { fontSize: 8.5, color: "#737373", marginBottom: 5 },
  body: { fontSize: 10, lineHeight: 1.5, marginBottom: 4 },
  recommendation: {
    fontSize: 10,
    lineHeight: 1.5,
    backgroundColor: "#fff7ed",
    borderLeftWidth: 2,
    borderLeftColor: "#fdba74",
    paddingLeft: 8,
    paddingVertical: 5,
    marginTop: 4,
  },
  copyLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: "#a3a3a3",
    marginTop: 5,
  },
  copyText: { fontSize: 10, lineHeight: 1.45 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 12, fontSize: 10, color: "#0f7a38" },
  ctaBox: {
    borderTopWidth: 2,
    borderTopColor: "#171717",
    paddingTop: 14,
    marginTop: 18,
  },
  ctaHeading: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  ctaBody: { fontSize: 10, lineHeight: 1.5, marginBottom: 8 },
  ctaButton: {
    alignSelf: "flex-start",
    backgroundColor: "#c2410c",
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  ctaButtonText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  contact: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#c2410c" },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: "#a3a3a3",
    textAlign: "center",
  },
});

const SEVERITY_LABEL = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;

/**
 * The downloadable audit. Written to be something a business could forward to
 * whoever builds their site without editing it first — so it leads with the
 * score and the summary, then the prioritised issues with their exact fixes.
 */
export function AuditReportDocument({
  audit,
  generatedAt,
}: {
  audit: PublicAudit;
  generatedAt: Date;
}) {
  const { report } = audit;
  const band = bandFor(report.overallScore);
  const applicable = report.categories.filter(
    (category) => category.applicable,
  );

  return (
    <Document title={`NexRoast Website Audit — ${audit.displayName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.wordmark}>NEXROAST — WEBSITE AUDIT</Text>
          <Text style={styles.meta}>
            {generatedAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        <Text style={styles.name}>{audit.displayName}</Text>
        <Text style={styles.host}>
          {audit.url}
          {report.businessType ? ` — ${report.businessType}` : ""}
        </Text>

        <View style={styles.scoreRow}>
          <View style={[styles.scoreBadge, { borderColor: band.hex }]}>
            <Text style={styles.scoreNumber}>
              {report.overallScore}
              <Text style={styles.scoreOutOf}> / 100</Text>
            </Text>
          </View>
          <Text style={[styles.bandLabel, { color: band.hex }]}>
            {band.label}
          </Text>
        </View>

        <Text style={styles.summary}>{report.summary}</Text>

        {audit.screenshotUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no `alt`
          <Image style={styles.screenshot} src={audit.screenshotUrl} />
        )}

        <Text style={styles.sectionTitle}>SCORES BY AREA</Text>
        {applicable.map((category) => (
          <View key={category.key} style={styles.categoryRow}>
            <Text style={styles.categoryLabel}>
              {CATEGORIES[category.key as CategoryKey].label}
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.max(2, category.score)}%` },
                ]}
              />
            </View>
            <Text style={styles.categoryScore}>{category.score}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>BIGGEST OPPORTUNITIES</Text>
        {report.issues.map((issue, index) => (
          <View key={issue.id} style={styles.issue} wrap={false}>
            <View style={styles.issueHead}>
              <Text style={styles.issueTitle}>
                {String(index + 1).padStart(2, "0")}. {issue.title}
              </Text>
              <Text style={styles.impact}>Impact {issue.impact}/10</Text>
            </View>
            <Text style={styles.issueMeta}>
              {CATEGORIES[issue.category as CategoryKey].label} ·{" "}
              {SEVERITY_LABEL[issue.severity]} ·{" "}
              {issue.effort === "quick"
                ? "Quick fix"
                : issue.effort === "moderate"
                  ? "Moderate"
                  : "Larger job"}
            </Text>
            <Text style={styles.body}>{issue.problem}</Text>
            <Text style={styles.body}>{issue.whyItMatters}</Text>
            <Text style={styles.recommendation}>{issue.recommendation}</Text>

            {issue.recommendedCopy && (
              <View>
                {issue.currentCopy && (
                  <View>
                    <Text style={styles.copyLabel}>CURRENT</Text>
                    <Text style={[styles.copyText, { color: "#737373" }]}>
                      {issue.currentCopy}
                    </Text>
                  </View>
                )}
                <Text style={styles.copyLabel}>SUGGESTED</Text>
                <Text style={styles.copyText}>{issue.recommendedCopy}</Text>
              </View>
            )}
          </View>
        ))}

        {report.strengths.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>WHAT&apos;S ALREADY WORKING</Text>
            {report.strengths.map((strength, index) => (
              <View key={index} style={styles.bullet}>
                <Text style={styles.bulletMark}>+</Text>
                <Text style={[styles.body, { flex: 1 }]}>{strength}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>WHERE TO START</Text>
        <Text style={styles.body}>{report.biggestOpportunity}</Text>
        {report.suggestedActions.map((action, index) => (
          <View key={index} style={styles.bullet}>
            <Text style={[styles.bulletMark, { color: "#a3a3a3" }]}>
              {index + 1}.
            </Text>
            <Text style={[styles.body, { flex: 1 }]}>{action}</Text>
          </View>
        ))}

        <View style={styles.ctaBox}>
          <Text style={styles.ctaHeading}>Want these fixed for you?</Text>
          <Text style={styles.ctaBody}>
            Nexiora Studio builds high-converting websites and custom software
            for service businesses. We can take the recommendations in this
            audit and implement them properly.
          </Text>
          {CALENDLY_URL && (
            <Link src={CALENDLY_URL} style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>
                Get a free website consultation
              </Text>
            </Link>
          )}
          <Link src={AGENCY_URL}>
            <Text style={styles.contact}>nexiorastudio.com</Text>
          </Link>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `NexRoast website audit — ${audit.host} — ${pageNumber} / ${totalPages}. Automated review of one page; not a substitute for a full audit.`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
