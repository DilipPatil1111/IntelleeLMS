"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { slotDurationMinutes, toHHmm } from "@/lib/program-calendar-hours";
import { formatYmd } from "@/lib/day-boundaries";
import { ymdRange } from "@/lib/program-calendar-grid";
import { defaultTeacherSlotColor } from "@/lib/teacher-slot-color";
import { sessionCategoryLabel } from "@/lib/program-session-category";
import { ProgramCalendarGrid } from "@/components/calendar/program-calendar-grid";
import {
  groupSlotsIntoMergedBlocks,
  formatDateRangeLabel,
  type CalendarSlotRun,
} from "@/lib/program-calendar-slot-groups";
import { Loader2, Trash2, Bell, Pencil } from "lucide-react";

type Mode = "principal" | "teacher" | "student";

type Slot = {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  slotType: string;
  sessionCategory: string | null;
  colorHex: string;
  teacher: { id: string; firstName: string; lastName: string };
  subject: { id: string; name: string } | null;
};

type ProgramOpt = {
  id: string;
  name: string;
  batches: { id: string; name: string; startDate?: string; endDate?: string }[];
};

type TeacherOpt = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  subjects: { id: string; name: string }[];
};

type BatchOpt = { value: string; label: string; programId: string };

type HolidayLite = { date: string; name: string; type: string };

export function FullProgramCalendarClient({
  mode,
  fixedBatchId,
  initialBatchId,
  initialDate,
}: {
  mode: Mode;
  fixedBatchId?: string | null;
  /** Pre-select batch (e.g. principal opened from notification). */
  initialBatchId?: string | null;
  initialDate?: string | null;
}) {
  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState(fixedBatchId || "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [holidays, setHolidays] = useState<HolidayLite[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [newTeacher, setNewTeacher] = useState("");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const [newType, setNewType] = useState("SESSION");
  const [newSessionCategory, setNewSessionCategory] = useState("THEORY");
  const [useCustomSlotColor, setUseCustomSlotColor] = useState(false);
  const [newColor, setNewColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [editingRun, setEditingRun] = useState<CalendarSlotRun | null>(null);
  const [editTeacher, setEditTeacher] = useState("");
  const [editStart, setEditStart] = useState("09:00");
  const [editEnd, setEditEnd] = useState("10:00");
  const [editType, setEditType] = useState("SESSION");
  const [editCategory, setEditCategory] = useState("THEORY");
  const [editUseCustom, setEditUseCustom] = useState(false);
  const [editColor, setEditColor] = useState("#6366f1");
  const [editDateFrom, setEditDateFrom] = useState("");
  const [editDateTo, setEditDateTo] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingRunKey, setDeletingRunKey] = useState<string | null>(null);
  const [teacherBatches, setTeacherBatches] = useState<BatchOpt[]>([]);
  const [teacherPrograms, setTeacherPrograms] = useState<{ value: string; label: string }[]>([]);
  /** Batch/program names from API (used when student view has no local program list). */
  const [studentGridNames, setStudentGridNames] = useState<{ programName: string; batchName: string } | null>(null);

  const { data: session } = useSession();

  const apiBase =
    mode === "principal" ? "/api/principal/program-calendar" : mode === "teacher" ? "/api/teacher/program-calendar" : "/api/student/program-calendar";

  useEffect(() => {
    if (mode !== "principal") return;
    void fetch("/api/principal/academic-options")
      .then((r) => r.json())
      .then((d) => setPrograms(d.programs || []));
  }, [mode]);

  useEffect(() => {
    if (mode !== "teacher") return;
    void fetch("/api/teacher/options")
      .then((r) => r.json())
      .then((d) => {
        setTeacherBatches(d.batches || []);
        setTeacherPrograms(d.programs || []);
      });
  }, [mode]);

  const batches = useMemo(() => {
    const p = programs.find((x) => x.id === programId);
    return p?.batches || [];
  }, [programs, programId]);

  const loadSlots = useCallback(async () => {
    if (!batchId || !from || !to) return;
    setLoading(true);
    const res = await fetch(`${apiBase}?batchId=${batchId}&from=${from}&to=${to}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSlots([]);
      setHolidays([]);
      setStudentGridNames(null);
      setLoading(false);
      return;
    }
    const raw = (data.slots || []) as (Slot & {
      slotDate: string | Date;
      batch?: { name: string; program: { name: string } };
    })[];
    const firstWithBatch = raw.find((s) => s.batch?.program?.name);
    if (firstWithBatch?.batch?.program) {
      setStudentGridNames({
        programName: firstWithBatch.batch.program.name,
        batchName: firstWithBatch.batch.name,
      });
    } else {
      setStudentGridNames(null);
    }
    setSlots(
      raw.map((s) => {
        const slotDate = formatYmd(new Date(s.slotDate as string | Date));
        const { batch: _dropBatch, ...rest } = s as typeof s & { batch?: unknown };
        return {
          ...rest,
          slotDate,
          startTime: toHHmm(s.startTime),
          endTime: toHHmm(s.endTime),
          sessionCategory: s.sessionCategory ?? null,
        };
      }),
    );
    setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
    setLoading(false);
  }, [apiBase, batchId, from, to]);

  useEffect(() => {
    if (batchId && from && to) void loadSlots();
  }, [batchId, from, to, loadSlots]);

  useEffect(() => {
    if (mode !== "principal" || !batchId) return;
    void fetch(`/api/principal/program-calendar/teachers?batchId=${batchId}`)
      .then((r) => r.json())
      .then((d) => setTeachers(d.teachers || []));
  }, [mode, batchId]);

  useEffect(() => {
    if (!batchId) return;
    const b = programs.flatMap((p) => p.batches).find((x) => x.id === batchId);
    if (!b) return;
    const prog = programs.find((p) => p.batches.some((bb) => bb.id === batchId));
    if (prog && !programId) setProgramId(prog.id);
  }, [batchId, programs, programId]);

  useEffect(() => {
    if (fixedBatchId) setBatchId(fixedBatchId);
  }, [fixedBatchId]);

  useEffect(() => {
    if (mode === "principal" && initialBatchId) setBatchId(initialBatchId);
  }, [mode, initialBatchId]);

  useEffect(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    setFrom(formatYmd(start));
    setTo(formatYmd(end));
    if (initialDate) {
      const d = new Date(initialDate + "T12:00:00");
      setFrom(formatYmd(new Date(d.getFullYear(), d.getMonth(), 1)));
      setTo(formatYmd(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
    }
  }, [initialDate]);

  /** When a batch is selected, align From/To with that batch’s program duration (batch start → batch end). */
  useEffect(() => {
    if (mode !== "principal" || !batchId || programs.length === 0) return;
    const batch = programs.flatMap((p) => p.batches).find((b) => b.id === batchId);
    if (!batch?.startDate || !batch?.endDate) return;
    setFrom(formatYmd(new Date(batch.startDate)));
    setTo(formatYmd(new Date(batch.endDate)));
  }, [mode, batchId, programs]);

  const hoursByTeacher = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) {
      const min = slotDurationMinutes(s.startTime, s.endTime);
      if (s.slotType === "LUNCH") continue;
      const id = s.teacher.id;
      m.set(id, (m.get(id) || 0) + min / 60);
    }
    return m;
  }, [slots]);

  const totalHours = useMemo(() => {
    let t = 0;
    for (const s of slots) {
      if (s.slotType === "LUNCH") continue;
      t += slotDurationMinutes(s.startTime, s.endTime) / 60;
    }
    return Math.round(t * 10) / 10;
  }, [slots]);

  const slotRuns = useMemo(() => groupSlotsIntoMergedBlocks(slots), [slots]);

  const programNameForGrid = useMemo(() => {
    if (mode === "principal") {
      return programs.find((p) => p.id === programId)?.name?.trim() || "—";
    }
    if (mode === "teacher") {
      const pid = teacherBatches.find((b) => b.value === batchId)?.programId;
      return teacherPrograms.find((p) => p.value === pid)?.label?.trim() || "—";
    }
    return studentGridNames?.programName?.trim() || "—";
  }, [mode, programs, programId, teacherBatches, batchId, teacherPrograms, studentGridNames]);

  const batchNameForGrid = useMemo(() => {
    if (mode === "principal") {
      return batches.find((b) => b.id === batchId)?.name?.trim() || "—";
    }
    if (mode === "teacher") {
      const tb = teacherBatches.find((b) => b.value === batchId);
      if (!tb?.label) return "—";
      const i = tb.label.indexOf(" — ");
      if (i === -1) return tb.label.trim();
      return tb.label.slice(0, i).trim() || "—";
    }
    return studentGridNames?.batchName?.trim() || "—";
  }, [mode, batches, batchId, teacherBatches, studentGridNames]);

  const teacherNamesForGrid = useMemo(() => {
    const byId = new Map<string, string>();
    for (const s of slots) {
      byId.set(s.teacher.id, `${s.teacher.firstName} ${s.teacher.lastName}`.trim());
    }
    if (byId.size > 0) {
      return [...byId.values()].sort((a, b) => a.localeCompare(b)).join(", ");
    }
    if (mode === "principal" && teachers.length > 0) {
      return teachers
        .map((t) => `${t.firstName} ${t.lastName}`.trim())
        .sort((a, b) => a.localeCompare(b))
        .join(", ");
    }
    if (mode === "teacher") {
      const n = session?.user?.name?.trim();
      if (n) return n;
      const e = session?.user?.email?.trim();
      if (e) return e;
    }
    return "—";
  }, [slots, teachers, mode, session]);

  const programGridTitle = useMemo(
    () =>
      `Program grid (Excel-style): Teacher Name: ${teacherNamesForGrid} · Program Name: ${programNameForGrid} · Batch Name: ${batchNameForGrid}`,
    [teacherNamesForGrid, programNameForGrid, batchNameForGrid],
  );

  const dateRangeDayCount = useMemo(() => {
    if (!from || !to) return 0;
    return ymdRange(from, to).length;
  }, [from, to]);

  async function addSlots() {
    if (!batchId || !programId || !newTeacher || !from || !to) return;
    const dates = ymdRange(from, to);
    if (dates.length === 0) {
      alert("Invalid date range (From must be on or before To).");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/principal/program-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programId,
        batchId,
        teacherUserId: newTeacher,
        slotType: newType,
        startTime: newStart,
        endTime: newEnd,
        ...(useCustomSlotColor ? { colorHex: newColor } : {}),
        dates,
        sessionCategory: newType === "SESSION" ? newSessionCategory : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(typeof err?.error === "string" ? err.error : "Could not save blocks.");
      return;
    }
    void loadSlots();
  }

  function openEditRun(run: CalendarSlotRun) {
    setEditingRun(run);
    setEditTeacher(run.teacher.id);
    setEditStart(toHHmm(run.startTime));
    setEditEnd(toHHmm(run.endTime));
    setEditType(run.slotType);
    setEditCategory(run.sessionCategory || "THEORY");
    setEditColor(run.colorHex);
    setEditUseCustom(true);
    setEditDateFrom(run.dateFrom);
    setEditDateTo(run.dateTo);
  }

  function closeEditRun() {
    setEditingRun(null);
  }

  async function saveEditedRun() {
    if (!editingRun || !programId || !batchId) return;
    if (slotDurationMinutes(editStart, editEnd) <= 0) {
      alert("Invalid time range.");
      return;
    }
    if (!editDateFrom || !editDateTo || editDateFrom > editDateTo) {
      alert("Invalid date range (From must be on or before To).");
      return;
    }
    const hex = editUseCustom && /^#[0-9A-Fa-f]{6}$/.test(editColor.trim()) ? editColor.trim() : defaultTeacherSlotColor(editTeacher);
    const patchBody: Record<string, unknown> = {
      teacherUserId: editTeacher,
      startTime: editStart,
      endTime: editEnd,
      slotType: editType === "LUNCH" ? "LUNCH" : "SESSION",
      sessionCategory: editType === "SESSION" ? editCategory : null,
      colorHex: hex,
    };

    const desiredDates = new Set(ymdRange(editDateFrom, editDateTo));
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const snapshot = editingRun.slotIds.map((id) => slotById.get(id)).filter((x): x is Slot => x != null);

    setSavingEdit(true);
    try {
      for (const s of snapshot) {
        if (!desiredDates.has(s.slotDate)) {
          const res = await fetch(`/api/principal/program-calendar/${s.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("delete");
        }
      }

      for (const s of snapshot) {
        if (desiredDates.has(s.slotDate)) {
          const res = await fetch(`/api/principal/program-calendar/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
          });
          if (!res.ok) throw new Error("patch");
        }
      }

      const covered = new Set(snapshot.filter((s) => desiredDates.has(s.slotDate)).map((s) => s.slotDate));
      const missing = [...desiredDates].filter((d) => !covered.has(d));
      if (missing.length > 0) {
        const res = await fetch("/api/principal/program-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programId,
            batchId,
            teacherUserId: editTeacher,
            slotType: editType === "LUNCH" ? "LUNCH" : "SESSION",
            startTime: editStart,
            endTime: editEnd,
            colorHex: hex,
            dates: missing,
            sessionCategory: editType === "SESSION" ? editCategory : null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(typeof err?.error === "string" ? err.error : "Could not add days to block.");
          return;
        }
      }
    } catch {
      alert("Could not update block.");
      setSavingEdit(false);
      return;
    }
    setSavingEdit(false);
    closeEditRun();
    void loadSlots();
  }

  async function removeRun(run: CalendarSlotRun) {
    const n = run.slotIds.length;
    if (!confirm(`Delete this block for all ${n} day(s) (${formatDateRangeLabel(run.dateFrom, run.dateTo)})?`)) return;
    setDeletingRunKey(run.key);
    await Promise.all(run.slotIds.map((id) => fetch(`/api/principal/program-calendar/${id}`, { method: "DELETE" })));
    setDeletingRunKey(null);
    void loadSlots();
  }

  async function notifyPrincipal() {
    if (!batchId || !from) return;
    const d = initialDate || from;
    await fetch("/api/teacher/program-calendar/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, slotDate: d }),
    });
    alert("Notification sent to principal(s).");
  }

  const readOnly = mode !== "principal";

  return (
    <>
      <PageHeader
        title="Full Calendar"
        description={
          mode === "principal"
            ? "Program / batch schedule: day × time grid, session categories, teacher colors, lunch, and daily hour totals."
            : "View-only program calendar for your batch."
        }
      />

      {mode === "principal" && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Select
            label="Program"
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setBatchId("");
            }}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Select program"
          />
          <Select
            label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            options={batches.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="Select batch"
          />
        </div>
      )}

      {mode === "teacher" && !fixedBatchId && (
        <div className="mb-6 max-w-md">
          <Select
            label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            options={teacherBatches.map((b) => ({ value: b.value, label: b.label }))}
            placeholder="Select batch"
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {mode === "principal" && (
          <>
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </>
        )}
        {readOnly && (
          <>
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" readOnly={!!fixedBatchId} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" readOnly={!!fixedBatchId} />
          </>
        )}
        <Button variant="outline" onClick={() => void loadSlots()} disabled={loading || !batchId}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
        {mode === "teacher" && batchId && (
          <Button variant="secondary" onClick={() => void notifyPrincipal()}>
            <Bell className="h-4 w-4 mr-1" /> Request schedule update
          </Button>
        )}
      </div>

      {mode === "principal" && batchId && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Add time blocks</CardTitle>
            <p className="text-sm text-gray-500">
              Blocks use the <strong>From</strong> and <strong>To</strong> dates above (batch duration is filled automatically when you pick a batch).
              One row is created per calendar day in that range for the selected time band. Use Lunch for breaks (no category).
              Custom color is optional; otherwise each teacher gets a stable default color.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Teacher"
                value={newTeacher}
                onChange={(e) => setNewTeacher(e.target.value)}
                options={teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
                placeholder="Select teacher"
              />
              <Input label="From time" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              <Input label="To time" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              <Select
                label="Type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                options={[
                  { value: "SESSION", label: "Session" },
                  { value: "LUNCH", label: "Lunch" },
                ]}
              />
            </div>
            {newType === "SESSION" && (
              <Select
                label="Session category"
                value={newSessionCategory}
                onChange={(e) => setNewSessionCategory(e.target.value)}
                options={[
                  { value: "THEORY", label: "Theory" },
                  { value: "PRACTICAL", label: "Practical" },
                  { value: "SLACK", label: "Slack" },
                  { value: "PROJECT", label: "Project" },
                ]}
              />
            )}
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={useCustomSlotColor}
                  onChange={(e) => setUseCustomSlotColor(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Custom block color
              </label>
              {useCustomSlotColor && (
                <Input label="Color" type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-10 w-24" />
              )}
            </div>
            {from && to && (
              <p className="text-sm text-gray-700">
                Will create <strong>{dateRangeDayCount}</strong> block(s), one per day from <span className="tabular-nums">{from}</span> through{" "}
                <span className="tabular-nums">{to}</span>.
              </p>
            )}
            <Button onClick={() => void addSlots()} disabled={saving || !newTeacher || !from || !to || dateRangeDayCount === 0}>
              {saving ? "Saving…" : "Apply to full date range"}
            </Button>
          </CardContent>
        </Card>
      )}

      {batchId && from && to && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base text-balance leading-snug">{programGridTitle}</CardTitle>
            <p className="text-sm text-gray-600">
              One column per day, hours down the left. Weekends and holidays are tinted; teaching blocks show teacher name and
              category; the bottom row is total scheduled hours (sessions only, excluding lunch).
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ProgramCalendarGrid fromYmd={from} toYmd={to} slots={slots} holidays={holidays} />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled blocks</CardTitle>
          <p className="text-sm text-gray-500">
            One row per teacher + time band + session + type + color in this view. Date range is the span of days in the
            filter. Total teaching hours (excl. lunch): <strong>{totalHours}</strong>h
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <div className="space-y-2 text-gray-500">
              <p>No scheduled time blocks (sessions / lunch) for this batch in the selected range.</p>
              <p className="text-sm text-gray-600">
                Ask a principal to add blocks on Full Calendar if the schedule should appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Date range</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Blocked time</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Teacher</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Session</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Session type</th>
                    {mode === "principal" && (
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {slotRuns.map((run) => (
                    <tr key={run.key} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-900">
                        {formatDateRangeLabel(run.dateFrom, run.dateTo)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: run.colorHex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}
                        >
                          {toHHmm(run.startTime)} – {toHHmm(run.endTime)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        {run.teacher.firstName} {run.teacher.lastName}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={run.slotType === "LUNCH" ? "warning" : "info"}>{run.slotType}</Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {run.slotType === "SESSION" && run.sessionCategory
                          ? sessionCategoryLabel(run.sessionCategory)
                          : "—"}
                      </td>
                      {mode === "principal" && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="mr-1"
                            onClick={() => openEditRun(run)}
                            disabled={deletingRunKey === run.key}
                            aria-label="Edit block"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void removeRun(run)}
                            disabled={deletingRunKey === run.key}
                            aria-label="Delete block"
                          >
                            {deletingRunKey === run.key ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hoursByTeacher.size > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Hours by teacher (sessions only)</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {[...hoursByTeacher.entries()].map(([tid, h]) => {
                  const t = slots.find((s) => s.teacher.id === tid)?.teacher;
                  const label = t ? `${t.firstName} ${t.lastName}` : tid;
                  return (
                    <li key={tid}>
                      {label}: <strong>{Math.round(h * 10) / 10}h</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {editingRun && mode === "principal" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-block-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditRun();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <Card className="overflow-y-auto shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">
                <span id="edit-block-title">Update block</span>
              </CardTitle>
              <p className="text-sm text-gray-600">
                Adjust <strong>Block from / to</strong> to add or remove days. Other changes apply to every day that remains
                in range.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Block from" type="date" value={editDateFrom} onChange={(e) => setEditDateFrom(e.target.value)} />
                <Input label="Block to" type="date" value={editDateTo} onChange={(e) => setEditDateTo(e.target.value)} />
              </div>
              <Select
                label="Teacher"
                value={editTeacher}
                onChange={(e) => setEditTeacher(e.target.value)}
                options={teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="From time" type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                <Input label="To time" type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
              </div>
              <Select
                label="Session"
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                options={[
                  { value: "SESSION", label: "Session" },
                  { value: "LUNCH", label: "Lunch" },
                ]}
              />
              {editType === "SESSION" && (
                <Select
                  label="Session type"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  options={[
                    { value: "THEORY", label: "Theory" },
                    { value: "PRACTICAL", label: "Practical" },
                    { value: "SLACK", label: "Slack" },
                    { value: "PROJECT", label: "Project" },
                  ]}
                />
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editUseCustom}
                  onChange={(e) => setEditUseCustom(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Custom block color
              </label>
              {editUseCustom && (
                <Input label="Color" type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-10 w-24" />
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeEditRun} disabled={savingEdit}>
                  Cancel
                </Button>
                <Button onClick={() => void saveEditedRun()} disabled={savingEdit}>
                  {savingEdit ? "Saving…" : "Update"}
                </Button>
              </div>
            </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
