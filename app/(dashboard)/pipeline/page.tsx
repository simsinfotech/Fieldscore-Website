"use client";

import { useState } from "react";
import {
  ChevronDown,
  TrendingUp,
  IndianRupee,
  ArrowUpRight,
  Filter,
  BarChart3,
} from "lucide-react";
import { pipeline, leads, formatCurrency, statusColors, statusLabels, type LeadStatus } from "@/lib/mock-data";

const TIME_FILTERS = ["This Month", "Last Month", "This Quarter", "All Time"];

export default function PipelinePage() {
  const [timeFilter, setTimeFilter] = useState("This Month");
  const totalValue = pipeline.reduce((sum, s) => sum + s.value, 0);
  const totalCount = pipeline.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Sales Pipeline</h1>
          <p className="text-brand-dim text-sm mt-1">Track deals across every stage</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="input-field appearance-none !pr-10 cursor-pointer !py-2.5 text-sm min-w-[160px]"
            >
              {TIME_FILTERS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <p className="text-xs text-brand-dim mb-1">Total Pipeline Value</p>
          <p className="text-2xl font-black gradient-text">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1"><ArrowUpRight className="w-3 h-3" /> +15.3% vs last month</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <p className="text-xs text-brand-dim mb-1">Total Deals</p>
          <p className="text-2xl font-black text-brand-text">{totalCount}</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1"><ArrowUpRight className="w-3 h-3" /> +8 new this week</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <p className="text-xs text-brand-dim mb-1">Conversion Rate</p>
          <p className="text-2xl font-black text-cyan-400">18.4%</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1"><ArrowUpRight className="w-3 h-3" /> +2.1% vs last month</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <p className="text-xs text-brand-dim mb-1">Avg. Deal Size</p>
          <p className="text-2xl font-black text-brand-text">{formatCurrency(63433)}</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1"><ArrowUpRight className="w-3 h-3" /> +5.7% growth</p>
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-soft">
        <h2 className="text-lg font-bold text-brand-text mb-6">Pipeline Stages</h2>

        {/* Horizontal bar */}
        <div className="flex gap-1 h-12 rounded-xl overflow-hidden mb-6">
          {pipeline.map((stage) => (
            <div
              key={stage.id}
              className="relative group cursor-pointer transition-all hover:opacity-90"
              style={{ flex: stage.count, backgroundColor: stage.color + "40" }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{stage.count}</span>
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-brand-card border border-brand-border rounded-xl text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-elevated">
                <p className="font-bold text-brand-text">{stage.label}</p>
                <p className="text-brand-dim">{stage.count} deals &middot; {formatCurrency(stage.value)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stage Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {pipeline.map((stage) => (
            <div key={stage.id} className="bg-brand-surface rounded-2xl p-4 border border-brand-border/50 hover:border-brand-border transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-sm font-semibold text-brand-text">{stage.label}</span>
              </div>
              <p className="text-2xl font-black" style={{ color: stage.color }}>{stage.count}</p>
              <p className="text-xs text-brand-dim mt-1 flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> {formatCurrency(stage.value)}
              </p>
              <div className="mt-3 h-1.5 bg-brand-bg rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(stage.count / totalCount) * 100}%`, backgroundColor: stage.color }}
                />
              </div>
              <p className="text-[10px] text-brand-dim mt-1">{((stage.count / totalCount) * 100).toFixed(1)}% of total</p>
            </div>
          ))}
        </div>
      </div>

      {/* Deals by Stage */}
      <div className="grid lg:grid-cols-3 gap-4">
        {pipeline.filter(s => s.id !== "won" && s.id !== "lost").map((stage) => {
          const stageLeads = leads.filter((l) => l.status === stage.id);
          return (
            <div key={stage.id} className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <h3 className="font-bold text-sm text-brand-text">{stage.label}</h3>
                </div>
                <span className="text-xs text-brand-dim">{stageLeads.length} leads</span>
              </div>
              <div className="space-y-2.5">
                {stageLeads.length > 0 ? stageLeads.map((lead) => (
                  <div key={lead.id} className="bg-brand-surface rounded-xl p-3 border border-brand-border/50 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-brand-text">{lead.full_name}</p>
                      <span className={`badge text-[10px] ${
                        lead.category === "hot" ? "bg-red-500/10 text-red-400" :
                        lead.category === "warm" ? "bg-amber-500/10 text-amber-400" :
                        "bg-blue-500/10 text-blue-400"
                      }`}>{lead.category}</span>
                    </div>
                    <p className="text-xs text-brand-dim mt-1">{lead.project}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-brand-dim flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" /> {formatCurrency(lead.budget_min)} - {formatCurrency(lead.budget_max)}
                      </span>
                      <span className="text-[10px] text-brand-dim">{lead.last_activity}</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-brand-dim text-center py-4">No leads in this stage</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
