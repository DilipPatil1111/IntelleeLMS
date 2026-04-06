"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, DollarSign, CheckCircle2, Clock, Upload, ExternalLink, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { blobFileUrl } from "@/lib/blob-url";

interface PendingAssessment {
  id: string;
  title: string;
  subjectName: string;
  type: string;
  scheduledCloseAt: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS";
  priority: "HIGH" | "NORMAL";
}

interface BelowPassingResult {
  id: string;
  title: string;
  subjectName: string;
  type: string;
  score: number;
  totalMarks: number;
  passingMarks: number;
  priority: "HIGH";
  message: string;
}

interface AttendanceAlert {
  subjectName: string;
  attendancePercent: number;
  requiredPercent: number;
  priority: "HIGH";
  message: string;
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
  pendingAssessments: PendingAssessment[];
  belowPassingResults: BelowPassingResult[];
  attendanceAlerts: AttendanceAlert[];
  documents: DocumentItem[] | null;
  fees: {
    totalFees: number;
    totalPaid: number;
    pendingAmount: number;
    receipts: Receipt[];
  };
  counts: { assessments: number; documents: number; fees: number; belowPassing: number; attendance: number; highPriority: number; total: number };
}

export default function PendingActionsPage() {
  const [data, setData] = useState<PendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState("");
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const receiptReplaceRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  async function handleReceiptReplace(paymentId: string, file: File) {
    setReceiptUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/student/pending-actions/receipt/${paymentId}`, {
        method: "PUT",
        body: fd,
      });
      if (res.ok) await load();
      else console.error("Replace receipt failed:", await res.text());
    } finally {
      setReceiptUploading(false);
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
        <Card><CardContent className="py-12 text-center text-gray-500">Unable to load pending actions.</CardContent></Card>
      </>
    );
  }

  const { pendingAssessments, belowPassingResults = [], attendanceAlerts = [], documents, fees, counts } = data;
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <>
      <PageHeader
        title="Pending Actions"
        description={counts.total > 0 ? `You have ${counts.total} pending item${counts.total === 1 ? "" : "s"}` : "All caught up!"}
      />

      {counts.highPriority > 0 && (
        <div className="mb-6 rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">{counts.highPriority}</span>
            <span className="text-sm font-bold text-red-800">High-Priority Actions Requiring Attention</span>
          </div>
          <p className="text-xs text-red-700/80">
            Items below require your immediate attention — incomplete assessments, missing documents, low marks, or attendance issues.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Pending Assessments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pending Assessments
              {counts.assessments > 0 && (
                <span className="ml-auto text-sm font-medium text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {counts.assessments} — HIGH PRIORITY
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingAssessments.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">All assessments are complete</span>
              </div>
            ) : (
              <div className="divide-y">
                {pendingAssessments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />
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
                      <Button size="sm" variant={a.status === "IN_PROGRESS" ? "outline" : "primary"}>
                        {a.status === "IN_PROGRESS" ? (
                          <><Clock className="h-3.5 w-3.5 mr-1" /> Continue</>
                        ) : (
                          "Take"
                        )}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Below-Passing Assessment Results */}
        {belowPassingResults.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Below-Passing Results
                <span className="ml-auto text-sm font-medium text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {belowPassingResults.length} — HIGH PRIORITY
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {belowPassingResults.map((r) => (
                  <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">{r.title}</p>
                        <p className="text-sm text-gray-500">
                          {r.subjectName} &middot; {r.type} &middot; Score: {r.score}/{r.totalMarks} (Passing: {r.passingMarks})
                        </p>
                        <p className="mt-1 text-sm font-medium text-red-700">{r.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendance Alerts */}
        {attendanceAlerts.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Low Attendance Warning
                <span className="ml-auto text-sm font-medium text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {attendanceAlerts.length} — HIGH PRIORITY
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {attendanceAlerts.map((a, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />
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
            </CardContent>
          </Card>
        )}

        {/* Pending Documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-blue-500" />
              Documents
              {counts.documents > 0 && (
                <span className="ml-auto text-sm font-medium text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {counts.documents} pending — HIGH PRIORITY
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!documents ? (
              <p className="text-sm text-gray-500">No document requirements assigned yet.</p>
            ) : (
              <div className="divide-y">
                {documents.filter((d) => !d.completed).map((d) => (
                  <div key={d.key} className="flex items-center justify-between py-3 first:pt-0">
                    <div>
                      <p className="font-medium text-gray-900">{d.label}</p>
                      <p className="text-sm text-gray-500">Upload required</p>
                    </div>
                    <div>
                      <input
                        type="file"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[d.step] = el; }}
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
                {documents.filter((d) => d.completed).map((d) => (
                  <div key={d.key} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-700">{d.label}</p>
                          <p className="text-xs text-gray-400">Current version</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="file"
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[`update-${d.step}`] = el; }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) handleDocUpload(d.step, f);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fileInputRefs.current[`update-${d.step}`]?.click()}
                          disabled={uploading === d.step}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          {uploading === d.step ? "Updating..." : "Update"}
                        </Button>
                      </div>
                    </div>
                    {d.trail && d.trail.length > 0 && (
                      <div className="ml-6 rounded-lg border border-gray-100 bg-gray-50/80 p-3 space-y-2">
                        <p className="text-xs font-medium text-gray-500">Submission history (newest first)</p>
                        <ul className="space-y-2">
                          {d.trail.map((t, idx) => (
                            <li key={idx} className="flex items-center justify-between gap-2 text-sm">
                              <span className="text-gray-700 truncate">{t.fileName}</span>
                              <span className="text-xs text-gray-400 shrink-0">
                                {new Date(t.uploadedAt).toLocaleString()}
                              </span>
                              <a
                                href={blobFileUrl(t.fileUrl, t.fileName, true)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline shrink-0 text-xs"
                              >
                                View
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Fees */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Fees
              {fees.pendingAmount > 0 && (
                <span className="ml-auto text-sm font-medium text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {fmt(fees.pendingAmount)} pending
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fees.totalFees === 0 ? (
              <p className="text-sm text-gray-500">No fee structure assigned to your program.</p>
            ) : (
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
                  <div className={`rounded-lg p-3 text-center ${fees.pendingAmount > 0 ? "bg-red-50" : "bg-green-50"}`}>
                    <p className="text-xs text-gray-500">Pending</p>
                    <p className={`text-lg font-semibold ${fees.pendingAmount > 0 ? "text-red-700" : "text-green-700"}`}>
                      {fmt(fees.pendingAmount)}
                    </p>
                  </div>
                </div>

                {fees.pendingAmount <= 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">All fees are paid</span>
                  </div>
                ) : (
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
                )}

                {fees.receipts.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Payment receipts</p>
                    <div className="space-y-3">
                      {fees.receipts.map((r) => (
                        <div key={r.id} className="rounded-lg border border-gray-200 overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{r.fileName}</p>
                              <p className="text-xs text-gray-500">
                                {fmt(r.amountPaid)} &middot; {new Date(r.paymentDate).toLocaleDateString()}
                                {r.confirmed && <span className="ml-1 text-green-600">&middot; Confirmed</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="file"
                                className="hidden"
                                ref={(el) => { receiptReplaceRefs.current[r.id] = el; }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.target.value = "";
                                  if (f) void handleReceiptReplace(r.id, f);
                                }}
                              />
                              <a href={blobFileUrl(r.fileUrl, r.fileName, true)} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5 mr-1" /> View</Button>
                              </a>
                              <a
                                href={blobFileUrl(r.fileUrl, r.fileName)}
                                download={r.fileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-600 px-2 py-1.5 hover:bg-indigo-50 rounded"
                              >
                                Download
                              </a>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => receiptReplaceRefs.current[r.id]?.click()}
                                disabled={receiptUploading}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Update
                              </Button>
                            </div>
                          </div>
                          {r.trail && r.trail.length > 1 && (
                            <div className="px-3 py-2 text-xs border-t border-gray-100">
                              <p className="font-medium text-gray-500 mb-1">Version history (newest first)</p>
                              <ul className="space-y-1">
                                {r.trail.map((t, i) => (
                                  <li key={i} className="flex justify-between gap-2 text-gray-600">
                                    <span className="truncate">{t.fileName}</span>
                                    <a href={blobFileUrl(t.fileUrl, t.fileName, true)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 shrink-0">
                                      View
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link href="/student/fees" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                  View full fee details <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
