"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Lesson = {
  id: string;
  title: string;
  kind: string;
};

type Chapter = {
  id: string;
  title: string;
  isMandatory: boolean;
  lessons: Lesson[];
};

type Subject = {
  id: string;
  name: string;
  code: string;
  programChapters: Chapter[];
};

export default function StudentProgramContentPage() {
  const [program, setProgram] = useState<{
    name: string;
    programSyllabus: { instructions: string | null; programHours: string | null; feesNote: string | null } | null;
    subjects: Subject[];
  } | null>(null);
  const [published, setPublished] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{
    incompleteLessons: number;
    totalLessons: number;
    eligibleForCertificate: boolean;
    certificateSent: boolean;
  } | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/program-content")
      .then((r) => r.json())
      .then((data) => {
        if (data.message && !data.program) setMessage(data.message);
        if (data.syllabusPublished === false) setPublished(false);
        setProgram(data.program);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch("/api/student/program-content/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function markComplete(lessonId: string, kind: string) {
    if (kind === "QUIZ") {
      window.location.href = "/student/assessments";
      return;
    }
    setCompleting(lessonId);
    try {
      const res = await fetch(`/api/student/program-content/lessons/${lessonId}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        const s = await fetch("/api/student/program-content/status").then((r) => r.json());
        setStatus(s);
      }
    } finally {
      setCompleting(null);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Program Content" />
        <p className="text-sm text-gray-500">Loading…</p>
      </>
    );
  }

  if (!published || !program) {
    return (
      <>
        <PageHeader title="Program Content" />
        <Card>
          <CardContent className="py-8 text-center text-gray-600">
            {message || "Program content is not available yet."}
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Program Content"
        description={`${program.name} — view-only syllabus`}
      />

      {status && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm">
          {status.certificateSent ? (
            <p className="font-semibold text-green-800">You have completed this program. Your certificate was emailed to you.</p>
          ) : status.eligibleForCertificate ? (
            <p className="font-semibold text-indigo-800">You are eligible for the program completion certificate. Your institution will email it when issued.</p>
          ) : status.totalLessons > 0 ? (
            <p className="text-gray-700">
              Progress: {status.totalLessons - status.incompleteLessons} / {status.totalLessons} lessons completed.
            </p>
          ) : null}
        </div>
      )}

      {program.programSyllabus?.instructions && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Program instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{program.programSyllabus.instructions}</p>
          </CardContent>
        </Card>
      )}

      {(program.programSyllabus?.programHours || program.programSyllabus?.feesNote) && (
        <div className="mb-6 flex flex-wrap gap-6 text-sm text-gray-700">
          {program.programSyllabus?.programHours && (
            <span>
              <strong>Hours:</strong> {program.programSyllabus.programHours}
            </span>
          )}
          {program.programSyllabus?.feesNote && (
            <span>
              <strong>Fees:</strong> {program.programSyllabus.feesNote}
            </span>
          )}
        </div>
      )}

      {program.subjects.map((sub) => (
        <Card key={sub.id} className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">
              {sub.code} — {sub.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sub.programChapters.map((ch) => (
              <div key={ch.id} className="rounded-md border border-gray-100 bg-gray-50/90 p-3">
                <p className="font-medium text-gray-900">
                  {ch.title}
                  {ch.isMandatory ? <span className="ml-2 text-xs text-amber-800">(mandatory)</span> : null}
                </p>
                <ul className="mt-2 space-y-2">
                  {ch.lessons.map((les) => (
                    <li key={les.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <span className="text-gray-500">{les.kind}</span> — {les.title}
                      </span>
                      {les.kind === "QUIZ" ? (
                        <Link href="/student/assessments">
                          <Button size="sm" variant="secondary">
                            Open Assessments
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={completing === les.id}
                          onClick={() => markComplete(les.id, les.kind)}
                        >
                          {completing === les.id ? "Saving…" : "Mark complete"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
