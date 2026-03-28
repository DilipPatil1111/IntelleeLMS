import type { StudentStatus } from "@/app/generated/prisma/enums";
import { Check, Circle, AlertTriangle, XCircle } from "lucide-react";

const STEPS: { key: StudentStatus; label: string; short: string }[] = [
  { key: "APPLIED", label: "Applied", short: "Apply" },
  { key: "ACCEPTED", label: "Accepted", short: "Offer" },
  { key: "ENROLLED", label: "Enrolled", short: "Study" },
  { key: "COMPLETED", label: "Complete", short: "Done" },
  { key: "GRADUATED", label: "Graduated", short: "Grad" },
];

function stepIndex(status: StudentStatus): number {
  const i = STEPS.findIndex((s) => s.key === status);
  return i >= 0 ? i : -1;
}

/** Approximate milestone for statuses that are not on the linear happy path (visual only). */
function displayStepIndex(status: StudentStatus): number {
  const direct = stepIndex(status);
  if (direct >= 0) return direct;
  if (status === "SUSPENDED") return 2;
  if (status === "RETAKE") return 0;
  if (status === "CANCELLED" || status === "APPLIED") return 0;
  if (status === "EXPELLED" || status === "TRANSFERRED") return 2;
  return 2;
}

function statusTone(status: StudentStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "GRADUATED" || status === "COMPLETED") return "success";
  if (status === "SUSPENDED" || status === "RETAKE") return "warning";
  if (status === "CANCELLED" || status === "EXPELLED" || status === "TRANSFERRED") return "danger";
  return "neutral";
}

export function StudentJourneyProgress({ status }: { status: StudentStatus }) {
  const idx = stepIndex(status);
  const displayIdx = displayStepIndex(status);
  const onTrack = idx >= 0;
  const tone = statusTone(status);
  const pct = Math.min(100, Math.round((displayIdx / (STEPS.length - 1)) * 100));

  const alert =
    !onTrack || tone === "danger" || tone === "warning" ? (
      <div
        className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          tone === "danger"
            ? "border-red-200 bg-red-50 text-red-900"
            : tone === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-slate-200 bg-slate-50 text-slate-800"
        }`}
      >
        {tone === "danger" ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        )}
        <div>
          <p className="font-semibold">Current status: {status.replace(/_/g, " ")}</p>
          <p className="mt-1 text-xs opacity-90">
            {tone === "danger"
              ? "This status ends or pauses the standard progression shown above. Contact the office if you need clarification."
              : tone === "warning"
                ? "Your progression may be on hold. Check notifications and email for required actions."
                : "You are on a non-standard path relative to the main milestones."}
          </p>
        </div>
      </div>
    ) : null;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/80 shadow-sm">
      <div className="border-b border-indigo-100/80 bg-white/60 px-5 py-4 backdrop-blur-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-900/80">Your journey</h2>
        <p className="mt-1 text-xs text-slate-600">From application to graduation — your current milestone is highlighted.</p>
      </div>
      <div className="px-4 py-6 sm:px-6">
        {/* Progress bar */}
        <div className="relative mb-8">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${onTrack ? pct : 0}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs font-medium text-slate-500">
            {onTrack ? `${pct}% along milestones` : `Approx. ${pct}% — see status note below`}
          </p>
        </div>

        {/* Steps */}
        <ol className="grid grid-cols-5 gap-1 sm:gap-2">
          {STEPS.map((step, i) => {
            const reached = i <= displayIdx;
            const current = onTrack ? i === idx : i === displayIdx;
            return (
              <li key={step.key} className="flex flex-col items-center text-center">
                <div
                  className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm transition-colors sm:h-12 sm:w-12 ${
                    current
                      ? "border-indigo-600 bg-indigo-600 text-white ring-4 ring-indigo-200"
                      : reached
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                  aria-current={current ? "step" : undefined}
                >
                  {reached ? <Check className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} /> : <Circle className="h-4 w-4" />}
                </div>
                <span className="hidden text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:block">{step.short}</span>
                <span className="text-[10px] font-semibold leading-tight text-slate-800 sm:text-xs">{step.label}</span>
              </li>
            );
          })}
        </ol>

        {alert}
      </div>
    </section>
  );
}
