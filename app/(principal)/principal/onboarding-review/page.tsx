import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmOnboardingButton } from "./confirm-onboarding-button";
import { blobFileUrl } from "@/lib/blob-url";
import { FileText, Download, Eye, CheckCircle2, Clock } from "lucide-react";

export default async function OnboardingReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const allOnboarding = await db.studentOnboarding.findMany({
    where: {
      user: {
        studentProfile: { status: { in: ["ACCEPTED", "ENROLLED"] } },
      },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const pendingConfirmation = allOnboarding.filter(
    (r) =>
      r.contractAcknowledgedAt &&
      r.governmentIdsUploadedAt &&
      r.feeProofUploadedAt &&
      !r.principalConfirmedAt
  );

  const confirmed = allOnboarding.filter((r) => r.principalConfirmedAt);

  const partiallyComplete = allOnboarding.filter(
    (r) =>
      !r.principalConfirmedAt &&
      !(r.contractAcknowledgedAt && r.governmentIdsUploadedAt && r.feeProofUploadedAt)
  );

  function DocRow({ label, url, fileName, uploadedAt }: { label: string; url: string | null; fileName: string | null; uploadedAt: Date | null }) {
    if (!url) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          <span>{label}: <span className="italic">Not yet submitted</span></span>
        </div>
      );
    }
    const displayName = fileName || "document";
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-400 text-xs truncate max-w-[200px]">({displayName})</span>
        {uploadedAt && (
          <span className="text-xs text-gray-400">{uploadedAt.toLocaleDateString()}</span>
        )}
        <a
          href={blobFileUrl(url, displayName, true)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-indigo-600 hover:text-indigo-800 shrink-0 flex items-center gap-0.5 text-xs font-medium"
        >
          <Eye className="h-3 w-3" /> View
        </a>
        <a
          href={blobFileUrl(url, displayName)}
          download={displayName}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 shrink-0 flex items-center gap-0.5 text-xs font-medium"
        >
          <Download className="h-3 w-3" /> Download
        </a>
      </div>
    );
  }

  function StudentCard({ row, showConfirm }: { row: typeof allOnboarding[number]; showConfirm: boolean }) {
    return (
      <Card key={row.id}>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900">
                {row.user.firstName} {row.user.lastName}
              </p>
              <p className="text-sm text-gray-500">{row.user.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {row.principalConfirmedAt ? (
                <Badge variant="success">Confirmed</Badge>
              ) : row.contractAcknowledgedAt && row.governmentIdsUploadedAt && row.feeProofUploadedAt ? (
                <Badge variant="warning">Ready for Confirmation</Badge>
              ) : (
                <Badge variant="default">In Progress</Badge>
              )}
              {showConfirm && <ConfirmOnboardingButton userId={row.user.id} />}
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Submitted Documents</span>
            </div>
            <DocRow
              label="Student Agreement"
              url={row.signedContractUploadUrl}
              fileName={row.signedContractFileName}
              uploadedAt={row.contractAcknowledgedAt}
            />
            <DocRow
              label="Government ID"
              url={row.governmentIdUploadUrl}
              fileName={row.governmentIdFileName}
              uploadedAt={row.governmentIdsUploadedAt}
            />
            <DocRow
              label="Fee Payment Proof"
              url={row.feeProofUploadUrl}
              fileName={row.feeProofFileName}
              uploadedAt={row.feeProofUploadedAt}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Onboarding Review"
        description="Review student document submissions. View or download uploaded files. Confirm to set students to Enrolled."
      />

      {pendingConfirmation.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Badge variant="warning" dot>{pendingConfirmation.length}</Badge>
            Ready for Confirmation
          </h3>
          <div className="space-y-3">
            {pendingConfirmation.map((row) => (
              <StudentCard key={row.id} row={row} showConfirm />
            ))}
          </div>
        </div>
      )}

      {partiallyComplete.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            In Progress ({partiallyComplete.length})
          </h3>
          <div className="space-y-3">
            {partiallyComplete.map((row) => (
              <StudentCard key={row.id} row={row} showConfirm={false} />
            ))}
          </div>
        </div>
      )}

      {confirmed.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Confirmed ({confirmed.length})
          </h3>
          <div className="space-y-3">
            {confirmed.map((row) => (
              <StudentCard key={row.id} row={row} showConfirm={false} />
            ))}
          </div>
        </div>
      )}

      {allOnboarding.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">No student onboarding records found.</CardContent>
        </Card>
      )}
    </>
  );
}
