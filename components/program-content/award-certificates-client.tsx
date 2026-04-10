"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = {
  studentUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentNo: string;
  batchName: string;
  eligible: boolean;
  certificateSent: boolean;
  reason?: string;
};

type BatchOption = { id: string; name: string };

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
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchId, setBatchId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [markSelected, setMarkSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadPrograms().then(setPrograms);
  }, [loadPrograms]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadRows = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      let url = `${listUrl}?programId=${encodeURIComponent(programId)}`;
      if (batchId) url += `&batchId=${encodeURIComponent(batchId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.students || []);
      setBatches(data.batches || []);
      const sel: Record<string, boolean> = {};
      for (const r of data.students || []) {
        if (r.eligible && !r.certificateSent) sel[r.studentUserId] = true;
      }
      setSelected(sel);
      setMarkSelected({});
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl, programId, batchId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadRows();
  }, [loadRows]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const eligibleNotSent = useMemo(
    () => rows.filter((r) => r.eligible && !r.certificateSent),
    [rows],
  );

  const notComplete = useMemo(
    () => rows.filter((r) => !r.eligible && !r.certificateSent),
    [rows],
  );

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const r of eligibleNotSent) {
      next[r.studentUserId] = on;
    }
    setSelected(next);
  }

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleMarkAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const r of notComplete) {
      next[r.studentUserId] = on;
    }
    setMarkSelected(next);
  }

  function toggleMarkOne(id: string) {
    setMarkSelected((prev) => ({ ...prev, [id]: !prev[id] }));
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

  async function sendSelectedCerts() {
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

  async function markCompleteSelected() {
    const ids = Object.entries(markSelected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) {
      alert("Select at least one student to mark complete.");
      return;
    }
    if (!confirm(`Mark all chapters/lessons complete for ${ids.length} student(s)?`)) return;
    setMarking(true);
    try {
      const res = await fetch(listUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, studentUserIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Mark complete failed");
        return;
      }
      alert(`Marked ${data.lessonsMarked ?? 0} lesson(s) complete for ${data.studentsMarked ?? 0} student(s).`);
      await loadRows();
    } finally {
      setMarking(false);
    }
  }

  return (
    <>
      <PageHeader
        title={props.title}
        description="Select Program → Batch → manage completion and certificates for students."
      />

      {/* ── Filters: Program + Batch ── */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-[240px]">
          <span className="text-sm font-medium text-gray-700">Program</span>
          <select
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={programId}
            onChange={(e) => { setProgramId(e.target.value); setBatchId(""); }}
          >
            <option value="">Select program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {programId && batches.length > 0 && (
          <div className="min-w-[200px]">
            <span className="text-sm font-medium text-gray-700">Batch</span>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Mark Complete Section (not-complete students) ── */}
      {programId && notComplete.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Mark Complete — Students with pending chapters/lessons
              <span className="ml-2 text-sm font-normal text-gray-500">({notComplete.length})</span>
            </CardTitle>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => toggleMarkAll(true)}>Select all</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => toggleMarkAll(false)}>Deselect all</Button>
              <Button type="button" size="sm" onClick={markCompleteSelected} disabled={marking}
                className="bg-green-600 hover:bg-green-700 text-white font-bold">
                {marking ? "Marking…" : "Mark Complete"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="p-2 w-10" />
                    <th className="p-2">Student</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Batch</th>
                    <th className="p-2">Enrollment</th>
                    <th className="p-2">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {notComplete.map((r) => (
                    <tr key={r.studentUserId} className="border-b border-gray-100">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!!markSelected[r.studentUserId]}
                          onChange={() => toggleMarkOne(r.studentUserId)}
                        />
                      </td>
                      <td className="p-2">{r.firstName} {r.lastName}</td>
                      <td className="p-2">{r.email}</td>
                      <td className="p-2 text-xs">{r.batchName || "—"}</td>
                      <td className="p-2 font-mono text-xs">{r.enrollmentNo}</td>
                      <td className="p-2 text-orange-600 text-xs">{r.reason || "Incomplete"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Award Certificate Section (eligible students) ── */}
      {programId && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Eligible Students for Award Certificate
              {batchId && batches.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  — {batches.find((b) => b.id === batchId)?.name ?? "All batches"}
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(true)}>
                Select all eligible
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(false)}>
                Deselect all
              </Button>
              <Button type="button" size="sm" onClick={sendSelectedCerts} disabled={sending}>
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
                      <th className="p-2">Batch</th>
                      <th className="p-2">Enrollment</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-sm text-gray-500">
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
                        <td className="p-2">{r.firstName} {r.lastName}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2 text-xs">{r.batchName || "—"}</td>
                        <td className="p-2 font-mono text-xs">{r.enrollmentNo}</td>
                        <td className="p-2">
                          {!r.eligible && !r.certificateSent && (
                            <span className="text-gray-500">
                              Not complete
                              {r.reason && (
                                <span className="block text-xs text-gray-400">{r.reason}</span>
                              )}
                            </span>
                          )}
                          {r.eligible && !r.certificateSent && (
                            <span className="text-green-700 font-medium">Eligible</span>
                          )}
                          {r.certificateSent && <span className="text-indigo-700 font-medium">Emailed</span>}
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
