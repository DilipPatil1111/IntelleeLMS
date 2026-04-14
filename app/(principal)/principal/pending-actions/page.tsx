"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RetakeRequestsClient } from "@/components/retake-requests/retake-requests-client";
import { AttendanceExcusesClient } from "@/components/attendance-excuses/attendance-excuses-client";
import { RotateCcw, ClipboardMinus } from "lucide-react";

type Tab = "retake" | "excuse";

export default function PrincipalPendingActionsPage() {
  const [tab, setTab] = useState<Tab>("retake");

  const tabBtn = (id: Tab, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
        tab === id
          ? "bg-indigo-600 text-white shadow"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Pending Actions"
        description="Review and resolve student retake requests and attendance excuse requests"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {tabBtn("retake", "Retake Requests", <RotateCcw className="h-4 w-4" />)}
        {tabBtn("excuse", "Attendance Excuses", <ClipboardMinus className="h-4 w-4" />)}
      </div>

      {tab === "retake" && (
        <RetakeRequestsClient apiBasePath="/api/principal/retake-requests" role="principal" embedded />
      )}
      {tab === "excuse" && (
        <AttendanceExcusesClient apiBasePath="/api/principal/attendance-excuse-requests" role="principal" embedded />
      )}
    </>
  );
}
