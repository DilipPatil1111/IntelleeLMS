"use client";

import { ProgramContentAdminClient } from "@/components/program-content/program-content-admin-client";

export default function PrincipalProgramContentPage() {
  return (
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
  );
}
