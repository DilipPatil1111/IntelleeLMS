"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = {
  studentUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentNo: string;
  eligible: boolean;
  certificateSent: boolean;
};

export function AwardCertificatesClient(props: {
  title: string;
  listUrl: string;
  previewUrl: string;
  sendUrl: string;
  loadPrograms: () => Promise<{ id: string; name: string }[]>;
}) {
  const { listUrl, previewUrl, sendUrl, loadPrograms } = props;
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [programId, setProgramId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadPrograms().then(setPrograms);
  }, [loadPrograms]);

  const loadRows = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const res = await fetch(`${listUrl}?programId=${encodeURIComponent(programId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.students || []);
      const sel: Record<string, boolean> = {};
      for (const r of data.students || []) {
        if (r.eligible && !r.certificateSent) sel[r.studentUserId] = true;
      }
      setSelected(sel);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl, programId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const r of rows) {
      if (r.eligible && !r.certificateSent) next[r.studentUserId] = on;
    }
    setSelected(next);
  }

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function preview(studentUserId: string) {
    const res = await fetch(previewUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId, studentUserId }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert(e.error || "Preview failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function sendSelected() {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) {
      alert("Select at least one eligible student.");
      return;
    }
    if (!confirm(`Send certificate email to ${ids.length} student(s)?`)) return;
    setSending(true);
    try {
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, studentUserIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Send failed");
        return;
      }
      const failed = data.results?.filter((x: { ok: boolean }) => !x.ok) || [];
      if (failed.length) {
        alert(`Some sends failed: ${failed.map((f: { studentUserId: string; error?: string }) => f.error).join("; ")}`);
      }
      await loadRows();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader
        title={props.title}
        description="Preview the certificate PDF, then email it to eligible students. Uses the template from Principal → Settings."
      />
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-[240px]">
          <span className="text-sm font-medium text-gray-700">Program</span>
          <select
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            <option value="">Select program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {programId && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Award-eligible students</CardTitle>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(true)}>
                Select all eligible
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(false)}>
                Deselect all
              </Button>
              <Button type="button" size="sm" onClick={sendSelected} disabled={sending}>
                {sending ? "Sending…" : "Send certificate email"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-600">
                      <th className="p-2 w-10" />
                      <th className="p-2">Student</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Enrollment</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-gray-500">
                          No students found for this program.
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.studentUserId} className="border-b border-gray-100">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            disabled={!r.eligible || r.certificateSent}
                            checked={!!selected[r.studentUserId]}
                            onChange={() => toggleOne(r.studentUserId)}
                          />
                        </td>
                        <td className="p-2">
                          {r.firstName} {r.lastName}
                        </td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2 font-mono text-xs">{r.enrollmentNo}</td>
                        <td className="p-2">
                          {!r.eligible && <span className="text-gray-500">Not complete</span>}
                          {r.eligible && !r.certificateSent && (
                            <span className="text-green-700">Eligible</span>
                          )}
                          {r.certificateSent && <span className="text-indigo-700">Emailed</span>}
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!r.eligible}
                            onClick={() => preview(r.studentUserId)}
                          >
                            Preview PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
