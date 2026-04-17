import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { TranscriptWithDetails } from "@/lib/transcript";
import type { GradeBandRow } from "@/lib/transcript";

export type TranscriptInstitutionInfo = {
  name: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
};

const INDIGO = "#312e81";
const INDIGO_MID = "#4f46e5";
const GRAY_MED = "#6b7280";
const GRAY_LIGHT = "#e5e7eb";
const GRAY_BG = "#f9fafb";

const styles = StyleSheet.create({
  page: { padding: 44, paddingBottom: 60, fontSize: 9, fontFamily: "Helvetica", color: "#111827", backgroundColor: "#ffffff" },

  /* ── Header ── */
  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  /* Logo box: wide enough for rectangular logos, height matches college name block */
  logoBox: { width: 120, height: 40, marginRight: 10, flexShrink: 0 },
  logoPlaceholder: { width: 40, height: 40, backgroundColor: "#e0e7ff", borderRadius: 20, alignItems: "center", justifyContent: "center" },
  logoInitial: { fontSize: 20, fontWeight: "bold", color: INDIGO },
  headerCenter: { flex: 1, alignItems: "center" },
  collegeName: { fontSize: 16, fontWeight: "bold", color: INDIGO, textAlign: "center" },
  reportTitle: { fontSize: 7.5, color: GRAY_MED, marginTop: 2, letterSpacing: 1, textAlign: "center", textTransform: "uppercase" },
  headerRight: { flexShrink: 0, alignItems: "flex-end", maxWidth: 160 },
  addressLine: { fontSize: 7, color: GRAY_MED, textAlign: "right", lineHeight: 1.6 },

  /* ── Status bar ── */
  statusBar: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 4, marginBottom: 6, gap: 8 },
  dateIssued: { fontSize: 7.5, color: GRAY_MED },
  dateIssuedVal: { fontSize: 7.5, color: "#111827", fontWeight: "bold" },
  statusBadgeDraft: { fontSize: 7, fontWeight: "bold", color: "#92400e", backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgePublished: { fontSize: 7, fontWeight: "bold", color: "#065f46", backgroundColor: "#d1fae5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  /* ── Dividers ── */
  dividerThick: { borderBottomWidth: 2, borderBottomColor: INDIGO_MID, marginBottom: 10 },
  dividerThin: { borderBottomWidth: 0.5, borderBottomColor: GRAY_LIGHT, marginVertical: 6 },

  /* ── Meta grid ── */
  metaGrid: { flexDirection: "row", marginBottom: 10 },
  metaCol: { flex: 1, paddingRight: 14 },
  metaRow: { flexDirection: "row", marginBottom: 3 },
  metaLabel: { width: "42%", color: GRAY_MED, fontSize: 8 },
  metaValue: { width: "58%", color: "#111827", fontSize: 8 },
  metaValueBold: { width: "58%", color: "#111827", fontSize: 8, fontWeight: "bold" },

  /* ── Table ── */
  tableHeader: { flexDirection: "row", backgroundColor: INDIGO, paddingVertical: 5, paddingHorizontal: 8, marginTop: 8 },
  thText: { color: "#fff", fontSize: 8, fontWeight: "bold" },
  tableRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: GRAY_LIGHT, alignItems: "flex-start" },
  tableRowAlt: { backgroundColor: GRAY_BG },

  /* Fixed column widths — minWidth:0 on colDesc stops flex overflow/overlap */
  colCode: { width: 66, flexShrink: 0, paddingRight: 4 },
  colDesc: { flex: 1, minWidth: 0, paddingRight: 6 },
  colMark: { width: 58, flexShrink: 0, textAlign: "right", paddingRight: 8 },
  colGrade: { width: 62, flexShrink: 0, textAlign: "center" },

  /* Grade colours */
  gradePass: { color: "#15803d", fontWeight: "bold" },
  gradeFail: { color: "#b91c1c", fontWeight: "bold" },
  gradeNeutral: { color: GRAY_MED },

  /* ── Summary section ── */
  summarySection: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  summaryLeft: { flex: 1, paddingRight: 16, backgroundColor: GRAY_BG, padding: 10, borderRadius: 4 },
  summaryRight: { width: "36%" },
  summaryRow: { flexDirection: "row", marginBottom: 3.5 },
  summaryLabel: { color: GRAY_MED, width: "50%", fontSize: 8 },
  summaryValue: { color: "#111827", fontWeight: "bold", fontSize: 8 },
  summaryValueLg: { color: INDIGO, fontWeight: "bold", fontSize: 10 },
  passBadge: { fontSize: 7.5, fontWeight: "bold", color: "#065f46", backgroundColor: "#d1fae5", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginLeft: 6 },
  failBadge: { fontSize: 7.5, fontWeight: "bold", color: "#991b1b", backgroundColor: "#fee2e2", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginLeft: 6 },

  /* ── Grade band box ── */
  gradeBandBox: { borderWidth: 0.5, borderColor: "#d1d5db", padding: 8, borderRadius: 4 },
  gbTitle: { fontSize: 7.5, fontWeight: "bold", color: "#374151", marginBottom: 4, letterSpacing: 0.5 },
  gbRow: { flexDirection: "row", fontSize: 7, marginBottom: 1.5 },
  gbLabel: { width: "28%", fontWeight: "bold", color: INDIGO },
  gbRange: { width: "72%", color: GRAY_MED },

  /* ── Footer ── */
  footer: {
    position: "absolute", bottom: 20, left: 44, right: 44,
    borderTopWidth: 0.5, borderTopColor: GRAY_LIGHT, paddingTop: 5,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  footerLeft: { fontSize: 7.5, color: GRAY_MED, fontWeight: "bold", letterSpacing: 0.5 },
  footerCenter: { fontSize: 7, color: "#d1d5db" },
  footerRight: { fontSize: 7.5, color: GRAY_MED, textAlign: "right" },
});

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return String(d);
  }
}

/** Resolve grade from bands at render time (doesn't rely on stored grade). */
function liveGrade(pct: number | null | undefined, bands: GradeBandRow[]): string {
  if (pct == null) return "—";
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  const match = sorted.find((b) => pct >= b.minPercent && pct <= b.maxPercent);
  return match?.label ?? "—";
}

function isFailGrade(g: string): boolean {
  const u = g.trim().toUpperCase();
  return u.startsWith("F") || u === "WD";
}

function gradeTextStyle(g: string) {
  if (!g || g === "—") return styles.gradeNeutral;
  if (isFailGrade(g)) return styles.gradeFail;
  return styles.gradePass;
}

export function TranscriptPdf({
  transcript,
  bands,
  institution,
}: {
  transcript: NonNullable<TranscriptWithDetails>;
  bands: GradeBandRow[];
  institution?: TranscriptInstitutionInfo | null;
}) {
  const { student, program, batch, subjects } = transcript;
  const studentName = `${student.firstName} ${student.lastName}`;
  const studentAddress = [
    student.address,
    student.city,
    student.state,
    student.postalCode,
    student.country,
  ]
    .filter(Boolean)
    .join(", ");

  const collegeName =
    institution?.name || process.env.NEXT_PUBLIC_COLLEGE_NAME || "Intellee College";
  const collegeInitial = collegeName.charAt(0).toUpperCase();

  const dateOfIssue = transcript.publishedAt
    ? fmt(transcript.publishedAt)
    : "Not yet issued";

  const instAddressLines = [
    institution?.address,
    institution?.phone,
    institution?.email,
  ]
    .filter(Boolean)
    .join("\n");

  const websiteText = institution?.website || process.env.NEXT_PUBLIC_COLLEGE_WEBSITE || "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── HEADER ── */}
        <View style={styles.headerRow}>
          {/* Logo */}
          <View style={styles.logoBox}>
            {institution?.logoUrl ? (
              <Image
                src={institution.logoUrl}
                style={{ width: 120, height: 40, objectFit: "contain" }}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoInitial}>{collegeInitial}</Text>
              </View>
            )}
          </View>

          {/* Centre: college name */}
          <View style={styles.headerCenter}>
            <Text style={styles.collegeName}>{collegeName}</Text>
            <Text style={styles.reportTitle}>Transcript of Academic Record</Text>
          </View>

          {/* Right: institution address */}
          {instAddressLines ? (
            <View style={styles.headerRight}>
              <Text style={styles.addressLine}>{instAddressLines}</Text>
            </View>
          ) : null}
        </View>

        {/* Status + Date of issue */}
        <View style={styles.statusBar}>
          <Text style={styles.dateIssued}>
            Date of Issue:{" "}
            <Text style={styles.dateIssuedVal}>{dateOfIssue}</Text>
          </Text>
          <View
            style={
              transcript.status === "PUBLISHED"
                ? styles.statusBadgePublished
                : styles.statusBadgeDraft
            }
          >
            <Text>{transcript.status}</Text>
          </View>
        </View>

        <View style={styles.dividerThick} />

        {/* ── META GRID ── */}
        <View style={styles.metaGrid}>
          {/* Left column */}
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Student Name</Text>
              <Text style={styles.metaValueBold}>{studentName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Student ID</Text>
              <Text style={styles.metaValue}>
                {student.studentProfile?.enrollmentNo ||
                  student.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
            {studentAddress ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Student Address</Text>
                <Text style={styles.metaValue}>{studentAddress}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Program Name</Text>
              <Text style={styles.metaValueBold}>{program.name}</Text>
            </View>
          </View>

          {/* Right column */}
          <View style={styles.metaCol}>
            {program.programType ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Program Type</Text>
                <Text style={styles.metaValue}>{program.programType.name}</Text>
              </View>
            ) : null}
            {program.programCategory ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Category</Text>
                <Text style={styles.metaValue}>{program.programCategory.name}</Text>
              </View>
            ) : null}
            {transcript.totalHours ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Total Hours</Text>
                <Text style={styles.metaValue}>{transcript.totalHours} hrs</Text>
              </View>
            ) : null}
            {program.durationText ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Duration</Text>
                <Text style={styles.metaValue}>{program.durationText}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Start Date</Text>
              <Text style={styles.metaValue}>
                {fmt(transcript.startDate ?? batch?.startDate)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>End Date</Text>
              <Text style={styles.metaValue}>
                {fmt(transcript.endDate ?? batch?.endDate)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.dividerThin} />

        {/* ── SUBJECT TABLE ── */}
        <View style={styles.tableHeader}>
          <Text style={[styles.thText, styles.colCode]}>Course</Text>
          <Text style={[styles.thText, styles.colDesc]}>Subject / Description</Text>
          <Text style={[styles.thText, styles.colMark]}>Mark %</Text>
          <Text style={[styles.thText, styles.colGrade]}>Grade</Text>
        </View>

        {subjects.map((s, i) => {
          const mark = s.finalMarksPct;
          const grade = liveGrade(mark, bands);
          return (
            <View
              key={s.id}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              wrap={false}
            >
              {/* Course code — fixed width, wraps if very long */}
              <Text style={[{ fontSize: 7.5 }, styles.colCode]}>
                {s.subjectCode || "—"}
              </Text>
              {/* Subject name + optional description stacked, takes remaining flex space */}
              <View style={styles.colDesc}>
                <Text style={{ fontSize: 8 }}>{s.subjectName}</Text>
                {s.description ? (
                  <Text style={{ fontSize: 7, color: GRAY_MED, marginTop: 1 }}>
                    {s.description}
                  </Text>
                ) : null}
              </View>
              <Text style={[{ fontSize: 8 }, styles.colMark]}>
                {mark != null ? `${mark}%` : "WD"}
              </Text>
              <Text style={[{ fontSize: 8.5 }, styles.colGrade, gradeTextStyle(grade)]}>
                {grade}
              </Text>
            </View>
          );
        })}

        {/* ── SUMMARY + GRADE BANDS ── */}
        {(() => {
          // FAIL if any subject has F grade (takes priority over overall avg)
          const hasAnyFail = subjects.some((s) => isFailGrade(liveGrade(s.finalMarksPct, bands)));
          const isPassing =
            !hasAnyFail &&
            transcript.overallAvgPct != null &&
            transcript.overallAvgPct >= 50;
          const showResult = transcript.overallAvgPct != null || hasAnyFail;
          return (
        <View style={styles.summarySection}>
          <View style={styles.summaryLeft}>
            {/* Overall Average row with PASS/FAIL badge */}
            <View style={[styles.summaryRow, { alignItems: "center" }]}>
              <Text style={styles.summaryLabel}>Overall Average</Text>
              <Text style={styles.summaryValueLg}>
                {transcript.overallAvgPct != null ? `${transcript.overallAvgPct}%` : "—"}
              </Text>
              {showResult && (
                <View style={isPassing ? styles.passBadge : styles.failBadge}>
                  <Text>{isPassing ? "PASS" : "FAIL"}</Text>
                </View>
              )}
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Standing</Text>
              <Text style={styles.summaryValue}>{transcript.standing || "—"}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Credential Awarded</Text>
              <Text style={styles.summaryValue}>
                {transcript.credential || "Not Awarded"}
              </Text>
            </View>
            {transcript.remarks ? (
              <View style={[styles.summaryRow, { marginTop: 6 }]}>
                <Text style={{ fontSize: 7.5, color: GRAY_MED, fontStyle: "italic" }}>
                  {transcript.remarks}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Grade band legend */}
          {bands.length > 0 && (
            <View style={styles.summaryRight}>
              <View style={styles.gradeBandBox}>
                <Text style={styles.gbTitle}>Grade Scale</Text>
                {bands.map((b) => (
                  <View key={b.id} style={styles.gbRow}>
                    <Text style={[styles.gbLabel, gradeTextStyle(b.label)]}>
                      {b.label}
                    </Text>
                    <Text style={styles.gbRange}>
                      {b.minPercent} – {b.maxPercent}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
          );
        })()}

        {/* ── FOOTER (fixed, on every page) ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>CONFIDENTIAL</Text>
          <Text
            style={styles.footerCenter}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text style={styles.footerRight}>{websiteText}</Text>
        </View>
      </Page>
    </Document>
  );
}
