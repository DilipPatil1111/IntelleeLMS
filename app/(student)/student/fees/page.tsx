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
            include: { feeStructure: true },
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

  const totalFees =
    user.studentProfile.program?.feeStructures.reduce(
      (sum, fs) => sum + fs.totalAmount,
      0
    ) || 0;
  const totalPaid = user.studentProfile.feePayments.reduce(
    (sum, fp) => sum + fp.amountPaid,
    0
  );
  const pending = totalFees - totalPaid;

  return (
    <>
      <PageHeader
        title="My Fees"
        description="View fee structure and payment history"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Fees"
          value={`$${totalFees.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Paid"
          value={`$${totalPaid.toLocaleString()}`}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatCard
          title="Pending"
          value={`$${pending.toLocaleString()}`}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {user.studentProfile.feePayments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No payments recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Fee Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {user.studentProfile.feePayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {payment.feeStructure.name}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        ${payment.amountPaid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {payment.paymentMethod || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {payment.transactionRef || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <FeeReceiptsClient />
    </>
  );
}
