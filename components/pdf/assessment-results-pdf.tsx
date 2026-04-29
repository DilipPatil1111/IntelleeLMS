import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AssessmentResultsReportData } from "@/lib/assessment-detailed-results";
import { effectiveAssessmentDateForDisplay } from "@/lib/utils";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  headerCollege: { fontSize: 18, textAlign: "center", color: "#312e81", marginBottom: 4, fontWeight: "bold" },
  headerTitle: { fontSize: 12, textAlign: "center", color: "#374151", marginBottom: 16 },
  metaRow: { flexDirection: "row", marginBottom: 3 },
  metaLabel: { width: "28%", color: "#6b7280" },
  metaValue: { width: "72%", color: "#111827" },
  sectionTitle: { fontSize: 11, marginTop: 12, marginBottom: 6, color: "#1e1b4b", fontWeight: "bold" },
  studentBlock: { marginBottom: 14, padding: 10, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4 },
  studentName: { fontSize: 11, fontWeight: "bold", marginBottom: 4, color: "#111827" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#9ca3af",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold",
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 3 },
  colQ: { width: "6%" },
  colTxt: { width: "34%" },
  colAns: { width: "22%" },
  colCorr: { width: "18%" },
  colMk: { width: "10%" },
  colOk: { width: "10%" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#9ca3af" },
  pass: { color: "#15803d" },
  fail: { color: "#b91c1c" },
  pending: { color: "#a16207" },
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

export function AssessmentResultsPdf({ data }: { data: AssessmentResultsReportData }) {
  const { assessment, studentResults, collegeName, generatedAt } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.headerCollege}>{collegeName}</Text>
        <Text style={styles.headerTitle}>Assessment results — student-wise report</Text>

        <View style={{ marginBottom: 12 }}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Assessment</Text>
            <Text style={styles.metaValue}>{assessment.title}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Type</Text>
            <Text style={styles.metaValue}>{assessment.type}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Program / Batch</Text>
            <Text style={styles.metaValue}>
              {assessment.programName} — {assessment.batchName}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Subject</Text>
            <Text style={styles.metaValue}>{assessment.subjectName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Total marks / Pass</Text>
            <Text style={styles.metaValue}>
              {assessment.totalMarks} marks
              {assessment.passingMarks != null ? ` — pass at ${assessment.passingMarks} marks` : " — pass threshold 50% score"}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Duration (allowed)</Text>
            <Text style={styles.metaValue}>
              {assessment.durationMinutes != null ? `${assessment.durationMinutes} minutes` : "Unlimited"}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Assessment date</Text>
            <Text style={styles.metaValue}>
              {fmt(
                String(
                  effectiveAssessmentDateForDisplay(assessment.assessmentDate, assessment.createdAt)
                )
              )}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Teacher (creator)</Text>
            <Text style={styles.metaValue}>{assessment.creatorName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Report generated</Text>
            <Text style={styles.metaValue}>{fmt(generatedAt)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Summary ({studentResults.length} students)</Text>
        {studentResults.map((s) => (
          <View key={s.attemptId} wrap={false} style={{ marginBottom: 6 }}>
            <Text>
              • {s.studentName}
              {s.enrollmentNo ? ` (${s.enrollmentNo})` : ""} — Score:{" "}
              {s.totalScore != null ? `${s.totalScore}/${assessment.totalMarks}` : "—"} (
              {s.percentage != null ? `${s.percentage}%` : "—"}) —{" "}
              <Text
                style={
                  s.passFail === "PASS"
                    ? styles.pass
                    : s.passFail === "FAIL"
                      ? styles.fail
                      : styles.pending
                }
              >
                {s.passFail}
              </Text>
            </Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {studentResults.map((s) => (
        <Page key={s.attemptId} size="A4" style={styles.page}>
          <Text style={styles.headerCollege}>{collegeName}</Text>
          <Text style={[styles.headerTitle, { marginBottom: 10 }]}>{assessment.title}</Text>

          <View style={styles.studentBlock}>
            <Text style={styles.studentName}>{s.studentName}</Text>
            <Text style={{ marginBottom: 2 }}>
              Enrollment: {s.enrollmentNo || "—"} | Assessment date:{" "}
              {fmt(
                String(
                  effectiveAssessmentDateForDisplay(assessment.assessmentDate, assessment.createdAt)
                )
              )}
            </Text>
            <Text style={{ marginBottom: 2 }}>
              Time spent: {s.durationMinutes != null ? `${s.durationMinutes} min` : "—"} | Status: {s.attemptStatus}
            </Text>
            <Text style={{ marginBottom: 2 }}>
              Score: {s.totalScore != null ? `${s.totalScore} / ${assessment.totalMarks}` : "—"} | %:{" "}
              {s.percentage ?? "—"} | Result:{" "}
              <Text
                style={
                  s.passFail === "PASS" ? styles.pass : s.passFail === "FAIL" ? styles.fail : styles.pending
                }
              >
                {s.passFail}
              </Text>
            </Text>
          </View>

          <View style={styles.tableHeader}>
            <Text style={styles.colQ}>#</Text>
            <Text style={styles.colTxt}>Question</Text>
            <Text style={styles.colAns}>Student answer</Text>
            <Text style={styles.colCorr}>Expected / key</Text>
            <Text style={styles.colMk}>Marks</Text>
            <Text style={styles.colOk}>OK?</Text>
          </View>
          {s.questions.map((q) => (
            <View key={q.orderIndex} style={styles.tableRow}>
              <Text style={styles.colQ}>{q.orderIndex}</Text>
              <Text style={styles.colTxt}>{q.questionText}</Text>
              <Text style={styles.colAns}>{q.studentAnswerDisplay}</Text>
              <Text style={styles.colCorr}>{q.correctAnswerDisplay}</Text>
              <Text style={styles.colMk}>
                {q.score}/{q.maxMarks}
              </Text>
              <Text style={styles.colOk}>
                {q.isCorrect === null ? "—" : q.isCorrect ? "Yes" : "No"}
              </Text>
            </View>
          ))}

          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </Document>
  );
}
