import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { CopyLinkButton } from "./copy-link-button";
import { AssessmentActions } from "./assessment-actions";
import { getServerAppUrl } from "@/lib/app-url";

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      subject: true,
      batch: true,
      questions: { include: { options: true }, orderBy: { orderIndex: "asc" } },
      attempts: { include: { student: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!assessment) notFound();

  if (session.user.role === "TEACHER" && assessment.createdById !== session.user.id) {
    notFound();
  }

  const appUrl = getServerAppUrl();
  const assessmentLink = `${appUrl}/assess/${assessment.linkToken}`;
  const isDraft = assessment.status === "DRAFT";

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={`${assessment.subject?.name} — ${assessment.batch?.name}`}
        actions={
          <div className="flex items-center gap-2">
            <CopyLinkButton link={assessmentLink} />
            {isDraft && (
              <Link href={`/teacher/assessments/${assessment.id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
            )}
            <AssessmentActions assessmentId={assessment.id} status={assessment.status} title={assessment.title} />
            <Link href={`/teacher/grading?assessmentId=${assessment.id}`}>
              <Button variant="outline">Grade Submissions</Button>
            </Link>
          </div>
        }
      />

      {isDraft && (
        <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-700">
          This assessment is in <strong>DRAFT</strong> mode. Students cannot see it until you publish. Use <strong>Edit</strong> to modify questions or <strong>Publish</strong> to make it available.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Type</dt><dd><Badge>{assessment.type}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd><Badge variant={assessment.status === "PUBLISHED" ? "success" : assessment.status === "DRAFT" ? "warning" : "default"}>{assessment.status}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Total Marks</dt><dd className="font-medium">{assessment.totalMarks}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Passing Marks</dt><dd className="font-medium">{assessment.passingMarks || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Duration</dt><dd>{assessment.duration ? `${assessment.duration} min` : "Unlimited"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Questions</dt><dd>{assessment.questions.length}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Link Token</dt><dd className="text-xs font-mono truncate max-w-[120px]">{assessment.linkToken}</dd></div>
              {assessment.assessmentDate && <div className="flex justify-between"><dt className="text-gray-500">Date</dt><dd>{formatDate(assessment.assessmentDate)}</dd></div>}
              {assessment.scheduledOpenAt && <div className="flex justify-between"><dt className="text-gray-500">Opens</dt><dd>{formatDateTime(assessment.scheduledOpenAt)}</dd></div>}
              {assessment.scheduledCloseAt && <div className="flex justify-between"><dt className="text-gray-500">Closes</dt><dd>{formatDateTime(assessment.scheduledCloseAt)}</dd></div>}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Questions ({assessment.questions.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assessment.questions.map((q, idx) => (
                <div key={q.id} className="p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="info">Q{idx + 1}</Badge>
                    <Badge>{q.type}</Badge>
                    <span className="text-xs text-gray-400">{q.marks} marks</span>
                  </div>
                  <p className="text-sm text-gray-900">{q.questionText}</p>
                  {q.type === "MCQ" && (
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt) => (
                        <p key={opt.id} className={`text-xs ${opt.isCorrect ? "text-green-600 font-medium" : "text-gray-500"}`}>
                          {opt.isCorrect ? "✓" : "○"} {opt.optionText}
                        </p>
                      ))}
                    </div>
                  )}
                  {q.correctAnswer && <p className="text-xs text-green-600 mt-1"><span className="font-medium">Answer:</span> {q.correctAnswer}</p>}
                  {q.mediaUrl && (
                    <p className="text-xs text-indigo-600 mt-1">
                      <span className="font-medium">Media ({q.mediaType}):</span>{" "}
                      <a href={q.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">{q.mediaUrl.length > 50 ? q.mediaUrl.slice(0, 50) + "..." : q.mediaUrl}</a>
                    </p>
                  )}
                  {q.additionalInfo && <p className="text-xs text-blue-600 mt-1"><span className="font-medium">Info:</span> {q.additionalInfo}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Submissions ({assessment.attempts.length})</CardTitle></CardHeader>
        <CardContent>
          {assessment.attempts.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assessment.attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{attempt.student.firstName} {attempt.student.lastName}</td>
                      <td className="px-4 py-3"><Badge variant={attempt.status === "GRADED" ? "success" : attempt.status === "SUBMITTED" ? "warning" : "default"}>{attempt.status}</Badge></td>
                      <td className="px-4 py-3 text-sm">{attempt.totalScore !== null ? `${attempt.totalScore}/${assessment.totalMarks} (${attempt.percentage}%)` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
