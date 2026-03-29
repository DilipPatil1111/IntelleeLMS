import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { AssessmentResultsClient } from "@/components/assessment/assessment-results-client";

export default async function PrincipalAssessmentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "PRINCIPAL") redirect("/login");

  const a = await db.assessment.findUnique({ where: { id }, select: { id: true } });
  if (!a) notFound();

  return <AssessmentResultsClient assessmentId={id} role="principal" />;
}
