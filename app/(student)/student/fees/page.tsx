import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate } from "@/lib/utils";
import { DollarSign, CreditCard, AlertTriangle } from "lucide-react";
import { FeeReceiptsClient } from "./fee-receipts-client";

export default async function StudentFeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      studentProfile: {
        include: {
          feePayments: {
            include: { feeStructure: { include: { program: { select: { id: true, name: true } } } } },
            orderBy: { paymentDate: "desc" },
          },
          program: { include: { feeStructures: true } },
        },
      },
    },
  });

  if (!user?.studentProfile) {
    return (
      <>
        <PageHeader title="My Fees" description="View fee structure and payment history" />
        <Card><CardContent>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">Your student profile is not set up yet.</p>
            <p className="text-sm text-gray-400">Please contact your teacher or administrator to assign you to a program and batch.</p>
          </div>
        </CardContent></Card>
      </>
    );
  }

  const profile = user.studentProfile;

  // Get all enrolled programs via ProgramEnrollment
  const enrollments = await db.programEnrollment.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
    },
    include: {
      program: { include: { feeStructures: true } },
    },
  });

  // Build program fee data: from enrollments + fallback to profile
  const programFeeMap = new Map<string, {
    programName: string;
    feeStructures: { id: string; name: string; totalAmount: number; dueDate: string | null; term: string | null }[];
  }>();

  for (const e of enrollments) {
    if (!programFeeMap.has(e.programId) && e.program.feeStructures.length > 0) {
      programFeeMap.set(e.programId, {
        programName: e.program.name,
        feeStructures: e.program.feeStructures.map((fs) => ({
          id: fs.id,
          name: fs.name,
          totalAmount: fs.totalAmount,
          dueDate: fs.dueDate?.toISOString() ?? null,
          term: fs.term,
        })),
      });
    }
  }
  if (profile.programId && !programFeeMap.has(profile.programId) && profile.program?.feeStructures.length) {
    programFeeMap.set(profile.programId, {
      programName: profile.program.name,
      feeStructures: profile.program.feeStructures.map((fs) => ({
        id: fs.id,
        name: fs.name,
        totalAmount: fs.totalAmount,
        dueDate: fs.dueDate?.toISOString() ?? null,
        term: fs.term,
      })),
    });
  }

  // Group payments by program
  const paymentsByProgram = new Map<string, typeof profile.feePayments>();
  for (const fp of profile.feePayments) {
    const pid = fp.feeStructure.program?.id ?? "unknown";
    if (!paymentsByProgram.has(pid)) paymentsByProgram.set(pid, []);
    paymentsByProgram.get(pid)!.push(fp);
  }

  // Calculate totals across all programs
  let grandTotalFees = 0;
  let grandTotalPaid = 0;
  for (const [, pf] of programFeeMap) {
    grandTotalFees += pf.feeStructures.reduce((s, fs) => s + fs.totalAmount, 0);
  }
  grandTotalPaid = profile.feePayments.reduce((s, fp) => s + fp.amountPaid, 0);
  const grandPending = grandTotalFees - grandTotalPaid;

  const programEntries = Array.from(programFeeMap.entries());

  return (
    <>
      <PageHeader
        title="My Fees"
        description="View fee structure and payment history across all enrolled programs"
      />

      {/* Grand total stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Fees"
          value={`$${grandTotalFees.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          variant="indigo"
        />
        <StatCard
          title="Paid"
          value={`$${grandTotalPaid.toLocaleString()}`}
          icon={<CreditCard className="h-5 w-5" />}
          variant="emerald"
        />
        <StatCard
          title="Pending"
          value={`$${grandPending.toLocaleString()}`}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={grandPending > 0 ? "rose" : "emerald"}
        />
      </div>

      {/* Program-wise fee breakdown */}
      {programEntries.length > 0 ? (
        <div className="space-y-6 mb-8">
          {programEntries.map(([pid, pf]) => {
            const progPayments = paymentsByProgram.get(pid) || [];
            const progTotal = pf.feeStructures.reduce((s, fs) => s + fs.totalAmount, 0);
            const progPaid = progPayments.reduce((s, fp) => s + fp.amountPaid, 0);
            const progPending = progTotal - progPaid;

            return (
              <Card key={pid}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{pf.programName}</span>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${progPending > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                      {progPending > 0 ? `$${progPending.toLocaleString()} pending` : "Fully paid"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Fee structure breakdown */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Fee Structure</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Fee Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                            {pf.feeStructures.some((fs) => fs.term) && (
                              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Term</th>
                            )}
                            {pf.feeStructures.some((fs) => fs.dueDate) && (
                              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Due Date</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {pf.feeStructures.map((fs) => (
                            <tr key={fs.id}>
                              <td className="px-4 py-2 text-sm text-gray-900">{fs.name}</td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">${fs.totalAmount.toLocaleString()}</td>
                              {pf.feeStructures.some((f) => f.term) && (
                                <td className="px-4 py-2 text-sm text-gray-500">{fs.term || "—"}</td>
                              )}
                              {pf.feeStructures.some((f) => f.dueDate) && (
                                <td className="px-4 py-2 text-sm text-gray-500">{fs.dueDate ? formatDate(fs.dueDate) : "—"}</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50">
                            <td className="px-4 py-2 text-sm font-semibold text-gray-900">Total</td>
                            <td className="px-4 py-2 text-sm font-semibold text-gray-900">${progTotal.toLocaleString()}</td>
                            {pf.feeStructures.some((f) => f.term) && <td />}
                            {pf.feeStructures.some((f) => f.dueDate) && <td />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Payment summary bar */}
                  <div className="mb-4 rounded-lg bg-gray-50 p-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Payment progress</span>
                      <span className="font-medium">${progPaid.toLocaleString()} / ${progTotal.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${progTotal > 0 ? Math.min(100, Math.round((progPaid / progTotal) * 100)) : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Payment history for this program */}
                  {progPayments.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Payment History</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Fee Type</th>
                              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Method</th>
                              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Reference</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {progPayments.map((payment) => (
                              <tr key={payment.id}>
                                <td className="px-4 py-2 text-sm text-gray-900">{formatDate(payment.paymentDate)}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{payment.feeStructure.name}</td>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">${payment.amountPaid.toLocaleString()}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{payment.paymentMethod || "—"}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{payment.transactionRef || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {progPayments.length === 0 && (
                    <p className="text-sm text-gray-500">No payments recorded yet for this program.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mb-8">
          <CardContent>
            <p className="text-center text-gray-500 py-8">No fee structures assigned to your enrolled programs.</p>
          </CardContent>
        </Card>
      )}

      <FeeReceiptsClient />
    </>
  );
}
