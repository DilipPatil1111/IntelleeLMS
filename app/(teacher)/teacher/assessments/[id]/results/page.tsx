import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { AssessmentResultsClient } from "@/components/assessment/assessment-results-client";

export default async function TeacherAssessmentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const a = await db.assessment.findUnique({ where: { id }, select: { createdById: true } });
  if (!a) notFound();
  if (session.user.role !== "TEACHER") notFound();
  if (a.createdById !== session.user.id) notFound();

  return <AssessmentResultsClient assessmentId={id} role="teacher" />;
}
