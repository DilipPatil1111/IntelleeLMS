"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApplicationActions } from "./application-actions";

type ApplicationStatus = "PENDING" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "ENROLLED";

interface ApplicationRow {
  id: string;
  createdAt: string;
  status: ApplicationStatus;
  personalStatement: string | null;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    profilePicture: string | null;
    studentProfile: {
      enrollmentNo: string;
      programId: string | null;
      batchId: string | null;
      status: string;
    } | null;
  };
  program: {
    id: string;
    name: string;
    code: string;
    batches: { id: string; name: string }[];
  };
  batch: { id: string; name: string } | null;
}

function isPlacementPreRecorded(app: ApplicationRow): boolean {
  const sp = app.applicant.studentProfile;
  if (!sp?.enrollmentNo || !sp.batchId) return false;
  if (app.status !== "ACCEPTED") return false;
  if (sp.status !== "ACCEPTED") return false;
  if (app.batch && app.batch.id !== sp.batchId) return false;
  return true;
}

const STATUS_OPTS: { value: ApplicationStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ENROLLED", label: "Enrolled" },
];

export function ApplicationsClient() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [programId, setProgramId] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (programId) params.set("programId", programId);
    if (status) params.set("status", status);
    const qs = params.toString();
    const res = await fetch(`/api/principal/applications${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    setApplications(data.applications || []);
  }, [debouncedQ, programId, status]);

  useEffect(() => {
    void (async () => {
      const pRes = await fetch("/api/principal/programs");
      const pData = await pRes.json();
      setPrograms(pData.programs || []);
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Student Applications" description="Review and manage program applications" />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <Input
            label="Search applicant"
            placeholder="Name or email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-full min-w-[160px] sm:w-52">
          <Select
            label="Program"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="All programs"
          />
        </div>
        <div className="w-full min-w-[140px] sm:w-44">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ApplicationStatus | "")}
            options={STATUS_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="All statuses"
          />
        </div>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-gray-500">No applications match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    {app.applicant.profilePicture ? (
                      <img
                        src={app.applicant.profilePicture}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-600">
                        {app.applicant.firstName[0]}
                        {app.applicant.lastName[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {app.applicant.firstName} {app.applicant.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{app.applicant.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">{app.program.name}</p>
                      {app.batch && <p className="text-xs text-gray-500">Batch: {app.batch.name}</p>}
                      <p className="text-xs text-gray-400">{new Date(app.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge
                      variant={
                        app.status === "ENROLLED" || app.status === "ACCEPTED"
                          ? "success"
                          : app.status === "REJECTED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {app.status}
                    </Badge>
                  </div>
                </div>
                {app.personalStatement && (
                  <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{app.personalStatement}</p>
                )}
                {app.status === "PENDING" && (
                  <div className="mt-3">
                    <ApplicationActions applicationId={app.id} batches={app.program.batches} onDone={load} />
                  </div>
                )}
                {app.status === "ACCEPTED" && (
                  <div className="mt-3">
                    <ApplicationActions
                      applicationId={app.id}
                      batches={app.program.batches}
                      showEnroll
                      placementPreRecorded={isPlacementPreRecorded(app)}
                      defaultBatchId={app.applicant.studentProfile?.batchId ?? undefined}
                      onDone={load}
                    />
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
