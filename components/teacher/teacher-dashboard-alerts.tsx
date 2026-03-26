"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

interface N {
  id: string;
  title: string;
  message: string;
  link: string | null;
  type: string;
}

export function TeacherDashboardAlerts() {
  const [items, setItems] = useState<N[]>([]);

  useEffect(() => {
    fetch("/api/teacher/notifications?unreadOnly=1&type=TEACHER_SELF_ATTENDANCE_REQUIRED")
      .then((r) => r.json())
      .then((d) => setItems(d.notifications || []));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {items.map((n) => (
        <Link
          key={n.id}
          href={n.link || "/teacher/attendance"}
          className="flex items-start gap-3 rounded-xl border-2 border-red-400 bg-gradient-to-r from-red-50 to-orange-50 p-4 shadow-sm transition hover:shadow-md"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-red-900">{n.title}</p>
            <p className="text-sm text-red-800/90 mt-1">{n.message}</p>
            <p className="text-xs font-semibold text-indigo-700 mt-2">Tap to resolve →</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
