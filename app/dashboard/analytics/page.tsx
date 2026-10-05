"use client";

import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Phone,
  Users,
  BarChart3,
  Activity,
  Zap,
  Calendar,
  IndianRupee,
  MapPin,
} from "lucide-react";
import { stats, pipeline, formatCurrency } from "@/lib/mock-data";

const PERFORMANCE_METRICS = [
  { label: "Leads Generated", value: "312", change: "+18%", up: true, icon: Target, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { label: "Calls Made", value: "1,847", change: "+12%", up: true, icon: Phone, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Site Visits", value: "156", change: "+23%", up: true, icon: MapPin, color: "text-amber-400", bg: "bg-amber-500/10" },
  { label: "Deals Closed", value: "67", change: "+31%", up: true, icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Revenue", value: "42.5 Cr", change: "+18.7%", up: true, icon: IndianRupee, color: "text-violet-400", bg: "bg-violet-500/10" },
  { label: "Avg Deal Size", value: "63.4L", change: "+5.7%", up: true, icon: BarChart3, color: "text-pink-400", bg: "bg-pink-500/10" },
];

const HEATMAP_DATA = [
  [3, 5, 2, 8, 6, 4, 1],
  [4, 7, 3, 6, 9, 5, 2],
  [2, 6, 8, 4, 7, 3, 0],
  [5, 4, 6, 9, 5, 8, 1],
];

const WEEKS = ["Week 1", "Week 2", "Week 3", "Week 4"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TOP_PERFORMERS = [
  { name: "Meera Singh", deals: 15, revenue: "9.2 Cr", calls: 342, rank: 1 },
  { name: "Arjun Patel", deals: 12, revenue: "8.1 Cr", calls: 287, rank: 2 },
  { name: "Nisha Gupta", deals: 10, revenue: "6.8 Cr", calls: 256, rank: 3 },
  { name: "Kavitha Rajan", deals: 9, revenue: "5.4 Cr", calls: 198, rank: 4 },
  { name: "Deepak Joshi", deals: 8, revenue: "4.9 Cr", calls: 312, rank: 5 },
];

export default function AnalyticsPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Analytics</h1>
        <p className="text-brand-dim text-sm mt-1">Performance insights and team metrics</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {PERFORMANCE_METRICS.map((metric) => (
          <div key={metric.label} className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${metric.bg} flex items-center justify-center`}>
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${metric.up ? "text-emerald-400" : "text-red-400"}`}>
                {metric.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {metric.change}
              </div>
            </div>
            <p className="text-2xl font-black text-brand-text">{metric.value}</p>
            <p className="text-xs text-brand-dim mt-1">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <h2 className="text-lg font-bold text-brand-text mb-5">Conversion Funnel</h2>
          <div className="space-y-3">
            {pipeline.map((stage, i) => {
              const maxCount = pipeline[0].count;
              const width = (stage.count / maxCount) * 100;
              return (
                <div key={stage.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-sm font-medium text-brand-text">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold" style={{ color: stage.color }}>{stage.count}</span>
                      {i > 0 && (
                        <span className="text-xs text-brand-dim">
                          {((stage.count / pipeline[i - 1].count) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-8 bg-brand-surface rounded-xl overflow-hidden">
                    <div
                      className="h-full rounded-xl transition-all duration-700 flex items-center pl-3"
                      style={{ width: `${width}%`, backgroundColor: stage.color + "30" }}
                    >
                      <span className="text-[10px] font-bold text-brand-dim">{formatCurrency(stage.value)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <h2 className="text-lg font-bold text-brand-text mb-5">Activity Heatmap</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-16" />
              {DAYS.map((day) => (
                <div key={day} className="flex-1 text-center text-xs text-brand-dim">{day}</div>
              ))}
            </div>
            {HEATMAP_DATA.map((week, wi) => (
              <div key={wi} className="flex items-center gap-2">
                <div className="w-16 text-xs text-brand-dim">{WEEKS[wi]}</div>
                {week.map((val, di) => {
                  const intensity = val / 9;
                  return (
                    <div
                      key={di}
                      className="flex-1 aspect-square rounded-lg cursor-pointer transition-transform hover:scale-110"
                      style={{
                        backgroundColor: val === 0 ? "#0A1628" : `rgba(0, 229, 255, ${0.1 + intensity * 0.6})`,
                      }}
                      title={`${WEEKS[wi]} ${DAYS[di]}: ${val} activities`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-xs text-brand-dim">Less</span>
            {[0.1, 0.25, 0.4, 0.55, 0.7].map((opacity, i) => (
              <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(0, 229, 255, ${opacity})` }} />
            ))}
            <span className="text-xs text-brand-dim">More</span>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
        <h2 className="text-lg font-bold text-brand-text mb-5">Top Performers - This Month</h2>
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Deals Won</th>
                <th>Revenue</th>
                <th>Calls Made</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {TOP_PERFORMERS.map((performer) => (
                <tr key={performer.rank}>
                  <td>
                    <span className={`w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-bold ${
                      performer.rank === 1 ? "bg-amber-500/10 text-amber-400" :
                      performer.rank === 2 ? "bg-brand-surface text-slate-400" :
                      performer.rank === 3 ? "bg-orange-500/10 text-orange-400" :
                      "bg-brand-surface text-brand-dim"
                    }`}>
                      {performer.rank}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                        {performer.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="font-semibold text-sm text-brand-text">{performer.name}</span>
                    </div>
                  </td>
                  <td><span className="text-sm font-semibold text-emerald-400">{performer.deals}</span></td>
                  <td><span className="text-sm">{performer.revenue}</span></td>
                  <td><span className="text-sm text-brand-dim">{performer.calls}</span></td>
                  <td>
                    <div className="w-full h-2 bg-brand-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
                        style={{ width: `${(performer.deals / 15) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source Analytics */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
        <h2 className="text-lg font-bold text-brand-text mb-5">Lead Source Performance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { source: "Website", leads: 312, converted: 45, rate: "14.4%", color: "bg-cyan-500" },
            { source: "Referral", leads: 189, converted: 42, rate: "22.2%", color: "bg-emerald-500" },
            { source: "MagicBricks", leads: 267, converted: 28, rate: "10.5%", color: "bg-blue-500" },
            { source: "Facebook Ads", leads: 198, converted: 22, rate: "11.1%", color: "bg-violet-500" },
          ].map((source) => (
            <div key={source.source} className="bg-brand-surface rounded-2xl p-4 border border-brand-border/50">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${source.color}`} />
                <span className="text-sm font-semibold text-brand-text">{source.source}</span>
              </div>
              <p className="text-2xl font-black text-brand-text">{source.leads}</p>
              <p className="text-xs text-brand-dim mt-1">leads generated</p>
              <div className="mt-3 pt-3 border-t border-brand-border/50 flex items-center justify-between">
                <span className="text-xs text-brand-dim">{source.converted} converted</span>
                <span className="text-xs font-semibold text-emerald-400">{source.rate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
