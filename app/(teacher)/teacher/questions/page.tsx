import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function QuestionBankPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const questions = await db.question.findMany({
    where: { assessment: { createdById: session.user.id } },
    include: { assessment: { include: { subject: true } }, options: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Question Bank"
        description="Browse all questions across your assessments"
      />
      {questions.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-gray-500 py-8">
              No questions created yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <Card key={q.id}>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="info">{q.type}</Badge>
                  <Badge>{q.marks} marks</Badge>
                  <span className="text-xs text-gray-400">
                    {q.assessment.subject?.name} — {q.assessment.title}
                  </span>
                </div>
                <p className="text-sm text-gray-900">{q.questionText}</p>
                {q.type === "MCQ" && q.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.options.map((o) => (
                      <span
                        key={o.id}
                        className={`text-xs px-2 py-0.5 rounded ${o.isCorrect ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {o.optionText}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
