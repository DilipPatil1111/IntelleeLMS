import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ResultsListClient } from "./results-list-client";

export default async function StudentResultsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [attempts, institution] = await Promise.all([
    db.attempt.findMany({
      where: {
        studentId: session.user.id,
        status: { in: ["SUBMITTED", "GRADED"] },
      },
      include: {
        assessment: { include: { subject: true } },
        answers: true,
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.institutionProfile.findFirst({ select: { logoUrl: true, legalName: true } }),
  ]);

  const collegeName = process.env.NEXT_PUBLIC_COLLEGE_NAME?.trim() || institution?.legalName || "Intellee College";

  return (
    <>
      <PageHeader
        title="My Results"
        description="View your assessment results and scores"
        actions={
          <div className="flex items-center gap-3">
            {institution?.logoUrl && (
              <img src={institution.logoUrl} alt={collegeName} className="h-10 w-auto object-contain" />
            )}
            <span className="text-lg font-bold text-indigo-700">{collegeName}</span>
          </div>
        }
      />
      <ResultsListClient attempts={JSON.parse(JSON.stringify(attempts))} />
    </>
  );
}
