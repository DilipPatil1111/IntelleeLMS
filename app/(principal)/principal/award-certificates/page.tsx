"use client";

import { AwardCertificatesClient } from "@/components/program-content/award-certificates-client";

export default function PrincipalAwardCertificatesPage() {
  return (
    <AwardCertificatesClient
      title="Award Certificates"
      listUrl="/api/principal/award-certificates"
      previewUrl="/api/principal/award-certificates/preview"
      sendUrl="/api/principal/award-certificates/send"
      loadPrograms={async () => {
        const res = await fetch("/api/principal/programs");
        const data = await res.json();
        return (data.programs || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
      }}
    />
  );
}
