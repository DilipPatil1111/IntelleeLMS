"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Download } from "lucide-react";
import Image from "next/image";

type SubjectRow = {
  id: string;
  subjectCode: string | null;
  subjectName: string;
  description: string | null;
  finalMarksPct: number | null;
  grade: string | null;
  autoMarksPct: number | null;
  manualMarksPct: number | null;
};

type TranscriptDetail = {
  id: string;
  status: string;
  overallAvgPct: number | null;
  totalHours: number | null;
  startDate: string | null;
  endDate: string | null;
  standing: string | null;
  credential: string | null;
  remarks: string | null;
  publishedAt: string | null;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    studentProfile: { enrollmentNo: string | null } | null;
  };
  program: {
    name: string;
    durationText: string | null;
    programType: { name: string } | null;
    programCategory: { name: string } | null;
  };
  batch: { name: string; startDate: string; endDate: string } | null;
  subjects: SubjectRow[];
};

type GradeBand = {
  id: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  gradePoint: number | null;
};

type InstitutionInfo = {
  name: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
};

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function isFailGrade(grade: string): boolean {
  const g = grade.trim().toUpperCase();
  return g.startsWith("F") || g === "WD";
}

function gradeColor(grade: string): string {
  if (!grade || grade === "—") return "text-gray-400";
  if (isFailGrade(grade)) return "text-red-600";
  return "text-emerald-700";
}

interface Props {
  apiPrefix: string;
  transcriptId: string;
  onClose: () => void;
}

export function TranscriptPreviewModal({ apiPrefix, transcriptId, onClose }: Props) {
  const [transcript, setTranscript] = useState<TranscriptDetail | null>(null);
  const [bands, setBands] = useState<GradeBand[]>([]);
  const [institution, setInstitution] = useState<InstitutionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch transcript + grade bands (critical) — grades are computed server-side from current bands
    try {
      const [tdRes, bdRes] = await Promise.all([
        fetch(`${apiPrefix}/transcripts/${transcriptId}`).then((r) =>
          r.ok ? r.json() : ({} as Record<string, unknown>)
        ),
        fetch(`${apiPrefix}/grade-bands`).then((r) =>
          r.ok ? r.json() : ({} as Record<string, unknown>)
        ),
      ]);
      setTranscript((tdRes.transcript as TranscriptDetail) || null);
      setBands((bdRes.bands as GradeBand[]) || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
    // Fetch institution info separately — non-critical, doesn't block transcript display
    try {
      const instRes = await fetch("/api/institution-info").then((r) =>
        r.ok ? r.json() : ({} as Record<string, unknown>)
      );
      setInstitution(instRes as InstitutionInfo);
    } catch {
      // optional — transcript still renders without institution branding
    }
  }, [apiPrefix, transcriptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const collegeName =
    institution?.name || process.env.NEXT_PUBLIC_COLLEGE_NAME || "Intellee College";
  const studentAddress = transcript
    ? [
        transcript.student.address,
        transcript.student.city,
        transcript.student.state,
        transcript.student.postalCode,
        transcript.student.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const dateOfIssue = transcript?.publishedAt
    ? fmtDate(transcript.publishedAt)
    : transcript?.status === "DRAFT"
      ? "Not yet issued"
      : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl my-4">
        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">Transcript Preview</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`${apiPrefix}/transcripts/${transcriptId}/pdf`, "_blank")
              }
            >
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : !transcript ? (
          <div className="p-10 text-center text-red-500">Transcript not found.</div>
        ) : (
          /* ── Printable transcript body ── */
          <div className="px-10 py-8 font-sans text-gray-900">
            {/* ── HEADER: logo left, college name center, address right ── */}
            <div className="flex items-center justify-between gap-4 mb-1">
              {/* Logo — height matches the college name text block (~56px) */}
              <div className="flex-shrink-0 flex items-center">
                {institution?.logoUrl ? (
                  <Image
                    src={institution.logoUrl}
                    alt={collegeName}
                    width={240}
                    height={56}
                    style={{ height: "56px", width: "auto", objectFit: "contain" }}
                    unoptimized
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-700 font-extrabold text-2xl">
                      {collegeName.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              {/* College name + subtitle */}
              <div className="flex-1 text-center">
                <p className="text-2xl font-extrabold text-indigo-900 leading-tight">
                  {collegeName}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-widest">
                  Transcript of Academic Record
                </p>
              </div>

              {/* Institution address top-right */}
              <div className="flex-shrink-0 text-right text-xs text-gray-500 max-w-[200px] leading-relaxed">
                {institution?.address && (
                  <p className="whitespace-pre-line">{institution.address}</p>
                )}
                {institution?.phone && <p>{institution.phone}</p>}
                {institution?.email && <p>{institution.email}</p>}
              </div>
            </div>

            {/* Status + Date of issue */}
            <div className="flex items-center justify-end gap-3 mt-1 mb-3">
              <span className="text-xs text-gray-500">
                Date of Issue:{" "}
                <span className="font-semibold text-gray-800">{dateOfIssue}</span>
              </span>
              <Badge
                variant={transcript.status === "PUBLISHED" ? "success" : "warning"}
              >
                {transcript.status}
              </Badge>
            </div>

            <div className="border-b-2 border-indigo-700 mb-4" />

            {/* ── META GRID ── */}
            <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm mb-5">
              <MetaRow label="Student Name" value={`${transcript.student.firstName} ${transcript.student.lastName}`} bold />
              <MetaRow label="Program Name" value={transcript.program.name} bold />
              <MetaRow label="Student ID" value={transcript.student.studentProfile?.enrollmentNo || "—"} />
              {transcript.program.programType && (
                <MetaRow label="Program Type" value={transcript.program.programType.name} />
              )}
              {studentAddress && (
                <MetaRow label="Student Address" value={studentAddress} />
              )}
              {transcript.program.programCategory && (
                <MetaRow label="Category" value={transcript.program.programCategory.name} />
              )}
              {transcript.totalHours != null && (
                <MetaRow label="Total Hours" value={`${transcript.totalHours} hrs`} />
              )}
              {transcript.program.durationText && (
                <MetaRow label="Duration" value={transcript.program.durationText} />
              )}
              <MetaRow
                label="Start Date"
                value={fmtDate(transcript.startDate || transcript.batch?.startDate)}
              />
              <MetaRow
                label="End Date"
                value={fmtDate(transcript.endDate || transcript.batch?.endDate)}
              />
            </div>

            <div className="border-b border-gray-200 mb-4" />

            {/* ── SUBJECT TABLE — table-layout:fixed prevents column overflow/overlap ── */}
            <table
              className="w-full text-sm border-collapse mb-4"
              style={{ tableLayout: "fixed" }}
            >
              <thead>
                <tr className="bg-indigo-900 text-white">
                  <th
                    className="px-3 py-2.5 text-left text-xs font-semibold rounded-tl-sm"
                    style={{ width: "14%" }}
                  >
                    Course Code
                  </th>
                  <th
                    className="px-3 py-2.5 text-left text-xs font-semibold"
                    style={{ width: "55%" }}
                  >
                    Subject / Description
                  </th>
                  <th
                    className="px-3 py-2.5 text-right text-xs font-semibold"
                    style={{ width: "16%" }}
                  >
                    Mark %
                  </th>
                  <th
                    className="px-3 py-2.5 text-center text-xs font-semibold rounded-tr-sm"
                    style={{ width: "15%" }}
                  >
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {transcript.subjects.map((s, i) => {
                  const displayGrade = s.grade && s.grade !== "" ? s.grade : "—";
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : "bg-white"}`}
                    >
                      <td className="px-3 py-2.5 text-gray-600 text-xs font-mono align-top overflow-hidden">
                        <span className="block break-all">{s.subjectCode || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 align-top overflow-hidden">
                        <p className="font-medium text-gray-800 break-words leading-snug">
                          {s.subjectName}
                        </p>
                        {s.description && (
                          <p className="text-gray-400 text-xs mt-0.5 break-words leading-snug">
                            {s.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold align-top">
                        {s.finalMarksPct != null ? (
                          `${s.finalMarksPct}%`
                        ) : (
                          <span className="text-gray-400 font-normal">WD</span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-center font-bold text-sm align-top ${gradeColor(displayGrade)}`}
                      >
                        {displayGrade}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── SUMMARY + GRADE BANDS SIDE BY SIDE ── */}
            {(() => {
              // FAIL if any subject has F grade (regardless of overall avg)
              const hasAnyFail = transcript.subjects.some((s) =>
                isFailGrade(s.grade || "")
              );
              const isPassing =
                !hasAnyFail &&
                transcript.overallAvgPct != null &&
                transcript.overallAvgPct >= 50;
              const showResult = transcript.overallAvgPct != null || hasAnyFail;
              return (
            <div className="flex gap-6 mt-5">
              {/* Summary */}
              <div className="flex-1 bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-100">
                {/* Overall Average + PASS/FAIL badge on same row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-gray-500 w-40 shrink-0">Overall Average</span>
                  <span className="font-bold text-indigo-900 text-base">
                    {transcript.overallAvgPct != null ? `${transcript.overallAvgPct}%` : "—"}
                  </span>
                  {showResult && (
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        isPassing
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-red-100 text-red-700 border-red-300"
                      }`}
                    >
                      {isPassing ? "✓ PASS" : "✗ FAIL"}
                    </span>
                  )}
                </div>
                <SummaryRow label="Standing" value={transcript.standing || "—"} />
                <SummaryRow
                  label="Credential Awarded"
                  value={transcript.credential || "Not Awarded"}
                />
                {transcript.remarks && (
                  <p className="text-xs text-gray-400 italic pt-1 border-t border-gray-200 mt-2">
                    {transcript.remarks}
                  </p>
                )}
              </div>

              {/* Grade bands legend */}
              {bands.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 min-w-[180px]">
                  <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    Grade Scale
                  </p>
                  <table className="text-xs w-full">
                    <tbody>
                      {bands.map((b) => (
                        <tr key={b.id} className="border-b border-gray-50 last:border-0">
                          <td
                            className={`font-bold py-0.5 pr-3 w-10 ${gradeColor(b.label)}`}
                          >
                            {b.label}
                          </td>
                          <td className="text-gray-500">
                            {b.minPercent}–{b.maxPercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
              );
            })()}

            {/* ── FOOTER ── */}
            <div className="mt-8 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
              <span className="font-semibold text-gray-500 tracking-wide uppercase">
                Confidential
              </span>
              <span>{institution?.website || ""}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Small helper sub-components ── */
function MetaRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-36 shrink-0 text-sm">{label}</span>
      <span className={`${bold ? "font-semibold" : ""} text-gray-800 text-sm`}>
        {value}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 w-40 shrink-0">{label}</span>
      <span className={highlight ? "font-bold text-indigo-900 text-base" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
