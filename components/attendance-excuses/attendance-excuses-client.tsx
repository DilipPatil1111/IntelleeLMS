"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  X,
  Clock,
  CheckCircle2,
  CalendarX2,
  MessageSquare,
  Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";

interface ExcuseRequest {
  id: string;
  attendanceRecordId: string;
  studentUserId: string;
  status: string;
  studentMessage: string | null;
  staffMessage: string | null;
  resolvedAt: string | null;
  createdAt: string;
  attendanceRecord: {
    id: string;
    status: string;
    session: {
      sessionDate: string;
      startTime: string | null;
      endTime: string | null;
      subject: { name: string; programId: string } | null;
      batch: { name: string } | null;
      createdBy?: { firstName: string; lastName: string };
    } | null;
  };
  student: { id: string; firstName: string; lastName: string; email: string };
  resolvedBy: { firstName: string; lastName: string } | null;
}

interface Props {
  apiBasePath: string;
  role: "teacher" | "principal";
  embedded?: boolean;
}

export function AttendanceExcusesClient({ apiBasePath, role, embedded = false }: Props) {
  const [requests, setRequests] = useState<ExcuseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{ req: ExcuseRequest; action: string } | null>(null);
  const [staffMessage, setStaffMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "RESOLVED">("PENDING");
  const { toasts, toast, dismiss } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBasePath);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch (err) {
      console.error("Failed to load attendance excuse requests:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    void load();
  }, [load]);

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
        toast(errBody?.error ?? "Action failed", "error");
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
        {!embedded && <PageHeader title="Attendance Excuse Requests" description="Manage student attendance excuse requests" />}
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
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      {!embedded && (
        <PageHeader
          title="Attendance Excuse Requests"
          description={
            pendingCount > 0
              ? `${pendingCount} pending request${pendingCount === 1 ? "" : "s"} require your attention`
              : "No pending excuse requests"
          }
        />
      )}

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
              {filter === "PENDING" ? "No pending excuse requests." : "No excuse requests found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const isPending = r.status === "PENDING";
            const isExcused = r.status === "EXCUSED";
            const isDenied = r.status === "DENIED";
            const isKeptAbsent = r.status === "KEPT_ABSENT";
            const sessionDate = r.attendanceRecord.session?.sessionDate
              ? new Date(r.attendanceRecord.session.sessionDate).toLocaleDateString()
              : "—";

            return (
              <Card
                key={r.id}
                className={
                  isPending
                    ? "border-yellow-200"
                    : isExcused
                      ? "border-green-200 bg-green-50/30"
                      : isDenied
                        ? "border-red-200 bg-red-50/30"
                        : isKeptAbsent
                          ? "border-gray-200 bg-gray-50/30"
                          : undefined
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarX2 className="h-4 w-4 text-orange-500" />
                    <span className="truncate">
                      {r.attendanceRecord.session?.subject?.name ?? "Unknown Subject"}
                    </span>
                    <span className="text-sm font-normal text-gray-500">
                      ({sessionDate}
                      {r.attendanceRecord.session?.batch?.name
                        ? ` · ${r.attendanceRecord.session.batch.name}`
                        : ""}
                      )
                    </span>
                    <span className="ml-auto shrink-0">
                      {isPending && (
                        <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                      {isExcused && (
                        <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> Excused
                        </span>
                      )}
                      {isDenied && (
                        <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <X className="h-3 w-3" /> Denied
                        </span>
                      )}
                      {isKeptAbsent && (
                        <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Ban className="h-3 w-3" /> Kept Absent
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
                      <span className="text-gray-500">Current Status:</span>{" "}
                      <span className={`font-medium ${r.attendanceRecord.status === "EXCUSED" ? "text-green-600" : "text-red-600"}`}>
                        {r.attendanceRecord.status}
                      </span>
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
                        <span className="font-medium">Student&apos;s reason:</span>
                      </div>
                      <p className="text-gray-700">{r.studentMessage}</p>
                    </div>
                  )}

                  {r.staffMessage && (
                    <div
                      className={`rounded-lg p-3 text-sm ${
                        isExcused ? "bg-green-50" : "bg-blue-50"
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

                  {role === "principal" && r.attendanceRecord.session?.createdBy && (
                    <p className="text-xs text-gray-400">
                      Session by: {r.attendanceRecord.session.createdBy.firstName}{" "}
                      {r.attendanceRecord.session.createdBy.lastName}
                    </p>
                  )}

                  {isPending && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => setActionModal({ req: r, action: "EXCUSED" })}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Excuse
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => setActionModal({ req: r, action: "DENIED" })}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Deny
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-400 text-gray-700 hover:bg-gray-100"
                        onClick={() => setActionModal({ req: r, action: "KEPT_ABSENT" })}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" /> Keep Absent
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {actionModal.action === "EXCUSED"
                  ? "Excuse Absence"
                  : actionModal.action === "DENIED"
                    ? "Deny Excuse Request"
                    : "Keep Absent"}
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
                  <span className="font-medium">Subject:</span>{" "}
                  {actionModal.req.attendanceRecord.session?.subject?.name ?? "—"}
                </p>
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {actionModal.req.attendanceRecord.session?.sessionDate
                    ? new Date(actionModal.req.attendanceRecord.session.sessionDate).toLocaleDateString()
                    : "—"}
                </p>
              </div>

              {actionModal.action === "EXCUSED" && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                  The student&apos;s attendance will be changed from &quot;Absent&quot; to &quot;Excused&quot;.
                  This will not count against their attendance percentage.
                </div>
              )}

              {actionModal.action === "KEPT_ABSENT" && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
                  The student will remain marked as &quot;Absent&quot;. The request will be resolved.
                </div>
              )}

              {actionModal.req.studentMessage && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="text-gray-500 font-medium text-xs mb-1">Student&apos;s reason:</p>
                  <p className="text-gray-700">{actionModal.req.studentMessage}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment (visible to student)
                </label>
                <textarea
                  value={staffMessage}
                  onChange={(e) => setStaffMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder={
                    actionModal.action === "EXCUSED"
                      ? "Optional — comment about excusing this absence..."
                      : actionModal.action === "DENIED"
                        ? "Explain why the excuse is denied..."
                        : "Explain why absence is being kept..."
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
                    ? "bg-green-600 hover:bg-green-700"
                    : actionModal.action === "DENIED"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-gray-600 hover:bg-gray-700"
                }
              >
                {submitting
                  ? "Processing..."
                  : actionModal.action === "EXCUSED"
                    ? "Mark as Excused"
                    : actionModal.action === "DENIED"
                      ? "Deny Request"
                      : "Keep Absent"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
