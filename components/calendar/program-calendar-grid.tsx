"use client";

import { useMemo } from "react";
import { slotDurationMinutes } from "@/lib/program-calendar-hours";
import {
  hourRowLabels,
  isWeekendYmd,
  slotOverlapsHour,
  ymdRange,
} from "@/lib/program-calendar-grid";
import { sessionCategoryLabel, sessionCategoryTextClass } from "@/lib/program-session-category";

export type ProgramCalendarGridSlot = {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  slotType: string;
  sessionCategory: string | null;
  colorHex: string;
  teacher: { firstName: string; lastName: string };
};

type HolidayLite = { date: string; name: string; type: string };

type Props = {
  fromYmd: string;
  toYmd: string;
  slots: ProgramCalendarGridSlot[];
  holidays: HolidayLite[];
};

function monthShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: "short" });
}

function dowShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short" });
}

export function ProgramCalendarGrid({ fromYmd, toYmd, slots, holidays }: Props) {
  const days = useMemo(() => ymdRange(fromYmd, toYmd), [fromYmd, toYmd]);
  const holMap = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);
  const hourRows = useMemo(() => hourRowLabels(), []);

  const slotsByYmd = useMemo(() => {
    const m = new Map<string, ProgramCalendarGridSlot[]>();
    for (const s of slots) {
      const list = m.get(s.slotDate) || [];
      list.push(s);
      m.set(s.slotDate, list);
    }
    return m;
  }, [slots]);

  const hoursTotalByYmd = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) {
      if (s.slotType === "LUNCH") continue;
      const h = slotDurationMinutes(s.startTime, s.endTime) / 60;
      m.set(s.slotDate, (m.get(s.slotDate) || 0) + h);
    }
    return m;
  }, [slots]);

  if (days.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-max border-collapse text-xs">
        <thead>
          <tr>
            <th
              rowSpan={3}
              className="sticky left-0 z-20 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-600"
            >
              Time
            </th>
            {days.map((ymd) => {
              const h = holMap.get(ymd);
              const weekend = isWeekendYmd(ymd);
              const tint =
                weekend || h
                  ? weekend
                    ? "bg-amber-50/90"
                    : "bg-rose-50/80"
                  : "bg-white";
              return (
                <th
                  key={ymd}
                  colSpan={1}
                  className={`border-b border-r border-gray-200 px-1 py-1 text-center font-medium text-gray-800 ${tint}`}
                >
                  {monthShort(ymd)}
                </th>
              );
            })}
          </tr>
          <tr>
            {days.map((ymd) => {
              const h = holMap.get(ymd);
              const weekend = isWeekendYmd(ymd);
              const tint = weekend ? "bg-amber-50/90" : h ? "bg-rose-50/80" : "bg-white";
              return (
                <th key={`dow-${ymd}`} className={`border-b border-r border-gray-100 px-1 py-0.5 text-gray-600 ${tint}`}>
                  {dowShort(ymd)}
                </th>
              );
            })}
          </tr>
          <tr>
            {days.map((ymd) => {
              const h = holMap.get(ymd);
              const weekend = isWeekendYmd(ymd);
              const tint = weekend ? "bg-amber-50/90" : h ? "bg-rose-50/80" : "bg-white";
              const [_, __, dd] = ymd.split("-");
              return (
                <th key={`num-${ymd}`} className={`border-b border-r border-gray-200 px-1 py-1 tabular-nums text-gray-900 ${tint}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-semibold">{dd}</span>
                    {h && (
                      <span className="max-w-[4.5rem] truncate text-[10px] font-normal leading-tight text-rose-800" title={h.name}>
                        {h.name}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {hourRows.map(({ hour, label }) => (
            <tr key={hour}>
              <td className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-2 py-0.5 whitespace-nowrap text-gray-600">
                {label}
              </td>
              {days.map((ymd) => {
                const h = holMap.get(ymd);
                const weekend = isWeekendYmd(ymd);
                const bg = weekend ? "bg-amber-50/40" : h ? "bg-rose-50/40" : "bg-white";
                const daySlots = slotsByYmd.get(ymd) || [];
                const here = daySlots.filter((s) => slotOverlapsHour(s.startTime, s.endTime, hour));
                return (
                  <td key={`${ymd}-${hour}`} className={`align-top border-b border-r border-gray-100 ${bg} min-w-[5.5rem] max-w-[7rem] p-0.5`}>
                    <div className="flex min-h-[2rem] flex-col gap-0.5">
                      {here.map((s) => {
                        const isLunch = s.slotType === "LUNCH";
                        const cat = s.sessionCategory;
                        const name = `${s.teacher.firstName} ${s.teacher.lastName}`.trim();
                        return (
                          <div
                            key={s.id + hour}
                            className={`rounded px-1 py-0.5 text-[10px] leading-tight ${
                              isLunch ? "border border-dashed border-gray-400 bg-gray-200/90 text-gray-800" : ""
                            }`}
                            style={
                              isLunch
                                ? undefined
                                : {
                                    backgroundColor: s.colorHex,
                                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.14)",
                                  }
                            }
                            title={
                              isLunch
                                ? `Lunch ${s.startTime}–${s.endTime}`
                                : `${name} · ${sessionCategoryLabel(cat)} · ${s.startTime}–${s.endTime}`
                            }
                          >
                            {!isLunch && (
                              <>
                                <div className={`font-medium ${sessionCategoryTextClass(cat)}`}>{name}</div>
                                {cat && (
                                  <div className={`opacity-95 ${sessionCategoryTextClass(cat)}`}>{sessionCategoryLabel(cat)}</div>
                                )}
                              </>
                            )}
                            {isLunch && <span className="font-medium">Lunch</span>}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td className="sticky left-0 z-10 border-t-2 border-r border-gray-300 bg-gray-100 px-2 py-1 font-semibold text-gray-800">
              Total h
            </td>
            {days.map((ymd) => {
              const h = holMap.get(ymd);
              const weekend = isWeekendYmd(ymd);
              const bg = weekend ? "bg-amber-100/80" : h ? "bg-rose-100/70" : "bg-gray-100";
              const total = hoursTotalByYmd.get(ymd) || 0;
              const rounded = Math.round(total * 10) / 10;
              return (
                <td key={`tot-${ymd}`} className={`border-t-2 border-r border-gray-300 ${bg} px-1 py-1 text-center font-semibold tabular-nums text-gray-900`}>
                  {rounded}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
        <span className="font-medium text-gray-700">Legend:</span> column tint —{" "}
        <span className="text-amber-800">weekend</span>, <span className="text-rose-800">institution holiday</span>.
        Session blocks use the teacher color; categories (Theory, Practical, Slack, Project) are shown as sublabels. Lunch blocks are gray.
        Grid hours follow the same range as the schedule grid (8:00 AM–9:59 PM by default).
      </div>
    </div>
  );
}
