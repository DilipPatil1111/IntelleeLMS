"use client";
import { TranscriptManagerClient } from "@/components/transcripts/transcript-manager-client";

export default function PrincipalTranscriptsPage() {
  return (
    <TranscriptManagerClient
      apiPrefix="/api/principal"
      studentsUrl="/api/principal/transcripts/students"
      programsUrl="/api/principal/programs"
    />
  );
}
