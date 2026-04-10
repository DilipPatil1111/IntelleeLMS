import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  className?: string;
  variant?: "default" | "indigo" | "emerald" | "amber" | "rose";
}

const variantStyles: Record<string, { bg: string; iconBg: string; iconText: string }> = {
  default: { bg: "bg-white", iconBg: "bg-gray-50", iconText: "text-gray-500" },
  indigo: { bg: "bg-gradient-to-br from-indigo-50 to-white", iconBg: "bg-indigo-100", iconText: "text-indigo-600" },
  emerald: { bg: "bg-gradient-to-br from-emerald-50 to-white", iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
  amber: { bg: "bg-gradient-to-br from-amber-50 to-white", iconBg: "bg-amber-100", iconText: "text-amber-600" },
  rose: { bg: "bg-gradient-to-br from-rose-50 to-white", iconBg: "bg-rose-100", iconText: "text-rose-600" },
};

export function StatCard({ title, value, subtitle, icon, trend, className, variant = "default" }: StatCardProps) {
  const v = variantStyles[variant] ?? variantStyles.default;
  return (
    <div className={cn(
      "rounded-xl border border-gray-200 p-6 shadow-sm transition-shadow hover:shadow-md",
      v.bg,
      className,
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", v.iconBg, v.iconText)}>
            {icon}
          </div>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p>
      )}
      {trend && (
        <p className={cn("mt-2 text-sm font-medium", trend.value >= 0 ? "text-green-600" : "text-red-600")}>
          {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
