"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CertificateTemplatesClient } from "@/components/certificates/certificate-templates-client";
import { CanvaDesignStudio } from "@/components/canva/canva-design-studio";
import { cn } from "@/lib/utils";
import { FileText, Palette } from "lucide-react";

type Tab = "certificates" | "canva";

export default function TeacherCertificateTemplatesPage() {
  const searchParams = useSearchParams();
  const canvaParam = searchParams.get("canva");
  const [tab, setTab] = useState<Tab>(canvaParam ? "canva" : "certificates");
  const [canvaToast, setCanvaToast] = useState<string | null>(null);

  useEffect(() => {
    if (canvaParam === "connected") {
      setCanvaToast("Canva account connected successfully!");
      setTab("canva");
    } else if (canvaParam === "error") {
      const reason = searchParams.get("reason") || "unknown";
      setCanvaToast(`Canva connection failed: ${reason}`);
      setTab("canva");
    }
  }, [canvaParam, searchParams]);

  useEffect(() => {
    if (!canvaToast) return;
    const t = setTimeout(() => setCanvaToast(null), 5000);
    return () => clearTimeout(t);
  }, [canvaToast]);

  return (
    <>
      <PageHeader
        title="Templates"
        description="Manage certificate templates, generate and send personalized certificates"
      />

      {canvaToast && (
        <div className={cn(
          "fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg",
          canvaParam === "connected" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800",
        )}>
          {canvaToast}
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("certificates")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "certificates"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
        >
          <FileText className="h-4 w-4" /> Certificate Templates
        </button>
        <button
          type="button"
          onClick={() => setTab("canva")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "canva"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
        >
          <Palette className="h-4 w-4" /> Canva Studio
        </button>
      </div>

      {tab === "certificates" && (
        <CertificateTemplatesClient
          apiPrefix="/api/teacher/certificate-templates"
          programsApiUrl="/api/teacher/programs"
        />
      )}

      {tab === "canva" && (
        <CanvaDesignStudio
          onDesignExported={(url, fileName) => {
            console.log("Canva design exported:", url, fileName);
          }}
        />
      )}
    </>
  );
}
