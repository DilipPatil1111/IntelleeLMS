"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Mail,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 15;

interface Program {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  name: string;
  programId: string;
}

interface Receipt {
  id: string;
  fileName: string;
  amount: number;
  date: string;
  receiptUrl: string;
  confirmed: boolean;
}

interface StudentFeeRow {
  userId: string;
  name: string;
  email: string;
  programName: string | null;
  batchName: string | null;
  total: number;
  paid: number;
  pending: number;
  receipts: Receipt[];
}

function currency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
      </CardContent>
    </Card>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  );
}

export default function StudentFeesPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<StudentFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{
    userId: string;
    paymentId: string;
    studentName: string;
    fileName: string;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const batchOptions = useMemo(() => {
    const list = programId ? batches.filter((b) => b.programId === programId) : batches;
    return list.map((b) => ({ value: b.id, label: b.name }));
  }, [batches, programId]);

  const loadMeta = useCallback(async () => {
    const fetchOpts = { cache: "no-store" as const };
    const [pRes, bRes] = await Promise.all([
      fetch("/api/principal/programs", fetchOpts),
      fetch("/api/principal/batches", fetchOpts),
    ]);
    const pData = await pRes.json();
    const bData = await bRes.json();
    setPrograms(pData.programs || []);
    setBatches(bData.batches || []);
  }, []);

  useEffect(() => {
     
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    setPage(1);
  }, [programId, batchId]);

  const loadFees = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (programId) params.set("programId", programId);
    if (batchId) params.set("batchId", batchId);
    const q = params.toString();
    try {
      const res = await fetch(`/api/principal/students/fees${q ? `?${q}` : ""}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [programId, batchId]);

  useEffect(() => {
     
    void loadFees();
  }, [loadFees]);

  const summary = useMemo(() => {
    const totalStudents = students.length;
    let totalCollected = 0;
    let totalPending = 0;
    for (const s of students) {
      totalCollected += s.paid;
      totalPending += s.pending;
    }
    return { totalStudents, totalCollected, totalPending };
  }, [students]);

  function toggleRow(userId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleConfirmPayment() {
    if (!confirmModal) return;
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/principal/students/${confirmModal.userId}/fees/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: confirmModal.paymentId }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToast({
          message: (err as { error?: string }).error || "Failed to confirm payment.",
          tone: "error",
        });
        return;
      }
      const result = await res.json().catch(() => ({ ok: true }));
      if (result.emailSent === false) {
        setToast({ message: `Payment confirmed but email could not be sent: ${result.emailError || "unknown error"}`, tone: "error" });
      } else {
        setToast({ message: "Payment confirmed — email sent to student", tone: "success" });
      }
      setConfirmModal(null);
      void loadFees();
    } catch {
      setToast({ message: "Network error. Please try again.", tone: "error" });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Student Fees"
        actions={
          <div className="flex items-center gap-3">
            <div className="w-44">
              <Select
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  setBatchId("");
                }}
                options={programs.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="All programs"
              />
            </div>
            <div className="w-44">
              <Select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                options={batchOptions}
                placeholder="All batches"
              />
            </div>
          </div>
        }
      />

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all",
            toast.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          {toast.message}
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Total Students
                  </CardTitle>
                  <Users className="h-5 w-5 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.totalStudents}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Total Fees Collected
                  </CardTitle>
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {currency(summary.totalCollected)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Total Pending
                  </CardTitle>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600">
                  {currency(summary.totalPending)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Student fees table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-4 py-3" />
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Student Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Program
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Paid
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Pending
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                  No students found for the selected filters.
                </td>
              </tr>
            ) : (
              students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s) => {
                const isExpanded = expandedRows.has(s.userId);
                const hasReceipts = (s.receipts?.length ?? 0) > 0;
                return (
                  <StudentFeeRowBlock
                    key={s.userId}
                    student={s}
                    isExpanded={isExpanded}
                    hasReceipts={hasReceipts}
                    onToggle={() => toggleRow(s.userId)}
                    onConfirm={(receipt) =>
                      setConfirmModal({
                        userId: s.userId,
                        paymentId: receipt.id,
                        studentName: s.name,
                        fileName: receipt.fileName,
                      })
                    }
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={Math.ceil(students.length / PAGE_SIZE)} onPageChange={setPage} totalItems={students.length} itemLabel="students" className="mt-4" />

      {/* Confirm Payment modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title="Confirm Payment"
        className="max-w-md"
      >
        {confirmModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Confirm that the payment receipt{" "}
              <span className="font-medium text-gray-900">
                &ldquo;{confirmModal.fileName}&rdquo;
              </span>{" "}
              from{" "}
              <span className="font-medium text-gray-900">
                {confirmModal.studentName}
              </span>{" "}
              has been received? A confirmation email will be sent to the student.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span>
                Email with subject &ldquo;Payment Received — {confirmModal.studentName}&rdquo; will
                be sent.
              </span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmModal(null)}>
                Cancel
              </Button>
              <Button onClick={() => void handleConfirmPayment()} isLoading={confirming}>
                <CheckCircle2 className="h-4 w-4" />
                Confirm Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function StudentFeeRowBlock({
  student,
  isExpanded,
  hasReceipts,
  onToggle,
  onConfirm,
}: {
  student: StudentFeeRow;
  isExpanded: boolean;
  hasReceipts: boolean;
  onToggle: () => void;
  onConfirm: (receipt: Receipt) => void;
}) {
  const isPaid = student.pending === 0;

  return (
    <>
      <tr className={cn(isExpanded && "bg-gray-50/50")}>
        <td className="px-4 py-3">
          {hasReceipts ? (
            <button
              type="button"
              onClick={onToggle}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
              aria-label={isExpanded ? "Collapse receipts" : "Expand receipts"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.name}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{student.programName || "—"}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{student.email}</td>
        <td className="px-4 py-3 text-right text-sm text-gray-900">
          {currency(student.total)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-gray-900">
          {currency(student.paid)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-gray-900">
          {currency(student.pending)}
        </td>
        <td className="px-4 py-3">
          {isPaid ? (
            <Badge variant="success">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Paid
            </Badge>
          ) : (
            <Badge variant="warning">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Pending
            </Badge>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {hasReceipts && (
            <Button variant="ghost" size="sm" onClick={onToggle}>
              {isExpanded ? "Hide" : "Receipts"}
            </Button>
          )}
        </td>
      </tr>
      {isExpanded && hasReceipts && (
        <tr>
          <td colSpan={9} className="bg-gray-50 px-4 py-3">
            <div className="ml-8 space-y-2">
              <p className="text-xs font-medium uppercase text-gray-400">
                Payment Receipts
              </p>
              {student.receipts.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-gray-900">{r.fileName ?? "receipt"}</span>
                  <span className="text-gray-500">{currency(r.amount)}</span>
                  <span className="text-gray-400">
                    {new Date(r.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {r.confirmed ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Confirmed
                    </Badge>
                  ) : (
                    <Badge variant="warning">Unconfirmed</Badge>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {r.receiptUrl && (
                      <a
                        href={r.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </a>
                    )}
                    {!r.confirmed && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onConfirm(r)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirm Payment
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
