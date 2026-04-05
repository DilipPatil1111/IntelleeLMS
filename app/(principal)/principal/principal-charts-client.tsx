"use client";

import dynamic from "next/dynamic";

interface ChartItem {
  name: string;
  passed: number;
  failed: number;
  avg: number;
  count: number;
}

function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
      <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
    </div>
  );
}

const PrincipalChartsDynamic = dynamic(
  () => import("./principal-charts").then((m) => ({ default: m.PrincipalCharts })),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export function PrincipalChartsClient({ data }: { data: ChartItem[] }) {
  return <PrincipalChartsDynamic data={data} />;
}
