"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Eye, Pencil } from "lucide-react";

interface TrailVersion {
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
}

interface Receipt {
  id: string;
  fileName: string;
  fileUrl: string;
  amountPaid: number;
  paymentDate: string;
  confirmed: boolean;
  trail?: TrailVersion[];
}

export function FeeReceiptsClient() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const replaceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/student/pending-actions");
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.fees?.receipts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function replaceReceipt(id: string, file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/student/pending-actions/receipt/${id}`, {
        method: "PUT",
        body: fd,
      });
      if (res.ok) await load();
    } finally {
      setUploading(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading || receipts.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Receipt documents</h3>
      <p className="text-sm text-gray-500 mb-4">
        View, download, or upload a new version of your payment receipts. Newest versions appear first in the history.
      </p>
      <div className="space-y-3">
        {receipts.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">{r.fileName}</p>
                <p className="text-xs text-gray-500">
                  {fmt(r.amountPaid)} · {new Date(r.paymentDate).toLocaleDateString()}
                  {r.confirmed && <span className="ml-1 text-green-600">· Confirmed</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="file"
                  className="hidden"
                  ref={(el) => {
                    replaceRefs.current[r.id] = el;
                  }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void replaceReceipt(r.id, f);
                  }}
                />
                <a href={r.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost">
                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                  </Button>
                </a>
                <a
                  href={r.fileUrl}
                  download={r.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 px-2 py-1.5 hover:bg-indigo-50 rounded"
                >
                  Download
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => replaceRefs.current[r.id]?.click()}
                  disabled={uploading}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Update
                </Button>
              </div>
            </div>
            {r.trail && r.trail.length > 1 && (
              <div className="px-4 py-2 text-xs border-t border-gray-100 bg-white">
                <p className="font-medium text-gray-500 mb-1">Version history (newest first)</p>
                <ul className="space-y-1">
                  {r.trail.map((t, i) => (
                    <li key={i} className="flex justify-between gap-2 text-gray-600">
                      <span className="truncate">{t.fileName}</span>
                      <a
                        href={t.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 shrink-0"
                      >
                        View
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
