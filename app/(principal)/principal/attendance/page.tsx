"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { LayoutGrid, BarChart3 } from "lucide-react";
import { AttendanceProgramGridClient } from "@/components/attendance/attendance-program-grid-client";
import { PrincipalAttendanceDashboard } from "@/components/attendance/principal-attendance-dashboard";

function PrincipalAttendanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "sheet" ? "sheet" : "overview";
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [batches, setBatches] = useState<{ value: string; label: string; programId: string }[]>([]);

  useEffect(() => {
    fetch("/api/principal/programs")
      .then((r) => r.json())
      .then((d) =>
        setPrograms((d.programs || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }))),
      );
    fetch("/api/principal/batches")
      .then((r) => r.json())
      .then(
        (d) =>
          setBatches(
            (d.batches || []).map(
              (b: { id: string; name: string; program: { name: string; id: string } }) => ({
                value: b.id,
                label: `${b.name} — ${b.program?.name || ""}`,
                programId: b.program.id,
              }),
            ),
          ),
      );
  }, []);

  function goTab(id: "overview" | "sheet") {
    router.replace(`/principal/attendance?tab=${id}`);
  }

  const tabBtn = (id: "overview" | "sheet", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => goTab(id)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
        tab === id ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Consolidated student and teacher attendance by program, batch, and session. Use the program sheet to edit student attendance in bulk; add or adjust sessions and teacher self-attendance below."
      />

      <div className="flex flex-wrap gap-3 mb-6">
        {tabBtn("overview", "Overview & sessions", <BarChart3 className="h-4 w-4" />)}
        {tabBtn("sheet", "Program sheet (grid)", <LayoutGrid className="h-4 w-4" />)}
      </div>

      {tab === "overview" && <PrincipalAttendanceDashboard programs={programs} batches={batches} />}

      {tab === "sheet" && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-4">
              Select program, subject, and batch. Click cells to set P/A/L/E (Present / Absent / Late / Excused); changes save
              for all students in that batch for the chosen subject. Use <strong>E</strong> when the absence is approved (e.g.
              sick leave, official event).
            </p>
            <AttendanceProgramGridClient apiRole="principal" embedded />
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function PrincipalAttendancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <PrincipalAttendanceInner />
    </Suspense>
  );
}
