"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RotateCcw,
  ShieldCheck,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";

interface RetakeRequest {
  id: string;
  assessmentId: string;
  studentUserId: string;
  status: string;
  studentMessage: string | null;
  staffMessage: string | null;
  resolvedAt: string | null;
  createdAt: string;
  assessment: {
    id: string;
    title: string;
    type: string;
    totalMarks: number | null;
    passingMarks: number | null;
    subject: { name: string } | null;
    creator?: { firstName: string; lastName: string };
  };
  student: { id: string; firstName: string; lastName: string; email: string };
  resolvedBy: { firstName: string; lastName: string } | null;
  attemptScore: number | null;
  attemptPercentage: number | null;
}

interface Props {
  apiBasePath: string;
  role: "teacher" | "principal";
}

export function RetakeRequestsClient({ apiBasePath, role }: Props) {
  const [requests, setRequests] = useState<RetakeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{ req: RetakeRequest; action: string } | null>(null);
  const [staffMessage, setStaffMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "RESOLVED">("PENDING");

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBasePath);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch (err) {
      console.error("Failed to load retake requests:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleResolve() {
    if (!actionModal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBasePath}/${actionModal.req.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionModal.action, staffMessage }),
      });
      if (res.ok) {
        setActionModal(null);
        setStaffMessage("");
        await load();
      } else {
        const errBody = await res.json().catch(() => null);
        alert(errBody?.error ?? "Action failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = requests.filter((r) => {
    if (filter === "PENDING") return r.status === "PENDING";
    if (filter === "RESOLVED") return r.status !== "PENDING";
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  if (loading) {
    return (
      <>
        <PageHeader title="Retake Requests" description="Manage student assessment retake requests" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Retake Requests"
        description={
          pendingCount > 0
            ? `${pendingCount} pending request${pendingCount === 1 ? "" : "s"} require your attention`
            : "No pending retake requests"
        }
      />

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {(["PENDING", "ALL", "RESOLVED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "PENDING" ? `Pending (${pendingCount})` : f === "ALL" ? "All" : "Resolved"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">
              {filter === "PENDING" ? "No pending retake requests." : "No retake requests found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const isPending = r.status === "PENDING";
            const isExcused = r.status === "EXCUSED";
            const isApproved = r.status === "APPROVED_RETAKE";
            const isDenied = r.status === "DENIED";
            const totalMarks = r.assessment.totalMarks ?? 0;
            const passingMarks = r.assessment.passingMarks ?? Math.round(totalMarks * 0.4);

            return (
              <Card
                key={r.id}
                className={
                  isPending
                    ? "border-yellow-200"
                    : isExcused
                      ? "border-orange-200 bg-orange-50/30"
                      : isApproved
                        ? "border-green-200 bg-green-50/30"
                        : isDenied
                          ? "border-red-200 bg-red-50/30"
                          : undefined
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="truncate">{r.assessment.title}</span>
                    <span className="text-sm font-normal text-gray-500">
                      ({r.assessment.subject?.name ?? "—"} &middot; {r.assessment.type})
                    </span>
                    <span className="ml-auto shrink-0">
                      {isPending && (
                        <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                      {isExcused && (
                        <span className="text-xs font-semibold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> Excused
                        </span>
                      )}
                      {isApproved && (
                        <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" /> Retake Approved
                        </span>
                      )}
                      {isDenied && (
                        <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <X className="h-3 w-3" /> Denied
                        </span>
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Student:</span>{" "}
                      <span className="font-medium">
                        {r.student.firstName} {r.student.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Score:</span>{" "}
                      <span className="font-medium text-red-600">
                        {r.attemptScore ?? "—"}/{totalMarks}
                      </span>{" "}
                      <span className="text-gray-400">(Passing: {passingMarks})</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Requested:</span>{" "}
                      <span className="font-medium">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {r.studentMessage && (
                    <div className="rounded-lg bg-gray-50 p-3 text-sm">
                      <div className="flex items-center gap-1 text-gray-500 mb-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span className="font-medium">Student&apos;s message:</span>
                      </div>
                      <p className="text-gray-700">{r.studentMessage}</p>
                    </div>
                  )}

                  {r.staffMessage && (
                    <div
                      className={`rounded-lg p-3 text-sm ${
                        isExcused ? "bg-orange-50" : "bg-blue-50"
                      }`}
                    >
                      <div className="flex items-center gap-1 text-gray-500 mb-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {role === "principal" ? "Staff" : "Your"} response:
                        </span>
                      </div>
                      <p className="text-gray-700">{r.staffMessage}</p>
                      {r.resolvedBy && (
                        <p className="mt-1 text-xs text-gray-400">
                          — {r.resolvedBy.firstName} {r.resolvedBy.lastName}
                          {r.resolvedAt && <> on {new Date(r.resolvedAt).toLocaleDateString()}</>}
                        </p>
                      )}
                    </div>
                  )}

                  {role === "principal" && r.assessment.creator && (
                    <p className="text-xs text-gray-400">
                      Assessment by: {r.assessment.creator.firstName} {r.assessment.creator.lastName}
                    </p>
                  )}

                  {isPending && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => setActionModal({ req: r, action: "APPROVED_RETAKE" })}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Approve Retake
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        onClick={() => setActionModal({ req: r, action: "EXCUSED" })}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Excused for Certificate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => setActionModal({ req: r, action: "DENIED" })}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Deny
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Action Modal ──────────────────────────────────────────────── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {actionModal.action === "APPROVED_RETAKE"
                  ? "Approve Retake"
                  : actionModal.action === "EXCUSED"
                    ? "Excuse for Certificate"
                    : "Deny Retake Request"}
              </h3>
              <button
                onClick={() => { setActionModal(null); setStaffMessage(""); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="text-sm text-gray-600">
                <p>
                  <span className="font-medium">Student:</span>{" "}
                  {actionModal.req.student.firstName} {actionModal.req.student.lastName}
                </p>
                <p>
                  <span className="font-medium">Assessment:</span> {actionModal.req.assessment.title}
                </p>
                <p>
                  <span className="font-medium">Score:</span> {actionModal.req.attemptScore ?? "—"}/
                  {actionModal.req.assessment.totalMarks ?? 0}
                </p>
              </div>

              {actionModal.action === "APPROVED_RETAKE" && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                  The student&apos;s previous attempt and answers will be deleted, allowing them to retake the
                  assessment fresh.
                </div>
              )}

              {actionModal.action === "EXCUSED" && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
                  The student&apos;s below-passing mark will be excused for certificate eligibility purposes.
                  The student will keep their current score but will not be blocked from receiving their
                  certificate.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {actionModal.action === "EXCUSED"
                    ? "Explanation (visible to student & principal)"
                    : "Message to student (optional)"}
                </label>
                <textarea
                  value={staffMessage}
                  onChange={(e) => setStaffMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder={
                    actionModal.action === "EXCUSED"
                      ? "Explain why this result is being excused..."
                      : actionModal.action === "DENIED"
                        ? "Explain why the retake is denied..."
                        : "Optional message to the student..."
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                onClick={() => { setActionModal(null); setStaffMessage(""); }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                disabled={submitting}
                className={
                  actionModal.action === "EXCUSED"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : actionModal.action === "DENIED"
                      ? "bg-red-600 hover:bg-red-700"
                      : ""
                }
              >
                {submitting
                  ? "Processing..."
                  : actionModal.action === "APPROVED_RETAKE"
                    ? "Approve Retake"
                    : actionModal.action === "EXCUSED"
                      ? "Mark as Excused"
                      : "Deny Request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
