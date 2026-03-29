import { TakeAssessmentClient } from "./take-assessment-client";

export default async function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TakeAssessmentClient assessmentId={id} />;
}
