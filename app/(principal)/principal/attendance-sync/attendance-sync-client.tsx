"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from "lucide-react";

type MissingEnrollment = {
  studentUserId: string;
  studentName: string;
  programId: string;
  programName: string;
  batchId: string;
  batchName: string | null;
  attendanceRecordCount: number;
};

type MissingProfileBatch = {
  studentUserId: string;
  studentName: string;
  currentProfileBatchId: string | null;
  suggestedBatchId: string;
  suggestedBatchName: string | null;
  suggestedProgramId: string;
};

type OrphanAttendance = {
  attendanceRecordId: string;
  studentUserId: string;
  studentName: string;
  sessionId: string;
  sessionDate: string;
  subjectName: string | null;
  batchId: string;
  reason: string;
};

type TeacherlessSession = {
  sessionId: string;
  sessionDate: string;
  subjectName: string | null;
  batchId: string;
  createdById: string;
  createdByName: string | null;
  recordCount: number;
};

type Diagnosis = {
  generatedAt: string;
  counts: {
    missing_program_enrollment: number;
    missing_profile_batch: number;
    orphan_attendance_records: number;
    sessions_missing_teacher_attendance: number;
  };
  samples: {
    missing_program_enrollment: MissingEnrollment[];
    missing_profile_batch: MissingProfileBatch[];
    orphan_attendance_records: OrphanAttendance[];
    sessions_missing_teacher_attendance: TeacherlessSession[];
  };
  truncated: Record<string, boolean>;
};

type AutoFixCategory = "missing_program_enrollment" | "missing_profile_batch";

type ApplyResult = {
  created_program_enrollments: number;
  updated_profile_batches: number;
  skipped: number;
  errors: string[];
};

export function AttendanceSyncClient() {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingFor, setApplyingFor] = useState<AutoFixCategory | "all" | null>(null);
  const { toasts, toast, dismiss } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/principal/attendance-sync", { cache: "no-store" });
      if (!res.ok) {
        toast("Failed to load diagnosis", "error");
        return;
      }
      const data: Diagnosis = await res.json();
      setDiagnosis(data);
    } catch {
      toast("Network error", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback(
    async (categories: AutoFixCategory[], label: AutoFixCategory | "all") => {
      if (categories.length === 0) return;
      const countLabel = categories
        .map((c) => diagnosis?.counts[c] ?? 0)
        .reduce((a, b) => a + b, 0);
      if (countLabel === 0) {
        toast("Nothing to sync", "info");
        return;
      }
      const confirmed = window.confirm(
        `This will create/update up to ${countLabel} row${countLabel === 1 ? "" : "s"} in production.\n\nContinue?`,
      );
      if (!confirmed) return;

      setApplyingFor(label);
      try {
        const res = await fetch("/api/principal/attendance-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories }),
          cache: "no-store",
        });
        const result: ApplyResult = await res.json();
        if (!res.ok) {
          toast(
            (result as unknown as { error?: string }).error ?? "Sync failed",
            "error",
          );
          return;
        }
        const parts = [
          result.created_program_enrollments > 0
            ? `${result.created_program_enrollments} enrollment${result.created_program_enrollments === 1 ? "" : "s"} created`
            : null,
          result.updated_profile_batches > 0
            ? `${result.updated_profile_batches} profile${result.updated_profile_batches === 1 ? "" : "s"} updated`
            : null,
          result.skipped > 0 ? `${result.skipped} skipped` : null,
        ].filter(Boolean);
        toast(parts.length > 0 ? parts.join(" · ") : "No changes needed", "success");
        if (result.errors.length > 0) {
          // Surface the first few errors to the console for triage.
          console.error("[attendance-sync] errors:", result.errors);
          toast(`${result.errors.length} error(s) — see console`, "error");
        }
        await load();
      } catch {
        toast("Network error", "error");
      } finally {
        setApplyingFor(null);
      }
    },
    [diagnosis, load, toast],
  );

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Attendance Data Sync"
        description="Find and repair cross-table inconsistencies that can hide students from reports."
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <Card className="mb-6 border-indigo-100 bg-indigo-50/60">
        <CardContent className="py-4 flex items-start gap-3 text-sm text-indigo-900">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">How this works</p>
            <ul className="list-disc ml-5 mt-1 space-y-1 text-indigo-800">
              <li>
                <strong>Preview is always read-only.</strong> Nothing is written until you click an
                <em> Apply </em> button.
              </li>
              <li>
                Only the two auto-fix categories below can be applied. Orphan records and
                missing teacher attendance are surfaced for manual review — we won&rsquo;t
                guess values for them.
              </li>
              <li>
                Each run is capped at 500 rows and writes are logged to the server console.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {loading && !diagnosis ? (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading diagnosis…
        </div>
      ) : !diagnosis ? (
        <div className="text-center text-gray-500 py-12">No diagnosis available.</div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center">
            <Button
              onClick={() =>
                void apply(
                  ["missing_program_enrollment", "missing_profile_batch"],
                  "all",
                )
              }
              disabled={
                applyingFor !== null ||
                (diagnosis.counts.missing_program_enrollment === 0 &&
                  diagnosis.counts.missing_profile_batch === 0)
              }
              isLoading={applyingFor === "all"}
            >
              Apply all auto-fixes
            </Button>
            <span className="text-xs text-gray-500">
              Preview generated {new Date(diagnosis.generatedAt).toLocaleString()}
            </span>
          </div>

          <AutoFixSection
            title="Missing Program Enrollment"
            description={
              "Students have attendance records for a program but no ProgramEnrollment. " +
              "This is the reason such students don't appear in the Attendance Report dropdown."
            }
            count={diagnosis.counts.missing_program_enrollment}
            truncated={diagnosis.truncated.missing_program_enrollment}
            canApply
            applying={applyingFor === "missing_program_enrollment"}
            onApply={() =>
              void apply(["missing_program_enrollment"], "missing_program_enrollment")
            }
            applyLabel="Create missing enrollments"
          >
            {diagnosis.samples.missing_program_enrollment.length === 0 ? (
              <EmptyRow text="No missing enrollments detected." />
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Student</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Program</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Batch</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {diagnosis.samples.missing_program_enrollment.map((r) => (
                    <tr key={`${r.studentUserId}-${r.programId}`}>
                      <td className="px-3 py-2">{r.studentName}</td>
                      <td className="px-3 py-2">{r.programName}</td>
                      <td className="px-3 py-2">{r.batchName ?? r.batchId}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.attendanceRecordCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AutoFixSection>

          <AutoFixSection
            title="Missing Student Profile Batch"
            description={
              "Student has an active ProgramEnrollment with a batch, but their StudentProfile.batchId is null. " +
              "Syncing sets the profile batch from the most recently updated enrollment."
            }
            count={diagnosis.counts.missing_profile_batch}
            truncated={diagnosis.truncated.missing_profile_batch}
            canApply
            applying={applyingFor === "missing_profile_batch"}
            onApply={() =>
              void apply(["missing_profile_batch"], "missing_profile_batch")
            }
            applyLabel="Sync profile batches"
          >
            {diagnosis.samples.missing_profile_batch.length === 0 ? (
              <EmptyRow text="No missing profile batches detected." />
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Student</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Suggested Batch
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {diagnosis.samples.missing_profile_batch.map((r) => (
                    <tr key={r.studentUserId}>
                      <td className="px-3 py-2">{r.studentName}</td>
                      <td className="px-3 py-2">
                        {r.suggestedBatchName ?? r.suggestedBatchId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AutoFixSection>

          <AutoFixSection
            title="Orphan Attendance Records"
            description={
              "Attendance records whose student is not in the session's batch via profile or enrollment. " +
              "Review manually — we don't auto-delete because these may be legitimate historical entries."
            }
            count={diagnosis.counts.orphan_attendance_records}
            truncated={diagnosis.truncated.orphan_attendance_records}
            canApply={false}
          >
            {diagnosis.samples.orphan_attendance_records.length === 0 ? (
              <EmptyRow text="No orphans detected." />
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Student</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Subject</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {diagnosis.samples.orphan_attendance_records.map((r) => (
                    <tr key={r.attendanceRecordId}>
                      <td className="px-3 py-2">{r.studentName}</td>
                      <td className="px-3 py-2 tabular-nums">{r.sessionDate}</td>
                      <td className="px-3 py-2">{r.subjectName ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.batchId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AutoFixSection>

          <AutoFixSection
            title="Sessions Missing Teacher Attendance"
            description={
              "Attendance sessions that a teacher created but where their own status was never recorded. " +
              "Ask the teacher to fill it in — we can't auto-mark without knowing whether they were present."
            }
            count={diagnosis.counts.sessions_missing_teacher_attendance}
            truncated={diagnosis.truncated.sessions_missing_teacher_attendance}
            canApply={false}
          >
            {diagnosis.samples.sessions_missing_teacher_attendance.length === 0 ? (
              <EmptyRow text="No sessions missing teacher attendance." />
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Subject</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Teacher</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Student rows
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {diagnosis.samples.sessions_missing_teacher_attendance.map((r) => (
                    <tr key={r.sessionId}>
                      <td className="px-3 py-2 tabular-nums">{r.sessionDate}</td>
                      <td className="px-3 py-2">{r.subjectName ?? "—"}</td>
                      <td className="px-3 py-2">{r.createdByName ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.recordCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AutoFixSection>
        </div>
      )}
    </>
  );
}

function AutoFixSection({
  title,
  description,
  count,
  truncated,
  canApply,
  applying,
  applyLabel,
  onApply,
  children,
}: {
  title: string;
  description: string;
  count: number;
  truncated: boolean;
  canApply: boolean;
  applying?: boolean;
  applyLabel?: string;
  onApply?: () => void;
  children: React.ReactNode;
}) {
  const isClean = count === 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            {isClean ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className={`h-4 w-4 ${canApply ? "text-amber-600" : "text-gray-500"}`} />
            )}
            {title}
            <span
              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isClean
                  ? "bg-emerald-100 text-emerald-700"
                  : canApply
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {count}
              {truncated ? "+" : ""}
            </span>
          </CardTitle>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        {canApply && onApply && (
          <Button
            onClick={onApply}
            disabled={isClean || applying}
            isLoading={applying}
            size="sm"
            className="flex-shrink-0"
          >
            {applyLabel ?? "Apply"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-gray-500 py-2">{text}</p>;
}
