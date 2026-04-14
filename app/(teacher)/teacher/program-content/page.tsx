"use client";

import { useState } from "react";
import { ProgramContentAdminClient } from "@/components/program-content/program-content-admin-client";
import { SubjectsManager } from "@/app/(teacher)/teacher/subjects/page";
import { SessionRecordingsManager } from "@/components/session-recordings/session-recordings-manager";
import { Layers, BookOpen, Video } from "lucide-react";

type Tab = "content" | "subjects" | "recordings";

export default function TeacherProgramContentPage() {
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
        {tabBtn("subjects", "Subjects", <BookOpen className="h-4 w-4" />)}
        {tabBtn("recordings", "Session Recordings", <Video className="h-4 w-4" />)}
      </div>

      {tab === "content" && (
        <ProgramContentAdminClient
          title="Program Content"
          role="teacher"
          canManagePrograms={false}
          apiPrefix="/api/teacher/program-content"
          canCreateSubjects
          subjectCreateUrl="/api/teacher/program-content/subjects"
          programTaxonomyUrls={{
            domains: "/api/teacher/program-domains",
            categories: "/api/teacher/program-categories",
            types: "/api/teacher/program-types",
          }}
          loadPrograms={async () => {
            const res = await fetch("/api/teacher/programs");
            const data = await res.json();
            return data.raw || [];
          }}
          loadAllSubjects={async (programId: string) => {
            const res = await fetch(`/api/teacher/program-content/${encodeURIComponent(programId)}`);
            const data = await res.json();
            return (data.program?.subjects || []).map(
              (s: { id: string; name: string; code: string }) => ({ id: s.id, name: s.name, code: s.code })
            );
          }}
        />
      )}

      {tab === "subjects" && <SubjectsManager embedded />}

      {tab === "recordings" && (
        <SessionRecordingsManager
          apiPrefix="/api/teacher/session-recordings"
          loadPrograms={async () => {
            const res = await fetch("/api/teacher/programs");
            const data = await res.json();
            const raw: Array<{ id: string; name: string }> = data.raw || [];
            return raw.map((p) => ({ id: p.id, name: p.name }));
          }}
        />
      )}
    </>
  );
}
