"use client";

import { ProgramContentAdminClient } from "@/components/program-content/program-content-admin-client";

export default function TeacherProgramContentPage() {
  return (
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
        const raw: Array<{ id: string; name: string }> = data.raw || [];
        return raw.map((p) => ({ id: p.id, name: p.name }));
      }}
      loadAllSubjects={async (programId: string) => {
        const res = await fetch(`/api/teacher/program-content/${encodeURIComponent(programId)}`);
        const data = await res.json();
        return (data.program?.subjects || []).map(
          (s: { id: string; name: string; code: string }) => ({ id: s.id, name: s.name, code: s.code })
        );
      }}
    />
  );
}
