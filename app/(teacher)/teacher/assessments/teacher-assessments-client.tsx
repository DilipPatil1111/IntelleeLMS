"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileBarChart } from "lucide-react";

type AssessmentType = "QUIZ" | "TEST" | "ASSIGNMENT" | "PROJECT" | "HOMEWORK";
type AssessmentStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "GRADED";

interface AssessmentRow {
  id: string;
  title: string;
  type: AssessmentType;
  status: AssessmentStatus;
  totalMarks: number;
  createdAt: string;
  subject: { name: string };
  batch: { name: string; program: { name: string }; programId: string };
  _count: { questions: number; attempts: number };
}

const PAGE_SIZE = 5;

export function TeacherAssessmentsClient() {
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string; programId: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState<AssessmentStatus | "">("");
  const [type, setType] = useState<AssessmentType | "">("");
  const filterKey = useMemo(
    () => `${debouncedQ}|${programId}|${batchId}|${status}|${type}`,
    [debouncedQ, programId, batchId, status, type]
  );
  const prevFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void (async () => {
      const [pRes, rRes] = await Promise.all([fetch("/api/teacher/programs"), fetch("/api/teacher/roster")]);
      const pData = await pRes.json();
      const rData = await rRes.json();
      setPrograms(pData.raw || []);
      if (Array.isArray(rData.batches)) setBatches(rData.batches);
    })();
  }, []);

  useEffect(() => {
    const filtersChanged = prevFilterKeyRef.current !== filterKey;
    if (filtersChanged && page !== 1) {
      prevFilterKeyRef.current = filterKey;
      setPage(1);
      return;
    }
    if (filtersChanged) {
      prevFilterKeyRef.current = filterKey;
    }
    const pageToUse = filtersChanged ? 1 : page;

    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (programId) params.set("programId", programId);
      if (batchId) params.set("batchId", batchId);
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      params.set("page", String(pageToUse));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/teacher/assessments?${params.toString()}`);
      const data = await res.json();
      if (cancelled) return;
      setAssessments(data.assessments || []);
      setListTotal(typeof data.total === "number" ? data.total : 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [filterKey, page, debouncedQ, programId, batchId, status, type]);

  const batchOptions = useMemo(() => {
    const list = programId ? batches.filter((b) => b.programId === programId) : batches;
    return list.map((b) => ({ value: b.id, label: b.name }));
  }, [batches, programId]);

  const TYPE_OPTS: { value: AssessmentType; label: string }[] = [
    { value: "QUIZ", label: "Quiz" },
    { value: "TEST", label: "Test" },
    { value: "ASSIGNMENT", label: "Assignment" },
    { value: "PROJECT", label: "Project" },
    { value: "HOMEWORK", label: "Homework" },
  ];

  const STATUS_OPTS: { value: AssessmentStatus; label: string }[] = [
    { value: "DRAFT", label: "Draft" },
    { value: "PUBLISHED", label: "Published" },
    { value: "CLOSED", label: "Closed" },
    { value: "GRADED", label: "Graded" },
  ];

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Create and manage quizzes, tests, and assignments"
        actions={
          <Link href="/teacher/assessments/new">
            <Button>Create New</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[180px] flex-1">
          <Input
            label="Search"
            placeholder="Title or subject"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-full min-w-[120px] sm:w-40">
          <Select
            label="Program"
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setBatchId("");
            }}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="All"
          />
        </div>
        <div className="w-full min-w-[120px] sm:w-40">
          <Select
            label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            options={batchOptions}
            placeholder="All"
          />
        </div>
        <div className="w-full min-w-[110px] sm:w-36">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AssessmentStatus | "")}
            options={STATUS_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="All"
          />
        </div>
        <div className="w-full min-w-[110px] sm:w-36">
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as AssessmentType | "")}
            options={TYPE_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="All"
          />
        </div>
      </div>

      {listTotal === 0 ? (
        <Card>
          <CardContent>
            <div className="py-12 text-center">
              <p className="mb-4 text-gray-500">No assessments match your filters.</p>
              <Link href="/teacher/assessments/new">
                <Button>Create Your First Assessment</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {listTotal} assessment{listTotal === 1 ? "" : "s"} total · {PAGE_SIZE} per page
          </p>
          {assessments.map((a) => (
            <Card key={a.id}>
              <CardContent>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                      <Badge variant={a.type === "QUIZ" ? "info" : a.type === "TEST" ? "warning" : "default"}>
                        {a.type}
                      </Badge>
                      <Badge
                        variant={
                          a.status === "PUBLISHED"
                            ? "success"
                            : a.status === "DRAFT"
                              ? "default"
                              : a.status === "GRADED"
                                ? "info"
                                : "warning"
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {a.subject?.name} — {a.batch?.program?.name} — {a.batch?.name} — {a._count.questions} questions —{" "}
                      {a.totalMarks} marks
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Created {formatDate(a.createdAt)} — {a._count.attempts} submissions
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/teacher/assessments/new?copyFrom=${a.id}`}>
                      <Button variant="ghost" size="sm" title="Start a new assessment prefilled from this one">
                        New from this
                      </Button>
                    </Link>
                    <Link href={`/teacher/assessments/${a.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    <Link href={`/teacher/assessments/${a.id}/results`}>
                      <Button variant="outline" size="sm" title="Student-wise results (view only)">
                        <FileBarChart className="h-4 w-4 mr-1" />
                        Results
                      </Button>
                    </Link>
                    {a.status === "DRAFT" && (
                      <Link href={`/teacher/assessments/${a.id}/edit`}>
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      </Link>
                    )}
                    <Link href={`/teacher/grading?assessmentId=${a.id}`}>
                      <Button variant="ghost" size="sm">
                        Grade
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              Page {page} of {Math.max(1, Math.ceil(listTotal / PAGE_SIZE))}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= Math.max(1, Math.ceil(listTotal / PAGE_SIZE))}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
