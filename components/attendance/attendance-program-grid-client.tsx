"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type DateColumnMeta = {
  teachersLabel: string;
  teacherHourLines: { label: string; value: string }[];
  timeRange: string;
  topic: string;
  hoursForDay: number;
};

type TeacherFooterRow = {
  teacherId: string;
  firstName: string;
  lastName: string;
  byDate: Record<string, { hours: number; attendance: string }>;
};

type AssignedTeacher = { id: string; firstName: string; lastName: string };

type GridData = {
  batch: {
    id: string;
    name: string;
    program: { name: string };
  };
  students: { id: string; firstName: string; lastName: string }[];
  dateKeys: string[];
  cells: Record<string, Record<string, string>>;
  holidayYmds: string[];
  dateMeta: Record<string, DateColumnMeta>;
  subjectName: string;
  teacherFooterRows?: TeacherFooterRow[];
  assignedTeachers?: AssignedTeacher[];
};

type Opt = { value: string; label: string };

function formatHeaderDate(ymd: string): string {
  const d = new Date(ymd + "T12:00:00");
  return d
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
    .replace(/ /g, "-");
}

/**
 * Fixed left band for horizontal scroll. Widths must match `left` offsets.
 * Sr = w-10 (2.5rem), name = 200px, total = w-24 (6rem).
 */
const STICKY = {
  nameLeft: "2.5rem",
  totalLeft: "calc(2.5rem + 200px)",
} as const;

export function AttendanceProgramGridClient({
  apiRole,
  embedded = false,
  studentProgramId,
}: {
  apiRole: "teacher" | "principal" | "student";
  /** When true, no outer title (parent Attendance page provides it). */
  embedded?: boolean;
  /** For student role: the currently selected program id from the parent page. */
  studentProgramId?: string;
}) {
  const readOnly = apiRole === "student";
  const base =
    apiRole === "principal"
      ? "/api/principal/attendance/grid"
      : apiRole === "teacher"
        ? "/api/teacher/attendance/grid"
        : "/api/student/attendance/grid";
  const [programs, setPrograms] = useState<
    { id: string; name: string; subjects: { id: string; name: string }[]; batches: { id: string; name: string }[] }[]
  >([]);
  const [teacherSubjects, setTeacherSubjects] = useState<Opt[]>([]);
  const [teacherBatches, setTeacherBatches] = useState<Opt[]>([]);
  const [programId, setProgramId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [data, setData] = useState<GridData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<{ date: string; studentId: string; letter: string }[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<Opt[]>([]);
  const [defaultStartTime, setDefaultStartTime] = useState("09:00");
  const [defaultEndTime, setDefaultEndTime] = useState("17:00");
  const [teacherId, setTeacherId] = useState("");

  useEffect(() => {
    if (apiRole === "student") {
      const qs = studentProgramId ? `?programId=${encodeURIComponent(studentProgramId)}` : "";
      void fetch(`/api/student/attendance/grid-options${qs}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { batchId?: string; subjects?: { id: string; name: string }[] }) => {
          setBatchId(d.batchId ?? "");
          const opts = (d.subjects || []).map((s) => ({ value: s.id, label: s.name }));
          setStudentSubjects(opts);
          setSubjectId(opts[0]?.value || "");
        });
      return;
    }
    const url = apiRole === "principal" ? "/api/principal/academic-options" : "/api/teacher/options";
    void fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (apiRole === "principal") {
          setPrograms(d.programs || []);
        } else {
          setTeacherSubjects((d.subjects || []).map((s: { value: string; label: string }) => ({ value: s.value, label: s.label })));
          setTeacherBatches((d.batches || []).map((b: { value: string; label: string }) => ({ value: b.value, label: b.label })));
        }
      });
  }, [apiRole, studentProgramId]);

  const principalSubjects = useMemo(() => {
    const p = programs.find((x) => x.id === programId);
    return (p?.subjects || []).map((s) => ({ value: s.id, label: s.name }));
  }, [programs, programId]);

  const principalBatches = useMemo(() => {
    const p = programs.find((x) => x.id === programId);
    return (p?.batches || []).map((b) => ({ value: b.id, label: b.name }));
  }, [programs, programId]);

  const loadGrid = useCallback(async () => {
    if (!batchId || !subjectId) return;
    setLoading(true);
    setLoadError(null);
    const qs = new URLSearchParams({ batchId, subjectId });
    const res = await fetch(`${base}?${qs.toString()}`, { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const hasGridShape =
      json &&
      typeof json === "object" &&
      Array.isArray((json as GridData).dateKeys) &&
      Array.isArray((json as GridData).students);

    if (res.ok && hasGridShape) {
      setData(json as GridData);
      setDirty([]);
      const gd = json as GridData;
      if (gd.assignedTeachers && gd.assignedTeachers.length > 0) {
        setTeacherId((prev) => {
          const stillValid = gd.assignedTeachers!.some((t) => t.id === prev);
          return stillValid ? prev : gd.assignedTeachers![0].id;
        });
      } else {
        setTeacherId("");
      }
    } else {
      setData(null);
      const msg =
        json && typeof json.error === "string"
          ? json.error
          : !res.ok
            ? `Request failed (${res.status})`
            : "Invalid response";
      setLoadError(msg);
    }
    setLoading(false);
  }, [base, batchId, subjectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGrid();
  }, [loadGrid]);

  const teacherOptions = useMemo((): Opt[] => {
    if (!data?.assignedTeachers) return [];
    return data.assignedTeachers.map((t) => ({
      value: t.id,
      label: `${t.firstName} ${t.lastName}`.trim(),
    }));
  }, [data]);

  const maxTeacherHourRows = useMemo(() => {
    if (!data?.dateMeta) return 0;
    let m = 0;
    for (const ymd of data.dateKeys) {
      const lines = data.dateMeta[ymd]?.teacherHourLines?.length ?? 0;
      if (lines > m) m = lines;
    }
    return Math.min(Math.max(m, 1), 6);
  }, [data]);

  function cycleCell(sid: string, ymd: string) {
    if (readOnly) return;
    const cur = data?.cells[sid]?.[ymd] ?? "";
    // "P" (excused) cells are managed via excuse requests — don't allow cycling
    if (cur === "P") return;
    const order = ["", "1", "0", "L"];
    const i = order.indexOf(cur);
    const next = order[(i + 1) % order.length];
    setData((prev) => {
      if (!prev) return prev;
      const nextCells = { ...prev.cells, [sid]: { ...prev.cells[sid], [ymd]: next } };
      return { ...prev, cells: nextCells };
    });
    setDirty((d) => {
      const rest = d.filter((x) => !(x.studentId === sid && x.date === ymd));
      return [...rest, { studentId: sid, date: ymd, letter: next }];
    });
  }

  async function save() {
    if (readOnly) return;
    if (!batchId || !subjectId || dirty.length === 0) return;
    setSaving(true);
    await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId,
        subjectId,
        changes: dirty,
        defaultStartTime,
        defaultEndTime,
        teacherId: teacherId || undefined,
      }),
    });
    setSaving(false);
    setDirty([]);
    void loadGrid();
  }

  function cellClass(sid: string, ymd: string, interactive: boolean): string {
    const v = data?.cells[sid]?.[ymd] ?? "";
    const d = new Date(ymd + "T12:00:00");
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHol = data?.holidayYmds.includes(ymd);
    let bg = "bg-white";
    if (v === "P") bg = "bg-violet-200 text-violet-950";
    else if (v === "1") bg = "bg-emerald-200 text-emerald-950";
    else if (v === "0") bg = "bg-red-200 text-red-950";
    else if (v === "L") bg = "bg-amber-200 text-amber-950";
    else if (isWeekend || isHol) bg = "bg-red-100/90";
    const cursor = interactive ? "cursor-pointer" : "cursor-default";
    return `${bg} w-full min-h-[32px] ${cursor} border border-gray-200 text-center text-xs font-bold`;
  }

  const studentTotals = useMemo(() => {
    if (!data) return {};
    const out: Record<string, { hours: number; days: number }> = {};
    for (const s of data.students) {
      let t = 0;
      let days = 0;
      for (const ymd of data.dateKeys) {
        const v = data.cells[s.id]?.[ymd] ?? "";
        const h = data.dateMeta[ymd]?.hoursForDay ?? 1;
        if (v === "1" || v === "L" || v === "P") { t += h; days++; }
      }
      out[s.id] = { hours: Math.round(t * 10) / 10, days };
    }
    return out;
  }, [data]);

  const colTotals = useMemo(() => {
    if (!data) return {};
    const out: Record<string, { one: number; zero: number; l: number }> = {};
    for (const ymd of data.dateKeys) {
      let one = 0,
        zero = 0,
        l = 0;
      for (const s of data.students) {
        const v = data.cells[s.id]?.[ymd] ?? "";
        if (v === "1" || v === "P") one++;
        else if (v === "0") zero++;
        else if (v === "L") l++;
      }
      out[ymd] = { one, zero, l };
    }
    return out;
  }, [data]);

  const teacherRowTotals = useCallback(
    (row: TeacherFooterRow): { hours: number; days: number } => {
      if (!data) return { hours: 0, days: 0 };
      let t = 0;
      let days = 0;
      for (const ymd of data.dateKeys) {
        const cell = row.byDate[ymd];
        t += cell?.hours ?? 0;
        if (cell?.attendance === "P" || cell?.attendance === "PE" || cell?.attendance === "L") days++;
      }
      return { hours: Math.round(t * 10) / 10, days };
    },
    [data],
  );

  return (
    <div className={embedded ? "" : "mt-2"}>
      {!embedded && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Program attendance sheet</h2>
          <p className="text-sm text-gray-500">
            {readOnly
              ? "Your attendance for this subject across the batch date range: 1 = present, 0 = absent, L = late. This sheet is view-only."
              : "Like the main spreadsheet: 1 = present, 0 = absent, L = late. Tap a cell to cycle. Weekends / holidays are tinted red; you can still mark sessions."}
          </p>
        </div>
      )}

      <div className={`mb-4 grid gap-4 ${apiRole === "student" ? "md:grid-cols-1 max-w-md" : "md:grid-cols-3"}`}>
        {apiRole === "principal" && (
          <Select
            label="Program"
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setSubjectId("");
              setBatchId("");
            }}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Program"
          />
        )}
        <Select
          label="Subject"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          options={
            apiRole === "principal" ? principalSubjects : apiRole === "teacher" ? teacherSubjects : studentSubjects
          }
          placeholder="Subject"
        />
        {apiRole !== "student" && (
          <Select
            label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            options={apiRole === "principal" ? principalBatches : teacherBatches}
            placeholder="Batch"
          />
        )}
      </div>

      {/* ── Teacher, time range, Save ── */}
      {!readOnly && data && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {teacherOptions.length > 0 && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Teacher / Trainer</label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <option value="">Select teacher</option>
                {teacherOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Session start</label>
            <input
              type="time"
              value={defaultStartTime}
              onChange={(e) => setDefaultStartTime(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Session end</label>
            <input
              type="time"
              value={defaultEndTime}
              onChange={(e) => setDefaultEndTime(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <Button onClick={() => void save()} disabled={saving || dirty.length === 0}>
            {saving ? "Saving…" : `Save ${dirty.length ? `(${dirty.length})` : ""}`}
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Button variant="outline" onClick={() => void loadGrid()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reload"}
        </Button>
        {!readOnly && !data && (
          <Button onClick={() => void save()} disabled={saving || dirty.length === 0}>
            {saving ? "Saving…" : `Save ${dirty.length ? `(${dirty.length})` : ""}`}
          </Button>
        )}
      </div>

      {data && (
        <Card className="border border-gray-300 shadow-md overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-[min(75vh,900px)] overflow-auto isolate">
              {/*
                border-separate (not collapse) — required for position:sticky on <th>/<td> in WebKit/Chromium.
              */}
              <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
                <thead>
                  <tr className="bg-blue-100">
                    <th
                      colSpan={3 + data.dateKeys.length}
                      className="sticky top-0 z-[45] border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-blue-950"
                    >
                      Attendance Sheet: {data.batch.program.name} — {data.batch.name}
                    </th>
                  </tr>
                  <tr>
                    <th
                      className="sticky left-0 top-10 z-[40] box-border w-10 min-w-[2.5rem] max-w-[2.5rem] border border-gray-300 bg-white px-1 py-2 text-center font-semibold text-gray-800 shadow-[2px_0_0_0_rgba(0,0,0,0.06)]"
                    >
                      Sr
                    </th>
                    <th
                      className="sticky top-10 z-[41] box-border w-[200px] min-w-[200px] max-w-[200px] border border-gray-300 bg-white px-2 py-2 text-left font-semibold text-gray-800 shadow-[2px_0_0_0_rgba(0,0,0,0.06)]"
                      style={{ left: STICKY.nameLeft }}
                    >
                      Student name
                    </th>
                    <th
                      className="sticky top-10 z-[42] box-border w-24 min-w-[6rem] max-w-[6rem] border border-gray-300 bg-white px-1 py-2 text-center font-semibold text-gray-800 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.18)]"
                      style={{ left: STICKY.totalLeft }}
                    >
                      Total hrs attended
                    </th>
                    {data.dateKeys.map((ymd) => {
                      const hol = data.holidayYmds.includes(ymd);
                      const d = new Date(ymd + "T12:00:00");
                      const w = d.getDay();
                      const wk = w === 0 || w === 6;
                      return (
                        <th
                          key={ymd}
                          className={`sticky top-10 z-[35] border border-gray-300 px-1 py-2 text-center font-semibold whitespace-nowrap min-w-[4.5rem] ${
                            hol || wk ? "bg-red-100 text-red-900" : "bg-blue-50 text-blue-950"
                          }`}
                        >
                          {formatHeaderDate(ymd)}
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="bg-emerald-50">
                    <td
                      className="sticky left-0 z-[38] box-border min-w-[calc(2.5rem+200px+6rem)] border border-gray-300 bg-emerald-50 px-1 py-1 text-[10px] font-medium text-emerald-900 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)]"
                      colSpan={3}
                    >
                      Teacher / Trainers
                    </td>
                    {data.dateKeys.map((ymd) => (
                      <td key={ymd} className="border border-emerald-200 bg-emerald-50 px-1 py-1 text-center text-[10px] text-emerald-950">
                        {data.dateMeta[ymd]?.teachersLabel ?? "—"}
                      </td>
                    ))}
                  </tr>
                  {Array.from({ length: maxTeacherHourRows }).map((_, rowIdx) => (
                    <tr key={`thr-${rowIdx}`} className="bg-emerald-50/90">
                      <td
                        className={`sticky left-0 z-[38] box-border min-w-[calc(2.5rem+200px+6rem)] border border-gray-300 bg-emerald-50 px-1 py-0.5 text-[10px] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)] ${
                          rowIdx === 0 ? "font-medium text-emerald-900" : ""
                        }`}
                        colSpan={3}
                      >
                        {rowIdx === 0 ? "Teacher hrs" : ""}
                      </td>
                      {data.dateKeys.map((ymd) => {
                        const line = data.dateMeta[ymd]?.teacherHourLines[rowIdx];
                        return (
                          <td key={ymd} className="border border-emerald-100 bg-emerald-50/90 px-1 py-0.5 text-center text-[10px]">
                            {line ? `${line.label}: ${line.value}` : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-emerald-50">
                    <td
                      className="sticky left-0 z-[38] box-border min-w-[calc(2.5rem+200px+6rem)] border border-gray-300 bg-emerald-50 px-1 py-1 text-[10px] font-medium text-emerald-900 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)]"
                      colSpan={3}
                    >
                      Time
                    </td>
                    {data.dateKeys.map((ymd) => (
                      <td key={ymd} className="border border-emerald-200 bg-emerald-50 px-1 py-1 text-center text-[10px]">
                        {data.dateMeta[ymd]?.timeRange ?? "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-emerald-50">
                    <td
                      className="sticky left-0 z-[38] box-border min-w-[calc(2.5rem+200px+6rem)] border border-gray-300 bg-emerald-50 px-1 py-1 text-[10px] font-medium text-emerald-900 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)]"
                      colSpan={3}
                    >
                      Topic
                    </td>
                    {data.dateKeys.map((ymd) => (
                      <td key={ymd} className="border border-emerald-200 bg-emerald-50 px-1 py-1 text-center text-[10px]">
                        {data.dateMeta[ymd]?.topic ?? data.subjectName ?? "—"}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s, idx) => (
                    <tr key={s.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td
                        className={`sticky left-0 z-[30] box-border w-10 min-w-[2.5rem] max-w-[2.5rem] border border-gray-300 px-1 py-1 text-center text-gray-700 shadow-[2px_0_0_0_rgba(0,0,0,0.06)] ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        {idx + 1}
                      </td>
                      <td
                        className={`sticky z-[31] box-border w-[200px] min-w-[200px] max-w-[200px] border border-gray-300 px-2 py-1 font-medium text-gray-900 whitespace-nowrap shadow-[2px_0_0_0_rgba(0,0,0,0.06)] ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                        style={{ left: STICKY.nameLeft }}
                      >
                        {s.firstName} {s.lastName}
                      </td>
                      <td
                        className={`sticky z-[32] box-border w-24 min-w-[6rem] max-w-[6rem] border border-gray-300 px-1 py-1 text-center font-semibold text-gray-800 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)] ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                        style={{ left: STICKY.totalLeft }}
                      >
                        <div>{studentTotals[s.id]?.hours ?? 0}</div>
                        <div className="text-[9px] font-normal text-gray-500">{studentTotals[s.id]?.days ?? 0}d</div>
                      </td>
                      {data.dateKeys.map((ymd) => (
                        <td key={ymd} className="border border-gray-200 p-0">
                          {readOnly ? (
                            <div className={cellClass(s.id, ymd, false)}>{data.cells[s.id]?.[ymd] ?? ""}</div>
                          ) : (
                            <button type="button" className={cellClass(s.id, ymd, true)} onClick={() => cycleCell(s.id, ymd)}>
                              {data.cells[s.id]?.[ymd] ?? ""}
                            </button>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-medium">
                    <td
                      className="sticky left-0 z-[38] box-border min-w-[calc(2.5rem+200px+6rem)] border border-gray-300 bg-gray-100 px-1 py-2 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)]"
                      colSpan={3}
                    >
                      Column totals (1 / 0 / L)
                    </td>
                    {data.dateKeys.map((ymd) => (
                      <td key={ymd} className="border border-gray-300 bg-gray-100 px-1 py-2 text-center text-[10px]">
                        {colTotals[ymd]?.one ?? 0}/{colTotals[ymd]?.zero ?? 0}/{colTotals[ymd]?.l ?? 0}
                      </td>
                    ))}
                  </tr>
                  {(data.teacherFooterRows?.length ?? 0) > 0 && (
                    <>
                      <tr className="bg-slate-200/90">
                        <td
                          className="sticky left-0 z-[38] box-border min-w-[calc(2.5rem+200px+6rem)] border border-gray-300 bg-slate-200 px-1 py-1.5 text-[10px] font-semibold text-slate-800 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)]"
                          colSpan={3}
                        >
                          Teachers — scheduled hours & self-attendance (P / A / L / E)
                        </td>
                        {data.dateKeys.map((ymd) => (
                          <td key={ymd} className="border border-slate-300 bg-slate-200/90" />
                        ))}
                      </tr>
                      {data.teacherFooterRows!.map((row, tidx) => (
                        <tr key={row.teacherId} className={tidx % 2 === 0 ? "bg-indigo-50/95" : "bg-indigo-100/80"}>
                          <td
                            className={`sticky left-0 z-[30] box-border w-10 min-w-[2.5rem] max-w-[2.5rem] border border-gray-300 px-1 py-1 text-center text-[10px] text-indigo-900 shadow-[2px_0_0_0_rgba(0,0,0,0.06)] ${
                              tidx % 2 === 0 ? "bg-indigo-50/95" : "bg-indigo-100/80"
                            }`}
                          >
                            T{tidx + 1}
                          </td>
                          <td
                            className={`sticky z-[31] box-border w-[200px] min-w-[200px] max-w-[200px] border border-gray-300 px-2 py-1 text-[11px] font-medium text-indigo-950 whitespace-nowrap shadow-[2px_0_0_0_rgba(0,0,0,0.06)] ${
                              tidx % 2 === 0 ? "bg-indigo-50/95" : "bg-indigo-100/80"
                            }`}
                            style={{ left: STICKY.nameLeft }}
                          >
                            {row.firstName} {row.lastName}
                          </td>
                          <td
                            className={`sticky z-[32] box-border w-24 min-w-[6rem] max-w-[6rem] border border-gray-300 px-1 py-1 text-center text-[10px] font-semibold text-indigo-900 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)] ${
                              tidx % 2 === 0 ? "bg-indigo-50/95" : "bg-indigo-100/80"
                            }`}
                            style={{ left: STICKY.totalLeft }}
                          >
                            <div>{teacherRowTotals(row).hours}h</div>
                            <div className="text-[9px] font-normal text-indigo-700">{teacherRowTotals(row).days}d</div>
                          </td>
                          {data.dateKeys.map((ymd) => {
                            const cell = row.byDate[ymd];
                            return (
                              <td key={ymd} className="border border-indigo-100 px-0.5 py-1 text-center align-top">
                                <div className="text-[10px] text-indigo-900">{cell?.hours ?? 0}h</div>
                                <div
                                  className={`text-[10px] font-bold ${
                                    cell?.attendance === "PE"
                                      ? "text-violet-700"
                                      : cell?.attendance === "P"
                                        ? "text-emerald-700"
                                        : cell?.attendance === "A"
                                          ? "text-red-700"
                                          : cell?.attendance === "L"
                                            ? "text-amber-700"
                                            : "text-gray-500"
                                  }`}
                                >
                                  {cell?.attendance === "PE" ? "P" : (cell?.attendance ?? "—")}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !data && subjectId && batchId && (
        <p className="text-sm text-red-600">{loadError ?? "Could not load sheet."}</p>
      )}
      {!loading && !data && apiRole === "student" && batchId && !subjectId && studentSubjects.length > 0 && (
        <p className="text-sm text-gray-500">Select a subject to load your attendance sheet.</p>
      )}
      {!loading && apiRole === "student" && batchId && studentSubjects.length === 0 && (
        <p className="text-sm text-gray-500">No subjects are set up for your program yet.</p>
      )}
    </div>
  );
}
