"use client";

import { useState } from "react";
import { ProgramContentAdminClient } from "@/components/program-content/program-content-admin-client";
import { SessionRecordingsManager } from "@/components/session-recordings/session-recordings-manager";
import { Layers, Video } from "lucide-react";

type Tab = "content" | "recordings";

export default function PrincipalProgramContentPage() {
  const [tab, setTab] = useState<Tab>("content");

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
      <div className="flex flex-wrap gap-2 mb-6">
        {tabBtn("content", "Curriculum", <Layers className="h-4 w-4" />)}
        {tabBtn("recordings", "Session Recordings", <Video className="h-4 w-4" />)}
      </div>

      {tab === "content" && (
        <ProgramContentAdminClient
          title="Program Content"
          role="principal"
          canManagePrograms
          programsApiUrl="/api/principal/programs"
          programTaxonomyUrls={{
            domains: "/api/principal/program-domains",
            categories: "/api/principal/program-categories",
            types: "/api/principal/program-types",
          }}
          apiPrefix="/api/principal/program-content"
          canCreateSubjects
          subjectCreateUrl="/api/principal/program-content/subjects"
          loadPrograms={async () => {
            const res = await fetch("/api/principal/programs");
            const data = await res.json();
            return (data.programs || []).map(
              (p: {
                id: string;
                name: string;
                code?: string;
                description?: string | null;
                durationText?: string | null;
                programDomain?: { id: string; name: string } | null;
                programCategory?: { id: string; name: string } | null;
                programType?: { id: string; name: string } | null;
                _count?: { subjects: number; batches: number; students: number };
              }) => p
            );
          }}
          loadAllSubjects={async (programId: string) => {
            const res = await fetch(`/api/principal/program-content/${encodeURIComponent(programId)}`);
            const data = await res.json();
            return (data.program?.subjects || []).map(
              (s: { id: string; name: string; code: string }) => ({ id: s.id, name: s.name, code: s.code })
            );
          }}
        />
      )}

      {tab === "recordings" && (
        <SessionRecordingsManager
          apiPrefix="/api/principal/session-recordings"
          loadPrograms={async () => {
            const res = await fetch("/api/principal/programs");
            const data = await res.json();
            return (data.programs || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
          }}
        />
      )}
    </>
  );
}
