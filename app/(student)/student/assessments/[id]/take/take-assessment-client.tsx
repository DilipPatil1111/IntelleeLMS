"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

interface Option {
  id: string;
  optionText: string;
  orderIndex: number;
}

interface Question {
  id: string;
  type: "MCQ" | "SHORT" | "PARAGRAPH";
  questionText: string;
  marks: number;
  orderIndex: number;
  options: Option[];
  maxLength: number | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  additionalInfo?: string | null;
}

interface AssessmentData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  totalMarks: number;
  duration: number | null;
  instructions: string | null;
  questions: Question[];
  attemptId?: string;
}

export function TakeAssessmentClient({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
     
    setError("");

    fetch(`/api/assessments/${assessmentId}/start`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setAssessment(data);
          const saved: Record<string, string> = {};
          data.existingAnswers?.forEach(
            (a: {
              questionId: string;
              answerText?: string;
              selectedOptionId?: string;
            }) => {
              saved[a.questionId] = a.answerText || a.selectedOptionId || "";
            }
          );
          setAnswers(saved);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load assessment");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  async function handleSubmit() {
    if (!assessment) return;
    setSubmitting(true);

    const res = await fetch(`/api/assessments/${assessmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: assessment.attemptId, answers }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSubmitting(false);
    } else {
      router.push("/student/results");
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading assessment...</p>
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{error}</p>
      </div>
    );
  if (!assessment) return null;

  const question = assessment.questions[currentQ];

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={`${assessment.type} — ${assessment.totalMarks} total marks — Question ${currentQ + 1} of ${assessment.questions.length}`}
      />

      {assessment.instructions && (
        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
          {assessment.instructions}
        </div>
      )}

      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Badge variant="info">Q{currentQ + 1}</Badge>
            <Badge>{question.marks} marks</Badge>
          </div>
          <p className="text-base font-medium text-gray-900 mb-4">
            {question.questionText}
          </p>

          {question.mediaUrl && (
            <div className="mb-4 rounded-lg border border-gray-200 p-3 bg-gray-50">
              {question.mediaType === "video" && (
                <div className="aspect-video rounded overflow-hidden">
                  {question.mediaUrl.includes("youtube.com") || question.mediaUrl.includes("youtu.be") ? (
                    <iframe src={question.mediaUrl.replace("watch?v=", "embed/")} className="w-full h-full" allowFullScreen />
                  ) : (
                    <video src={question.mediaUrl} controls className="w-full h-full" />
                  )}
                </div>
              )}
              {question.mediaType === "audio" && (
                <audio src={question.mediaUrl} controls className="w-full" />
              )}
              {question.mediaType === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={question.mediaUrl} alt="Question resource" className="max-w-full rounded" />
              )}
              {(question.mediaType === "link" || question.mediaType === "document") && (
                <a href={question.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-sm">
                  View attached resource
                </a>
              )}
            </div>
          )}

          {question.additionalInfo && (
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
              {question.additionalInfo}
            </div>
          )}

          {question.type === "MCQ" && (
            <div className="space-y-3">
              {question.options
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      answers[question.id] === opt.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={opt.id}
                      checked={answers[question.id] === opt.id}
                      onChange={() =>
                        setAnswers({ ...answers, [question.id]: opt.id })
                      }
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      {opt.optionText}
                    </span>
                  </label>
                ))}
            </div>
          )}

          {question.type === "SHORT" && (
            <input
              type="text"
              value={answers[question.id] || ""}
              onChange={(e) =>
                setAnswers({ ...answers, [question.id]: e.target.value })
              }
              placeholder="Type your answer (1-2 sentences)"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              maxLength={question.maxLength || 500}
            />
          )}

          {question.type === "PARAGRAPH" && (
            <Textarea
              value={answers[question.id] || ""}
              onChange={(e) =>
                setAnswers({ ...answers, [question.id]: e.target.value })
              }
              placeholder="Write your detailed answer here..."
              className="min-h-[150px]"
              maxLength={question.maxLength || 5000}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
        >
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {assessment.questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`h-8 w-8 rounded-full text-xs font-medium ${
                i === currentQ
                  ? "bg-indigo-600 text-white"
                  : answers[assessment.questions[i].id]
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentQ < assessment.questions.length - 1 ? (
          <Button onClick={() => setCurrentQ(currentQ + 1)}>Next</Button>
        ) : (
          <Button
            onClick={handleSubmit}
            isLoading={submitting}
            variant="primary"
          >
            Submit Assessment
          </Button>
        )}
      </div>
    </>
  );
}
