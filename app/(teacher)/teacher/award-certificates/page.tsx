"use client";

import { AwardCertificatesClient } from "@/components/program-content/award-certificates-client";

export default function TeacherAwardCertificatesPage() {
  return (
    <AwardCertificatesClient
      title="Award Certificates"
      listUrl="/api/teacher/award-certificates"
      previewUrl="/api/teacher/award-certificates/preview"
      sendUrl="/api/teacher/award-certificates/send"
      loadPrograms={async () => {
        const res = await fetch("/api/teacher/programs");
        const data = await res.json();
        const raw = data.raw || [];
        return raw.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
      }}
    />
  );
}
