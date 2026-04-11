"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
  Upload,
  ExternalLink,
  Award,
  BookOpen,
  RotateCcw,
  ShieldCheck,
  X,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";

/* ── Type Definitions ─────────────────────────────────────────────────────── */

interface PendingAssessment {
  id: string;
  title: string;
  subjectName: string;
  programId: string;
  type: string;
  scheduledCloseAt: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS";
  priority: "HIGH" | "NORMAL";
}

interface RetakeRequestInfo {
  id: string;
  status: string;
  staffMessage: string | null;
  resolvedByName: string | null;
}

interface BelowPassingResult {
  id: string;
  title: string;
  subjectName: string;
  programId: string;
  type: string;
  score: number;
  totalMarks: number;
  passingMarks: number;
  priority: "HIGH";
  message: string;
  retakeRequest: RetakeRequestInfo | null;
}

interface AttendanceAlert {
  subjectName: string;
  programId: string;
  attendancePercent: number;
  requiredPercent: number;
  priority: "HIGH";
  message: string;
}

interface ExcuseRequestInfo {
  id: string;
  status: string;
  staffMessage: string | null;
  resolvedByName: string | null;
}

interface AbsentRecord {
  id: string;
  sessionDate: string;
  subjectName: string;
  programId: string;
  excuseRequest: ExcuseRequestInfo | null;
}

interface ProgramSummary {
  programId: string;
  programName: string;
  pendingAssessments: PendingAssessment[];
  belowPassingResults: BelowPassingResult[];
  attendanceAlerts: AttendanceAlert[];
  absentRecords: AbsentRecord[];
  pendingCount: number;
  eligible: boolean;
}

interface TrailVersion {
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
}

interface DocumentItem {
  key: string;
  label: string;
  step: string;
  completed: boolean;
  uploadedAt: string | null;
  fileName: string | null;
  fileUrl: string | null;
  trail?: TrailVersion[];
}

interface Receipt {
  id: string;
  fileName: string;
  fileUrl: string;
  amountPaid: number;
  paymentDate: string;
  confirmed: boolean;
  trail?: TrailVersion[];
}

interface PendingData {
  programs: ProgramSummary[];
  pendingAssessments: PendingAssessment[];
  belowPassingResults: BelowPassingResult[];
  attendanceAlerts: AttendanceAlert[];
  absentRecords: AbsentRecord[];
  documents: DocumentItem[] | null;
  fees: {
    totalFees: number;
    totalPaid: number;
    pendingAmount: number;
    receipts: Receipt[];
  };
  counts: {
    assessments: number;
    documents: number;
    fees: number;
    belowPassing: number;
    attendance: number;
    highPriority: number;
    total: number;
  };
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function PendingActionsPage() {
  const [data, setData] = useState<PendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState("");
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [retakeModal, setRetakeModal] = useState<{ assessmentId: string; title: string } | null>(null);
  const [retakeMessage, setRetakeMessage] = useState("");
  const [retakeSubmitting, setRetakeSubmitting] = useState(false);
  const [excuseModal, setExcuseModal] = useState<{ recordId: string; subjectName: string; date: string } | null>(null);
  const [excuseMessage, setExcuseMessage] = useState("");
  const [excuseSubmitting, setExcuseSubmitting] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const { toasts, toast, dismiss } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/student/pending-actions");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to load pending actions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDocUpload(step: string, file: File) {
    setUploading(step);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("step", step);
      const res = await fetch("/api/student/onboarding/upload", { method: "POST", body: form });
      if (res.ok) await load();
      else console.error("Upload failed:", await res.text());
    } finally {
      setUploading(null);
    }
  }

  async function handleReceiptUpload(file: File) {
    const amount = parseFloat(receiptAmount);
    if (!amount || amount <= 0) return;
    setReceiptUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("amount", String(amount));
      const res = await fetch("/api/student/pending-actions/upload-receipt", { method: "POST", body: form });
      if (res.ok) {
        setReceiptAmount("");
        setShowReceiptForm(false);
        await load();
      } else {
        console.error("Receipt upload failed:", await res.text());
      }
    } finally {
      setReceiptUploading(false);
    }
  }

  async function handleRetakeRequest() {
    if (!retakeModal) return;
    setRetakeSubmitting(true);
    try {
      const res = await fetch("/api/student/retake-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: retakeModal.assessmentId, message: retakeMessage }),
      });
      if (res.ok) {
        setRetakeModal(null);
        setRetakeMessage("");
        await load();
      } else {
        const errBody = await res.json().catch(() => null);
        toast(errBody?.error ?? "Failed to submit retake request", "error");
      }
    } finally {
      setRetakeSubmitting(false);
    }
  }

  async function handleExcuseRequest() {
    if (!excuseModal) return;
    setExcuseSubmitting(true);
    try {
      const res = await fetch("/api/student/attendance-excuse-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceRecordId: excuseModal.recordId, message: excuseMessage }),
      });
      if (res.ok) {
        setExcuseModal(null);
        setExcuseMessage("");
        await load();
      } else {
        const errBody = await res.json().catch(() => null);
        toast(errBody?.error ?? "Failed to submit excuse request", "error");
      }
    } finally {
      setExcuseSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Pending Actions" description="Your outstanding tasks" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Pending Actions" description="Your outstanding tasks" />
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Unable to load pending actions.</CardContent>
        </Card>
      </>
    );
  }

  const { programs = [], documents, fees, counts } = data;
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Pending Actions"
        description={
          counts.total > 0
            ? `You have ${counts.total} pending item${counts.total === 1 ? "" : "s"}`
            : "All caught up!"
        }
      />

      {counts.highPriority > 0 && (
        <div className="mb-6 rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">
              {counts.highPriority}
            </span>
            <span className="text-sm font-bold text-red-800">High-Priority Actions Requiring Attention</span>
          </div>
          <p className="text-xs text-red-700/80">
            Items below require your immediate attention — incomplete assessments, missing documents, low marks, or
            attendance issues.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* ── Program-wise Sections ──────────────────────────────────────── */}
        {programs.length > 0 && (
          <>
            {programs.map((prog) => (
              <Card
                key={prog.programId}
                className={prog.eligible ? "border-green-300 bg-green-50/30" : undefined}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="h-5 w-5 text-indigo-500" />
                    {prog.programName}
                    {prog.eligible ? (
                      <span className="ml-auto text-sm font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Award className="h-3.5 w-3.5" /> Eligible for Certificate
                      </span>
                    ) : prog.pendingCount > 0 ? (
                      <span className="ml-auto text-sm font-medium text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                        {prog.pendingCount} pending action{prog.pendingCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Eligible banner */}
                  {prog.eligible && (
                    <div className="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                          <Award className="h-5 w-5 text-green-700" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-800">
                            Congratulations! You are eligible for your certificate.
                          </p>
                          <p className="text-sm text-green-700">
                            All program requirements are complete. Your Teacher or Principal will award your certificate
                            shortly.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending Assessments for this program */}
                  {prog.pendingAssessments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Pending Assessments
                      </h4>
                      <div className="divide-y rounded-lg border border-gray-100 bg-white">
                        {prog.pendingAssessments.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between px-4 py-3 first:pt-3 last:pb-3"
                          >
                            <div className="flex items-start gap-2">
                              <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />
                              <div>
                                <p className="font-medium text-gray-900">{a.title}</p>
                                <p className="text-sm text-gray-500">
                                  {a.subjectName} &middot; {a.type}
                                  {a.scheduledCloseAt && (
                                    <> &middot; Due: {new Date(a.scheduledCloseAt).toLocaleDateString()}</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <Link href={`/student/assessments/${a.id}/take`}>
                              <Button
                                size="sm"
                                variant={a.status === "IN_PROGRESS" ? "outline" : "primary"}
                              >
                                {a.status === "IN_PROGRESS" ? (
                                  <>
                                    <Clock className="h-3.5 w-3.5 mr-1" /> Continue
                                  </>
                                ) : (
                                  "Take"
                                )}
                              </Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Below-Passing Results for this program */}
                  {prog.belowPassingResults.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Below-Passing Results
                      </h4>
                      <div className="divide-y rounded-lg border border-red-100 bg-white">
                        {prog.belowPassingResults.map((r) => {
                          const rr = r.retakeRequest;
                          const isExcused = rr?.status === "EXCUSED";
                          const isApproved = rr?.status === "APPROVED_RETAKE";
                          const isDenied = rr?.status === "DENIED";
                          const isPending = rr?.status === "PENDING";

                          return (
                            <div
                              key={r.id}
                              className={`px-4 py-3 first:pt-3 last:pb-3 ${
                                isExcused ? "bg-orange-50 border-l-4 border-orange-400" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 min-w-0">
                                  <span
                                    className={`mt-1.5 inline-block h-2 w-2 rounded-full shrink-0 ${
                                      isExcused ? "bg-orange-500" : "bg-red-500"
                                    }`}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium text-gray-900">{r.title}</p>
                                      {isExcused && (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                                          <ShieldCheck className="h-3 w-3" /> Excused
                                        </span>
                                      )}
                                      {isApproved && (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                          <RotateCcw className="h-3 w-3" /> Retake Approved
                                        </span>
                                      )}
                                      {isPending && (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                          <Clock className="h-3 w-3" /> Retake Requested
                                        </span>
                                      )}
                                      {isDenied && (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                          <X className="h-3 w-3" /> Denied
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                      {r.subjectName} &middot; {r.type} &middot; Score: {r.score}/{r.totalMarks}{" "}
                                      (Passing: {r.passingMarks})
                                    </p>
                                    <p
                                      className={`mt-1 text-sm font-medium ${
                                        isExcused ? "text-orange-700" : "text-red-700"
                                      }`}
                                    >
                                      {r.message}
                                    </p>
                                    {rr?.staffMessage && rr.resolvedByName && (
                                      <p className="mt-1 text-xs text-gray-500 italic">
                                        — {rr.resolvedByName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  {!rr && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setRetakeModal({ assessmentId: r.id, title: r.title })
                                      }
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                      Request Retake
                                    </Button>
                                  )}
                                  {isApproved && (
                                    <Link href={`/student/assessments/${r.id}/take`}>
                                      <Button size="sm" variant="primary">
                                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retake Now
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Attendance Alerts for this program */}
                  {prog.attendanceAlerts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Low Attendance Warning
                      </h4>
                      <div className="divide-y rounded-lg border border-red-100 bg-white">
                        {prog.attendanceAlerts.map((a, idx) => (
                          <div key={idx} className="px-4 py-3 first:pt-3 last:pb-3">
                            <div className="flex items-start gap-2">
                              <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />
                              <div>
                                <p className="font-medium text-gray-900">{a.subjectName}</p>
                                <p className="text-sm text-gray-500">
                                  Attendance: {a.attendancePercent}% (Required: {a.requiredPercent}%)
                                </p>
                                <p className="mt-1 text-sm font-medium text-red-700">{a.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Absent Records - Request to Excuse */}
                  {prog.absentRecords && prog.absentRecords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Absent Sessions — Request to Excuse
                      </h4>
                      <div className="divide-y rounded-lg border border-orange-100 bg-white">
                        {prog.absentRecords.map((r) => {
                          const er = r.excuseRequest;
                          const isPending = er?.status === "PENDING";
                          return (
                            <div
                              key={r.id}
                              className="flex items-center justify-between px-4 py-3 first:pt-3 last:pb-3"
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                                <div>
                                  <p className="font-medium text-gray-900">{r.subjectName}</p>
                                  <p className="text-sm text-gray-500">
                                    {new Date(r.sessionDate).toLocaleDateString()} &middot; Absent
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                    <Clock className="h-3 w-3" /> Excuse Requested
                                  </span>
                                ) : !er ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setExcuseModal({
                                        recordId: r.id,
                                        subjectName: r.subjectName,
                                        date: new Date(r.sessionDate).toLocaleDateString(),
                                      })
                                    }
                                  >
                                    <Send className="h-3.5 w-3.5 mr-1" />
                                    Request to Excuse
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* All clear for this program (but not eligible yet) */}
                  {prog.pendingCount === 0 && !prog.eligible && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm">
                        No pending actions for this program. Complete remaining chapters to become eligible for your
                        certificate.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {programs.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No enrolled programs found.</p>
            </CardContent>
          </Card>
        )}

        {/* ── Documents (only show if there are pending uploads) ─────────── */}
        {documents && documents.some((d) => !d.completed) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-blue-500" />
                Documents
                <span className="ml-auto text-sm font-medium text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {documents.filter((d) => !d.completed).length} pending — HIGH PRIORITY
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {documents
                  .filter((d) => !d.completed)
                  .map((d) => (
                    <div key={d.key} className="flex items-center justify-between py-3 first:pt-0">
                      <div>
                        <p className="font-medium text-gray-900">{d.label}</p>
                        <p className="text-sm text-gray-500">Upload required</p>
                      </div>
                      <div>
                        <input
                          type="file"
                          className="hidden"
                          ref={(el) => {
                            fileInputRefs.current[d.step] = el;
                          }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleDocUpload(d.step, f);
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => fileInputRefs.current[d.step]?.click()}
                          disabled={uploading === d.step}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          {uploading === d.step ? "Uploading..." : "Upload"}
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Fees (only show if there is a pending amount) ──────────────── */}
        {fees.totalFees > 0 && fees.pendingAmount > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Fees
                <span className="ml-auto text-sm font-medium text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {fmt(fees.pendingAmount)} pending
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-semibold">{fmt(fees.totalFees)}</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Paid</p>
                    <p className="text-lg font-semibold text-green-700">{fmt(fees.totalPaid)}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Pending</p>
                    <p className="text-lg font-semibold text-red-700">{fmt(fees.pendingAmount)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {!showReceiptForm ? (
                    <Button onClick={() => setShowReceiptForm(true)} size="sm">
                      <Upload className="h-3.5 w-3.5 mr-1" /> Upload Payment Receipt
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount ($)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={receiptAmount}
                          onChange={(e) => setReceiptAmount(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="Enter amount paid"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          className="hidden"
                          ref={receiptInputRef}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleReceiptUpload(f);
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => receiptInputRef.current?.click()}
                          disabled={receiptUploading || !receiptAmount || parseFloat(receiptAmount) <= 0}
                        >
                          {receiptUploading ? "Uploading..." : "Select & Upload Receipt"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowReceiptForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href="/student/fees"
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                >
                  View full fee details <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Retake Request Modal ──────────────────────────────────────── */}
      {retakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Request Retake</h3>
              <button
                onClick={() => { setRetakeModal(null); setRetakeMessage(""); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                Request a retake for <span className="font-semibold">{retakeModal.title}</span>. Your
                teacher or principal will review this request.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for retake (optional)
                </label>
                <textarea
                  value={retakeMessage}
                  onChange={(e) => setRetakeMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Explain why you'd like to retake this assessment..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                onClick={() => { setRetakeModal(null); setRetakeMessage(""); }}
                disabled={retakeSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleRetakeRequest} disabled={retakeSubmitting}>
                <Send className="h-3.5 w-3.5 mr-1" />
                {retakeSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Excuse Request Modal ──────────────────────────────────────── */}
      {excuseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Request to Excuse</h3>
              <button
                onClick={() => { setExcuseModal(null); setExcuseMessage(""); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                Request to excuse your absence for{" "}
                <span className="font-semibold">{excuseModal.subjectName}</span> on{" "}
                <span className="font-semibold">{excuseModal.date}</span>. Your teacher or principal will
                review this request.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for absence (optional)
                </label>
                <textarea
                  value={excuseMessage}
                  onChange={(e) => setExcuseMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Explain why you were absent..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                onClick={() => { setExcuseModal(null); setExcuseMessage(""); }}
                disabled={excuseSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleExcuseRequest} disabled={excuseSubmitting}>
                <Send className="h-3.5 w-3.5 mr-1" />
                {excuseSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
