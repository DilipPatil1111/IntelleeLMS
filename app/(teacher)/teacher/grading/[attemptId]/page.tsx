"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";

interface AnswerData {
  id: string;
  questionId: string;
  answerText: string | null;
  selectedOptionId: string | null;
  autoScore: number | null;
  manualScore: number | null;
  feedback: string | null;
  isGraded: boolean;
  question: {
    id: string;
    type: string;
    questionText: string;
    marks: number;
    correctAnswer: string | null;
    options: { id: string; optionText: string; isCorrect: boolean }[];
  };
}

interface AttemptData {
  id: string;
  studentName: string;
  assessmentTitle: string;
  totalMarks: number;
  answers: AnswerData[];
  feedback: string | null;
}

export default function GradeAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/teacher/grading/${params.attemptId}`)
      .then((r) => r.json())
      .then((data) => {
        setAttempt(data);
        const s: Record<string, number> = {};
        const f: Record<string, string> = {};
        data.answers?.forEach((a: AnswerData) => {
          s[a.id] = a.manualScore ?? a.autoScore ?? 0;
          f[a.id] = a.feedback || "";
        });
        setScores(s);
        setFeedbacks(f);
        setOverallFeedback(data.feedback || "");
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load");
        setLoading(false);
      });
  }, [params.attemptId]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/teacher/grading/${params.attemptId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores, feedbacks, overallFeedback }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      router.push("/teacher/grading");
    }
    setSaving(false);
  }

  if (loading)
    return <p className="text-center text-gray-500 py-8">Loading...</p>;
  if (!attempt)
    return (
      <p className="text-center text-red-500 py-8">{error || "Not found"}</p>
    );

  return (
    <>
      <PageHeader
        title={`Grade: ${attempt.studentName}`}
        description={attempt.assessmentTitle}
      />
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {attempt.answers.map((answer, idx) => {
          const isCorrectMCQ =
            answer.question.type === "MCQ" &&
            answer.question.options.find(
              (o) => o.id === answer.selectedOptionId
            )?.isCorrect;
          return (
            <Card key={answer.id}>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="info">Q{idx + 1}</Badge>
                  <Badge>{answer.question.type}</Badge>
                  <span className="text-xs text-gray-400">
                    {answer.question.marks} marks
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {answer.question.questionText}
                </p>

                {answer.question.type === "MCQ" && (
                  <div className="mb-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Selected:</span>{" "}
                      {answer.question.options.find(
                        (o) => o.id === answer.selectedOptionId
                      )?.optionText || "No answer"}
                    </p>
                    <p className="text-sm text-green-600">
                      <span className="font-medium">Correct:</span>{" "}
                      {
                        answer.question.options.find((o) => o.isCorrect)
                          ?.optionText
                      }
                    </p>
                    {isCorrectMCQ && (
                      <Badge variant="success" className="mt-1">
                        Auto-graded: Correct
                      </Badge>
                    )}
                  </div>
                )}

                {answer.question.type !== "MCQ" && (
                  <div className="mb-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Student Answer:</span>
                    </p>
                    <div className="p-2 rounded bg-gray-50 text-sm text-gray-600 mt-1">
                      {answer.answerText || "No answer"}
                    </div>
                    {answer.question.correctAnswer && (
                      <p className="text-xs text-green-600 mt-1">
                        <span className="font-medium">Expected:</span>{" "}
                        {answer.question.correctAnswer}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <Input
                    label="Score"
                    type="number"
                    min={0}
                    max={answer.question.marks}
                    value={scores[answer.id] ?? 0}
                    onChange={(e) =>
                      setScores({
                        ...scores,
                        [answer.id]: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <Input
                    label="Feedback"
                    value={feedbacks[answer.id] || ""}
                    onChange={(e) =>
                      setFeedbacks({
                        ...feedbacks,
                        [answer.id]: e.target.value,
                      })
                    }
                    placeholder="Improvement suggestions..."
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent>
          <Textarea
            label="Overall Feedback / Improvement Suggestions"
            value={overallFeedback}
            onChange={(e) => setOverallFeedback(e.target.value)}
            placeholder="Overall comments for the student..."
          />
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm font-medium text-gray-700">
              Total Score:{" "}
              {Object.values(scores).reduce((s, v) => s + v, 0)} /{" "}
              {attempt.totalMarks}
            </p>
            <Button onClick={handleSave} isLoading={saving}>
              Save Grades
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
