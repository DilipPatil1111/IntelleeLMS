"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface ChartItem {
  name: string;
  passed: number;
  failed: number;
  avg: number;
  count: number;
}

interface ProgramPassRate {
  name: string;
  passRate: number;
  passed: number;
  failed: number;
  total: number;
}

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export function PrincipalCharts({
  data,
  programPassRateData,
}: {
  data: ChartItem[];
  programPassRateData: ProgramPassRate[];
}) {
  const totalPassed = data.reduce((s, d) => s + d.passed, 0);
  const totalFailed = data.reduce((s, d) => s + d.failed, 0);
  const pieData = [
    { name: "Passed", value: totalPassed },
    { name: "Failed", value: totalFailed },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pass/Fail by Subject */}
        <Card>
          <CardHeader><CardTitle>Pass/Fail by Subject</CardTitle></CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="passed" fill="#10b981" name="Passed" />
                  <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Overall Pass/Fail Pie */}
        <Card>
          <CardHeader><CardTitle>Overall Pass/Fail</CardTitle></CardHeader>
          <CardContent>
            {totalPassed + totalFailed === 0 ? (
              <p className="text-center text-gray-500 py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Program-wise Passing Rate */}
      {programPassRateData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Program-wise Passing Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(300, programPassRateData.length * 50)}>
              <BarChart data={programPassRateData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "passRate") return [`${value}%`, "Pass Rate"];
                    return [value, String(name)];
                  }}
                />
                <Bar dataKey="passRate" name="Pass Rate" radius={[0, 6, 6, 0]}>
                  {programPassRateData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend table below the chart */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Program</th>
                    <th className="pb-2 font-medium text-center">Passed</th>
                    <th className="pb-2 font-medium text-center">Failed</th>
                    <th className="pb-2 font-medium text-center">Total</th>
                    <th className="pb-2 font-medium text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {programPassRateData.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 font-medium text-gray-800 flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        {p.name}
                      </td>
                      <td className="py-2 text-center text-green-700">{p.passed}</td>
                      <td className="py-2 text-center text-red-600">{p.failed}</td>
                      <td className="py-2 text-center text-gray-700">{p.total}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{p.passRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
