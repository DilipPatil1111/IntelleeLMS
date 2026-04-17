"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";
import { X, Plus, Trash2, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";

type GradeBand = { id: string; label: string; minPercent: number; maxPercent: number; gradePoint: number | null };
type SubjectRow = {
  _key: string;
  subjectCode: string;
  subjectName: string;
  description: string;
  autoMarksPct: string;
  manualMarksPct: string;
  grade: string;
};
type Opt = { value: string; label: string };

const STANDING_OPTS = [
  { value: "Enrolled", label: "Enrolled" },
  { value: "Graduated", label: "Graduated" },
  { value: "Withdrawn", label: "Withdrawn" },
  { value: "Suspended", label: "Suspended" },
  { value: "Completed", label: "Completed" },
  { value: "Transferred", label: "Transferred" },
];

function resolveGrade(pct: string, bands: GradeBand[]): string {
  const n = parseFloat(pct);
  if (isNaN(n)) return "—";
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find((b) => n >= b.minPercent && n <= b.maxPercent)?.label ?? "—";
}

function newRow(): SubjectRow {
  return { _key: Math.random().toString(36).slice(2), subjectCode: "", subjectName: "", description: "", autoMarksPct: "", manualMarksPct: "", grade: "—" };
}

interface Props {
  apiPrefix: string;
  studentsUrl: string;
  programsUrl: string;
  editId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TranscriptFormModal({ apiPrefix, studentsUrl, programsUrl, editId, onClose, onSaved }: Props) {
  const { toasts, toast, dismiss } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingAuto, setLoadingAuto] = useState(false);

  // Options
  const [students, setStudents] = useState<Opt[]>([]);
  const [programs, setPrograms] = useState<Opt[]>([]);
  const [batches, setBatches] = useState<Opt[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [bands, setBands] = useState<GradeBand[]>([]);

  // Form state
  const [studentId, setStudentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [totalHours, setTotalHours] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [standing, setStanding] = useState("");
  const [credential, setCredential] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rows, setRows] = useState<SubjectRow[]>([newRow()]);

  // Load options — each fetch is isolated so one failure doesn't crash the others
  useEffect(() => {
    const safeJson = (r: Response) => r.ok ? r.json().catch(() => ({})) : Promise.resolve({});

    fetch(studentsUrl).then(safeJson).then((sd) => {
      setStudents(
        (sd.students || sd.users || []).map(
          (s: { id?: string; userId?: string; firstName?: string; lastName?: string; name?: string; enrollmentNo?: string | null }) => {
            const name = s.name || `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
            const label = s.enrollmentNo ? `${name} (${s.enrollmentNo})` : name;
            return { value: s.id || s.userId || "", label };
          }
        )
      );
    }).catch(() => {});

    fetch(programsUrl).then(safeJson).then((pd) => {
      setPrograms(
        (pd.programs || pd.raw || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }))
      );
    }).catch(() => {});

    fetch(`${apiPrefix}/grade-bands`).then(safeJson).then((bd) => {
      setBands(bd.bands || []);
    }).catch(() => {});
  }, [apiPrefix, studentsUrl, programsUrl]);

  // Load batches when program changes
  useEffect(() => {
    if (!programId) { setBatches([]); setBatchId(""); setSubjects([]); return; }
    fetch(`${apiPrefix}/attendance-report/batches?programId=${programId}`)
      .then((r) => r.json())
      .then((d) => {
        const b: Opt[] = (d.batches || []).map((x: { id: string; name: string }) => ({ value: x.id, label: x.name }));
        setBatches(b);
        if (b.length === 1) setBatchId(b[0].value);
      });
    // Also load subjects for this program
    fetch(`${apiPrefix.replace("/api/principal", "/api/principal").replace("/api/teacher", "/api/teacher")}/subjects?programId=${programId}`)
      .then((r) => r.json())
      .then((d) => {
        const s: Opt[] = (d.subjects || []).map((x: { id: string; name: string; code?: string }) => ({ value: x.id, label: `${x.code ? x.code + " — " : ""}${x.name}`, extra: x }));
        setSubjects(s);
      })
      .catch(() => setSubjects([]));
  }, [programId, apiPrefix]);

  // Pre-fill dates from batch
  const batchOpt = batches.find((b) => b.value === batchId) as (Opt & { startDate?: string; endDate?: string }) | undefined;
  useEffect(() => {
    if (batchOpt) {
      if (!startDate && (batchOpt as unknown as Record<string, string>).startDate) setStartDate(((batchOpt as unknown as Record<string, string>).startDate).slice(0, 10));
      if (!endDate && (batchOpt as unknown as Record<string, string>).endDate) setEndDate(((batchOpt as unknown as Record<string, string>).endDate).slice(0, 10));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Load existing transcript if editing
  useEffect(() => {
    if (!editId) return;
    fetch(`${apiPrefix}/transcripts/${editId}`)
      .then((r) => r.json())
      .then(({ transcript: t }) => {
        if (!t) return;
        setStudentId(t.studentId);
        setProgramId(t.programId);
        setBatchId(t.batchId || "");
        setTotalHours(t.totalHours?.toString() || "");
        setStartDate(t.startDate ? t.startDate.slice(0, 10) : "");
        setEndDate(t.endDate ? t.endDate.slice(0, 10) : "");
        setStanding(t.standing || "");
        setCredential(t.credential || "");
        setRemarks(t.remarks || "");
        setRows(
          (t.subjects || []).map((s: { id: string; subjectCode: string | null; subjectName: string; description: string | null; autoMarksPct: number | null; manualMarksPct: number | null; grade: string | null }) => ({
            _key: s.id,
            subjectCode: s.subjectCode || "",
            subjectName: s.subjectName,
            description: s.description || "",
            autoMarksPct: s.autoMarksPct?.toString() || "",
            manualMarksPct: s.manualMarksPct?.toString() || "",
            grade: s.grade || "—",
          }))
        );
      });
  }, [editId, apiPrefix]);

  const loadAutoMarks = useCallback(async () => {
    if (!studentId || !programId) { toast("Select a student and program first", "error"); return; }
    setLoadingAuto(true);
    try {
      const res = await fetch(`${apiPrefix}/transcripts/auto-marks?studentId=${studentId}&programId=${programId}`);
      const d = await res.json();
      const marks: Record<string, number> = d.marks || {};
      // Try to match subjects list
      const subjectList = subjects.length > 0 ? subjects : [];
      if (subjectList.length > 0 && Object.keys(marks).length > 0) {
        const newRows: SubjectRow[] = subjectList.map((s, i) => ({
          _key: Math.random().toString(36).slice(2),
          subjectCode: (s as unknown as Record<string, string>).code || s.label.split(" — ")[0] || "",
          subjectName: s.label.includes(" — ") ? s.label.split(" — ").slice(1).join(" — ") : s.label,
          description: "",
          autoMarksPct: marks[s.value]?.toString() || "",
          manualMarksPct: rows[i]?.manualMarksPct || "",
          grade: resolveGrade(marks[s.value]?.toString() || "", bands),
        }));
        setRows(newRows);
      } else if (Object.keys(marks).length === 0) {
        toast("No graded assessments found for this student/program", "error");
      }
    } catch { toast("Failed to load auto marks", "error"); }
    finally { setLoadingAuto(false); }
  }, [studentId, programId, apiPrefix, subjects, rows, bands, toast]);

  function updateRow(key: string, field: keyof SubjectRow, value: string) {
    setRows((prev) => prev.map((r) => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: value };
      // Recalculate grade whenever marks change
      if (field === "manualMarksPct" || field === "autoMarksPct") {
        const pct = updated.manualMarksPct || updated.autoMarksPct;
        updated.grade = resolveGrade(pct, bands);
      }
      return updated;
    }));
  }

  function addRow() { setRows((p) => [...p, newRow()]); }
  function removeRow(key: string) { setRows((p) => p.filter((r) => r._key !== key)); }
  function moveRow(key: string, dir: -1 | 1) {
    setRows((p) => {
      const idx = p.findIndex((r) => r._key === key);
      if (idx < 0 || (dir === -1 && idx === 0) || (dir === 1 && idx === p.length - 1)) return p;
      const arr = [...p];
      [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
      return arr;
    });
  }

  const overallAvg = () => {
    const vals = rows.map((r) => parseFloat(r.manualMarksPct || r.autoMarksPct)).filter((v) => !isNaN(v));
    if (!vals.length) return null;
    return (Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10).toFixed(1);
  };

  async function handleSave() {
    if (!studentId || !programId) { toast("Student and Program are required", "error"); return; }
    setSaving(true);
    const payload = {
      studentId, programId, batchId: batchId || null,
      totalHours: totalHours ? parseFloat(totalHours) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      standing: standing || null,
      credential: credential || null,
      remarks: remarks || null,
      subjects: rows.map((r, i) => ({
        subjectCode: r.subjectCode || null,
        subjectName: r.subjectName || "(Unnamed)",
        description: r.description || null,
        autoMarksPct: r.autoMarksPct ? parseFloat(r.autoMarksPct) : null,
        manualMarksPct: r.manualMarksPct ? parseFloat(r.manualMarksPct) : null,
        sortOrder: i,
      })),
    };
    try {
      const url = editId ? `${apiPrefix}/transcripts/${editId}` : `${apiPrefix}/transcripts`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); toast(d.error || "Save failed", "error"); return; }
      onSaved();
    } catch { toast("Network error", "error"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4">
        <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl my-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white rounded-t-2xl">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit" : "New"} Transcript</h2>
              <p className="text-sm text-gray-500 mt-0.5">Academic record for a student</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Student & Program row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Student *" value={studentId} onChange={(e) => setStudentId(e.target.value)} options={students} placeholder="Select student" />
              <Select label="Program *" value={programId} onChange={(e) => { setProgramId(e.target.value); setBatchId(""); }} options={programs} placeholder="Select program" />
              <Select label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} options={batches} placeholder={batches.length === 0 ? "Select program first" : "Select batch"} disabled={batches.length === 0} />
            </div>

            {/* Dates & Hours */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <Input label="Total Hours" type="number" value={totalHours} onChange={(e) => setTotalHours(e.target.value)} placeholder="e.g. 480" />
              <div className="flex flex-col">
                <span className="block text-sm font-medium text-gray-700 mb-1">Overall Average</span>
                <div className="flex items-center h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm font-bold text-indigo-700">
                  {overallAvg() != null ? `${overallAvg()}%` : "—"}
                </div>
              </div>
            </div>

            {/* Standing & Credential */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Standing" value={standing} onChange={(e) => setStanding(e.target.value)} options={STANDING_OPTS} placeholder="Select standing" />
              <Input label="Credential Awarded" value={credential} onChange={(e) => setCredential(e.target.value)} placeholder="e.g. Diploma in Software Engineering" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks / Notes</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional remarks visible on the transcript" />
            </div>

            {/* Subjects section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Courses / Subjects</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void loadAutoMarks()} disabled={loadingAuto || !studentId || !programId} isLoading={loadingAuto}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Auto-fill from Assessments
                  </Button>
                  <Button variant="outline" size="sm" onClick={addRow}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-[28px_100px_1fr_130px_90px_90px_70px_60px] bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase gap-2">
                  <span></span>
                  <span>Code</span>
                  <span>Subject Name</span>
                  <span>Description</span>
                  <span>Auto Avg %</span>
                  <span>Manual %</span>
                  <span>Grade</span>
                  <span></span>
                </div>

                {rows.map((r, idx) => (
                  <div key={r._key} className="grid grid-cols-[28px_100px_1fr_130px_90px_90px_70px_60px] px-3 py-1.5 gap-2 border-t border-gray-100 items-center hover:bg-gray-50">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveRow(r._key, -1)} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
                      <button onClick={() => moveRow(r._key, 1)} disabled={idx === rows.length - 1} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
                    </div>
                    <input value={r.subjectCode} onChange={(e) => updateRow(r._key, "subjectCode", e.target.value)} placeholder="SE-101" className="h-8 rounded border border-gray-200 px-2 text-xs focus:border-indigo-400 focus:ring-0 w-full" />
                    <input value={r.subjectName} onChange={(e) => updateRow(r._key, "subjectName", e.target.value)} placeholder="Subject name" className="h-8 rounded border border-gray-200 px-2 text-xs focus:border-indigo-400 focus:ring-0 w-full" />
                    <input value={r.description} onChange={(e) => updateRow(r._key, "description", e.target.value)} placeholder="Optional description" className="h-8 rounded border border-gray-200 px-2 text-xs focus:border-indigo-400 focus:ring-0 w-full" />
                    <div className="flex items-center gap-1">
                      <input value={r.autoMarksPct} onChange={(e) => updateRow(r._key, "autoMarksPct", e.target.value)} type="number" min="0" max="100" step="0.1" placeholder="Auto" className="h-8 rounded border border-gray-200 px-2 text-xs w-full text-right focus:border-indigo-400 focus:ring-0 bg-gray-50" readOnly={false} />
                    </div>
                    <input value={r.manualMarksPct} onChange={(e) => updateRow(r._key, "manualMarksPct", e.target.value)} type="number" min="0" max="100" step="0.1" placeholder="Override" title="Enter manual marks % to override auto-calculated average" className="h-8 rounded border border-indigo-200 bg-indigo-50 px-2 text-xs w-full text-right focus:border-indigo-400 focus:ring-0" />
                    <div className={`h-8 flex items-center justify-center rounded text-xs font-bold px-2 ${r.grade === "—" ? "text-gray-400" : r.grade.trim().toUpperCase().startsWith("F") || r.grade.toUpperCase() === "WD" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                      {r.grade}
                    </div>
                    <button onClick={() => removeRow(r._key)} className="p-1 text-red-400 hover:text-red-600 flex justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Blue "Manual %" overrides the auto-calculated average. Grade is resolved from configured Grade Bands.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void handleSave()} isLoading={saving}>{editId ? "Save Changes" : "Create Transcript"}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
