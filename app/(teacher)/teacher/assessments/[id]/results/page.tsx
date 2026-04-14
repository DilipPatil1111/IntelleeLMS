import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { AssessmentResultsClient } from "@/components/assessment/assessment-results-client";
import { canViewAssessmentResults } from "@/lib/assessment-detailed-results";
import { hasTeacherPortalAccess } from "@/lib/portal-access";

export default async function TeacherAssessmentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasTeacherPortalAccess(session)) notFound();

  const allowed = await canViewAssessmentResults(session.user.id, session, id);
  if (!allowed) notFound();

  return <AssessmentResultsClient assessmentId={id} role="teacher" />;
}
