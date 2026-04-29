import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PerformanceReportData } from "@/lib/principal-performance-report";

// Styles mirror assessment-results-pdf.tsx so printed reports from the
// principal portal share a consistent look and feel.
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  headerCollege: {
    fontSize: 18,
    textAlign: "center",
    color: "#312e81",
    marginBottom: 4,
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: 12,
    textAlign: "center",
    color: "#374151",
    marginBottom: 12,
  },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { width: "28%", color: "#6b7280" },
  metaValue: { width: "72%", color: "#111827" },
  sectionTitle: {
    fontSize: 11,
    marginTop: 14,
    marginBottom: 6,
    color: "#1e1b4b",
    fontWeight: "bold",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#9ca3af",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold",
    backgroundColor: "#f9fafb",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 3,
  },
  // Column widths sum to 100%.
  colTitle: { width: "26%" },
  colSubject: { width: "14%" },
  colProgram: { width: "16%" },
  colBatch: { width: "12%" },
  colType: { width: "8%" },
  colNumSmall: { width: "8%", textAlign: "right" },
  colNum: { width: "8%", textAlign: "right" },
  cellText: { paddingRight: 4 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
  emptyState: {
    marginTop: 24,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 11,
  },
  summaryRow: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#9ca3af",
    flexDirection: "row",
  },
  summaryLabel: { width: "66%", fontWeight: "bold", color: "#1e1b4b" },
});

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PerformanceReportPdf({ data }: { data: PerformanceReportData }) {
  const { collegeName, generatedAt, filters, rows } = data;

  // Totals on the summary row. These are attempt-level counts (same as the
  // table), not student-level counts, so they match the row values.
  const totals = rows.reduce(
    (acc, r) => {
      acc.students += r.totalStudents;
      acc.passed += r.passed;
      acc.failed += r.failed;
      return acc;
    },
    { students: 0, passed: 0, failed: 0 }
  );
  const overallAvg =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.avgScore, 0) / rows.length)
      : 0;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.headerCollege}>{collegeName}</Text>
        <Text style={styles.headerTitle}>Performance by Assessment</Text>

        <View style={{ marginBottom: 8 }}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Program</Text>
            <Text style={styles.metaValue}>{filters.program.name ?? "All"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Batch</Text>
            <Text style={styles.metaValue}>{filters.batch.name ?? "All"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Subject</Text>
            <Text style={styles.metaValue}>{filters.subject.name ?? "All"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Student</Text>
            <Text style={styles.metaValue}>{filters.student.name ?? "All"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Report generated</Text>
            <Text style={styles.metaValue}>{fmt(generatedAt)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Results ({rows.length} assessments)</Text>

        <View style={styles.tableHeader}>
          <Text style={styles.colTitle}>Assessment</Text>
          <Text style={styles.colSubject}>Subject</Text>
          <Text style={styles.colProgram}>Program</Text>
          <Text style={styles.colBatch}>Batch</Text>
          <Text style={styles.colType}>Type</Text>
          <Text style={styles.colNumSmall}>Students</Text>
          <Text style={styles.colNum}>Passed</Text>
          <Text style={styles.colNum}>Failed</Text>
          <Text style={styles.colNum}>Avg %</Text>
        </View>

        {rows.length === 0 ? (
          <Text style={styles.emptyState}>
            No assessments match the selected filters.
          </Text>
        ) : (
          rows.map((r) => (
            <View key={r.id} style={styles.tableRow} wrap={false}>
              <Text style={[styles.colTitle, styles.cellText]}>{r.title}</Text>
              <Text style={[styles.colSubject, styles.cellText]}>{r.subject}</Text>
              <Text style={[styles.colProgram, styles.cellText]}>{r.program}</Text>
              <Text style={[styles.colBatch, styles.cellText]}>{r.batch}</Text>
              <Text style={[styles.colType, styles.cellText]}>{r.type}</Text>
              <Text style={styles.colNumSmall}>{r.totalStudents}</Text>
              <Text style={styles.colNum}>{r.passed}</Text>
              <Text style={styles.colNum}>{r.failed}</Text>
              <Text style={styles.colNum}>{r.avgScore}%</Text>
            </View>
          ))
        )}

        {rows.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Totals</Text>
            <Text style={styles.colNumSmall}>{totals.students}</Text>
            <Text style={styles.colNum}>{totals.passed}</Text>
            <Text style={styles.colNum}>{totals.failed}</Text>
            <Text style={styles.colNum}>{overallAvg}%</Text>
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
