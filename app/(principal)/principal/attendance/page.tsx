"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

interface SessionRecord {
  id: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  overrideHoliday: boolean;
  subject: { name: string };
  batch: { name: string };
  records: { student: { firstName: string; lastName: string }; status: string }[];
}

export default function PrincipalAttendancePage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [batches, setBatches] = useState<{ value: string; label: string }[]>([]);
  const [batchId, setBatchId] = useState("");

  useEffect(() => {
    fetch("/api/teacher/options").then((r) => r.json()).then((data) => {
      const allBatches = data.batches || [];
      setBatches(allBatches);
    });
    fetch("/api/principal/attendance").then((r) => r.json()).then((data) => {
      setSessions(data.sessions || []);
    });
  }, []);

  useEffect(() => {
    const url = batchId ? `/api/principal/attendance?batchId=${batchId}` : "/api/principal/attendance";
    fetch(url).then((r) => r.json()).then((data) => {
      setSessions(data.sessions || []);
    });
  }, [batchId]);

  return (
    <>
      <PageHeader title="Attendance Overview" description="View attendance records across all batches and subjects" />

      <div className="mb-6 max-w-xs">
        <Select label="Filter by Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} options={batches} placeholder="All batches" />
      </div>

      {sessions.length === 0 ? (
        <Card><CardContent><p className="text-center text-gray-500 py-8">No attendance records found.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => {
            const present = s.records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
            return (
              <Card key={s.id}>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{s.subject?.name} — {s.batch?.name}</h3>
                      <p className="text-xs text-gray-500">
                        {new Date(s.sessionDate).toLocaleDateString()} {s.startTime && `| ${s.startTime} - ${s.endTime}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="success">{present}/{s.records.length} Present</Badge>
                      {s.overrideHoliday && <Badge variant="warning">Holiday Override</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
