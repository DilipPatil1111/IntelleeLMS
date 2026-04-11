"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import type { Toast, ToastTone } from "@/hooks/use-toast";

const toneStyles: Record<ToastTone, string> = {
  success:
    "bg-green-50 border-green-400 text-green-800",
  error:
    "bg-red-50 border-red-400 text-red-800",
  warning:
    "bg-amber-50 border-amber-400 text-amber-800",
  info: "bg-blue-50 border-blue-400 text-blue-800",
};

const toneIcons: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />,
  error: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />,
  info: <Info className="h-5 w-5 shrink-0 text-blue-500" />,
};

function ToastItem({ t, dismiss }: { t: Toast; dismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all duration-300 ease-out ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      } ${toneStyles[t.tone]}`}
      style={{ maxWidth: "26rem" }}
    >
      {toneIcons[t.tone]}
      <p className="flex-1 text-sm font-medium leading-snug">
        {t.message}
      </p>
      <button
        onClick={() => dismiss(t.id)}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export function ToastContainer({ toasts, dismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} dismiss={dismiss} />
      ))}
    </div>
  );
}
