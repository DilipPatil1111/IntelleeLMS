import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AttendanceReportData } from "@/lib/attendance-report";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  college: { fontSize: 16, textAlign: "center", color: "#312e81", marginBottom: 2, fontWeight: "bold" },
  title: { fontSize: 11, textAlign: "center", color: "#374151", marginBottom: 14 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  metaCell: { width: "50%", flexDirection: "row", marginBottom: 3, paddingRight: 8 },
  metaLabel: { width: "40%", color: "#6b7280", fontSize: 8 },
  metaValue: { width: "60%", color: "#111827", fontSize: 8 },
  summaryBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    backgroundColor: "#f9fafb",
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: "bold", color: "#111827" },
  summaryLabel: { fontSize: 6.5, color: "#6b7280", marginTop: 2, textAlign: "center" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#9ca3af",
    paddingBottom: 4,
    marginBottom: 2,
    fontWeight: "bold",
    fontSize: 8,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  colDate: { width: "13%" },
  colSubject: { width: "28%" },
  colTime: { width: "20%" },
  colHours: { width: "14%", paddingRight: 8 },
  colStatus: { width: "25%" },
  pass: { color: "#15803d" },
  fail: { color: "#b91c1c" },
  late: { color: "#a16207" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 7.5, color: "#9ca3af" },
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", marginVertical: 8 },
});

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function statusStyle(s: string) {
  if (s === "PRESENT" || s === "EXCUSED") return styles.pass;
  if (s === "LATE") return styles.late;
  return styles.fail;
}

function displayStatus(s: string) {
  if (s === "EXCUSED") return "P (Excused)";
  return s;
}

export function AttendanceReportPdf({ data }: { data: AttendanceReportData }) {
  const { summary } = data;

  const metaItems: { label: string; value: string }[] = [
    { label: "Student", value: data.studentName + (data.enrollmentNo ? ` (${data.enrollmentNo})` : "") },
    { label: "Program", value: data.programName },
    ...(data.programType ? [{ label: "Program Type", value: data.programType }] : []),
    ...(data.programCategory ? [{ label: "Category", value: data.programCategory }] : []),
    ...(data.programDuration ? [{ label: "Duration", value: data.programDuration }] : []),
    ...(data.batchName ? [{ label: "Batch", value: data.batchName }] : []),
    {
      label: "Period",
      value: `${data.periodStart ? fmt(data.periodStart) : "—"} to ${data.periodEnd ? fmt(data.periodEnd) : "—"}`,
    },
    { label: "Generated", value: fmt(data.generatedAt) },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.college}>{data.collegeName}</Text>
        <Text style={styles.title}>Student Attendance Report</Text>

        {/* Meta info in 2-column grid */}
        <View style={styles.metaGrid}>
          {metaItems.map((item, i) => (
            <View key={i} style={styles.metaCell}>
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Summary stats */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalSessions}</Text>
            <Text style={styles.summaryLabel}>Sessions</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, styles.pass]}>{summary.present}</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, styles.late]}>{summary.late}</Text>
            <Text style={styles.summaryLabel}>Late</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, styles.fail]}>{summary.absent}</Text>
            <Text style={styles.summaryLabel}>Absent</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.attendanceRate}%</Text>
            <Text style={styles.summaryLabel}>Rate</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalDaysAttended}</Text>
            <Text style={styles.summaryLabel}>Days</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, styles.pass]}>{summary.totalHoursAttended}</Text>
            <Text style={styles.summaryLabel}>Hrs Attended</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalScheduledHours}</Text>
            <Text style={styles.summaryLabel}>Hrs Scheduled</Text>
          </View>
        </View>

        {/* Date-wise table */}
        <View style={styles.tableHeader}>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colSubject}>Subject / Topic</Text>
          <Text style={styles.colTime}>Session Time</Text>
          <Text style={styles.colHours}>Hours</Text>
          <Text style={styles.colStatus}>Status</Text>
        </View>

        {data.rows.map((r, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <Text style={styles.colDate}>{fmt(r.date)}</Text>
            <Text style={styles.colSubject}>{r.subject}</Text>
            <Text style={styles.colTime}>
              {r.startTime || "—"} – {r.endTime || "—"}
            </Text>
            <Text style={styles.colHours}>
              {r.durationMinutes > 0 ? `${(r.durationMinutes / 60).toFixed(1)} hrs` : "—"}
            </Text>
            <Text style={[styles.colStatus, statusStyle(r.status)]}>
              {displayStatus(r.status)}
            </Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
