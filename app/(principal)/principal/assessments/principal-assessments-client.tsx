"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
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
  batch: { name: string; program: { name: string } };
  creator: { id: string; firstName: string; lastName: string; email: string };
  _count: { questions: number; attempts: number };
}

export function PrincipalAssessmentsClient() {
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string; programId: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [status, setStatus] = useState<AssessmentStatus | "">("");
  const [type, setType] = useState<AssessmentType | "">("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void (async () => {
      const [pRes, bRes, tRes] = await Promise.all([
        fetch("/api/principal/programs"),
        fetch("/api/principal/batches"),
        fetch("/api/principal/teachers"),
      ]);
      const [pData, bData, tData] = await Promise.all([pRes.json(), bRes.json(), tRes.json()]);
      setPrograms(pData.programs || []);
      setBatches(bData.batches || []);
      const tl = (tData.teachers || []) as { id: string; firstName: string; lastName: string }[];
      setTeachers(tl);
    })();
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (programId) params.set("programId", programId);
    if (batchId) params.set("batchId", batchId);
    if (teacherId) params.set("teacherId", teacherId);
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    const qs = params.toString();
    const res = await fetch(`/api/principal/assessments${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    setAssessments(data.assessments || []);
  }, [debouncedQ, programId, batchId, teacherId, status, type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const batchOptions = useMemo(() => {
    const list = programId ? batches.filter((b) => b.programId === programId) : batches;
    return list.map((b) => ({ value: b.id, label: b.name }));
  }, [batches, programId]);

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` })),
    [teachers]
  );

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
      <PageHeader title="All Assessments" description="View all assessments across the college" />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[180px] flex-1">
          <Input
            label="Search"
            placeholder="Title or subject"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-full min-w-[130px] sm:w-40">
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
        <div className="w-full min-w-[130px] sm:w-40">
          <Select
            label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            options={batchOptions}
            placeholder="All"
          />
        </div>
        <div className="w-full min-w-[140px] sm:w-44">
          <Select
            label="Teacher (creator)"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            options={teacherOptions}
            placeholder="All"
          />
        </div>
        <div className="w-full min-w-[120px] sm:w-36">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AssessmentStatus | "")}
            options={STATUS_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="All"
          />
        </div>
        <div className="w-full min-w-[120px] sm:w-36">
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as AssessmentType | "")}
            options={TYPE_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="All"
          />
        </div>
      </div>

      <div className="space-y-4">
        {assessments.length === 0 ? (
          <Card>
            <CardContent>
              <p className="py-8 text-center text-gray-500">No assessments match your filters.</p>
            </CardContent>
          </Card>
        ) : (
          assessments.map((a) => (
            <Card key={a.id}>
              <CardContent>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                      <Badge variant={a.type === "QUIZ" ? "info" : a.type === "TEST" ? "warning" : "default"}>
                        {a.type}
                      </Badge>
                      <Badge variant={a.status === "PUBLISHED" ? "success" : a.status === "GRADED" ? "info" : "default"}>
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {a.subject?.name} — {a.batch?.program?.name} — {a.batch?.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {a._count.questions} questions — {a.totalMarks} marks — {a._count.attempts} submissions — Created{" "}
                      {formatDate(a.createdAt)}
                      {a.creator && (
                        <>
                          {" "}
                          — By {a.creator.firstName} {a.creator.lastName}
                        </>
                      )}
                    </p>
                  </div>
                  <Link href={`/principal/assessments/${a.id}/results`}>
                    <Button variant="outline" size="sm">
                      <FileBarChart className="h-4 w-4 mr-1" />
                      Results & PDF
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
