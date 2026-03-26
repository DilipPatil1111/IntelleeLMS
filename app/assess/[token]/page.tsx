import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AssessmentLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const assessment = await db.assessment.findUnique({
    where: { linkToken: token },
    select: { id: true, status: true },
  });

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Assessment Not Found</h1>
          <p className="text-gray-500">This assessment link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/assess/${token}`);
  }

  redirect(`/student/assessments/${assessment.id}/take`);
}
