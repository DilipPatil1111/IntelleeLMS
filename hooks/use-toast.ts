import { useState, useCallback, useRef } from "react";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/**
 * Lightweight toast state manager. Returns helpers to show/dismiss toasts
 * and the current list of active toasts.
 *
 * Usage:
 *   const { toasts, toast, dismiss } = useToast();
 *   toast("Saved!", "success");
 *   <ToastContainer toasts={toasts} dismiss={dismiss} />
 */
export function useToast(autoDismissMs = 5000) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, message, tone }]);
      if (autoDismissMs > 0) {
        setTimeout(() => dismiss(id), autoDismissMs);
      }
      return id;
    },
    [autoDismissMs, dismiss],
  );

  return { toasts, toast, dismiss } as const;
}
