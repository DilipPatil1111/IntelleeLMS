import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmOnboardingButton } from "./confirm-onboarding-button";

export default async function OnboardingReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const pending = await db.studentOnboarding.findMany({
    where: {
      contractAcknowledgedAt: { not: null },
      governmentIdsUploadedAt: { not: null },
      feeProofUploadedAt: { not: null },
      preAdmissionCompletedAt: { not: null },
      principalConfirmedAt: null,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Onboarding review"
        description="Students who finished all checklist items and are waiting for final approval to unlock course content"
      />
      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">No students waiting for onboarding confirmation.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {row.user.firstName} {row.user.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{row.user.email}</p>
                </div>
                <ConfirmOnboardingButton userId={row.user.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
