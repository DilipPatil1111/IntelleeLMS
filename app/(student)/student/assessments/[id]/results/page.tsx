import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { AssessmentResultsClient } from "@/components/assessment/assessment-results-client";
import { canStudentViewOwnAssessmentResults } from "@/lib/assessment-detailed-results";

export default async function StudentAssessmentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") notFound();

  const allowed = await canStudentViewOwnAssessmentResults(session.user.id, id);
  if (!allowed) notFound();

  return <AssessmentResultsClient assessmentId={id} role="student" />;
}
