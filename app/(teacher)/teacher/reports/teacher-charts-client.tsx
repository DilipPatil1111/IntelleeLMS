"use client";

import dynamic from "next/dynamic";

interface ChartDataItem {
  name: string;
  passed: number;
  failed: number;
  avg: number;
  total: number;
  subject: string;
}

function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
      <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
    </div>
  );
}

const TeacherChartsDynamic = dynamic(
  () => import("./teacher-charts").then((m) => ({ default: m.TeacherCharts })),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export function TeacherChartsClient({ data }: { data: ChartDataItem[] }) {
  return <TeacherChartsDynamic data={data} />;
}
