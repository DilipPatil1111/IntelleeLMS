"use client";

import { RetakeRequestsClient } from "@/components/retake-requests/retake-requests-client";

export default function PrincipalRetakeRequestsPage() {
  return <RetakeRequestsClient apiBasePath="/api/principal/retake-requests" role="principal" />;
}
