"use client";

import { useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Play,
  Clock,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  Filter,
  ChevronDown,
} from "lucide-react";
import { calls, formatDuration } from "@/lib/mock-data";

const DIRECTION_STYLES = {
  inbound: { icon: PhoneIncoming, color: "text-blue-400", bg: "bg-blue-500/10", label: "Inbound" },
  outbound: { icon: PhoneOutgoing, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Outbound" },
  missed: { icon: PhoneMissed, color: "text-red-400", bg: "bg-red-500/10", label: "Missed" },
};

export default function CallsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "inbound" | "outbound" | "missed">("all");

  const filteredCalls = calls.filter((c) => {
    if (searchQuery && !c.lead_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (directionFilter !== "all" && c.direction !== directionFilter) return false;
    return true;
  });

  const totalCalls = calls.length;
  const totalDuration = calls.reduce((s, c) => s + c.duration, 0);
  const avgDuration = Math.round(totalDuration / calls.filter(c => c.duration > 0).length);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Call Log</h1>
        <p className="text-brand-dim text-sm mt-1">Track and manage all calls</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-brand-dim">Total Calls</span>
          </div>
          <p className="text-2xl font-black text-brand-text">{totalCalls}</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1"><ArrowUpRight className="w-3 h-3" /> +12% today</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-brand-dim">Total Duration</span>
          </div>
          <p className="text-2xl font-black text-brand-text">{formatDuration(totalDuration)}</p>
          <p className="text-xs text-brand-dim mt-1">across all calls</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-brand-dim">Avg Duration</span>
          </div>
          <p className="text-2xl font-black text-brand-text">{formatDuration(avgDuration)}</p>
          <p className="text-xs text-brand-dim mt-1">per connected call</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-brand-dim">Connect Rate</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">{((calls.filter(c => c.duration > 0).length / totalCalls) * 100).toFixed(0)}%</p>
          <p className="text-xs text-brand-dim mt-1">calls connected</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by lead name..."
            className="input-field !pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "inbound", "outbound", "missed"] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setDirectionFilter(dir)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                directionFilter === dir ? "bg-brand-card text-brand-text border border-brand-border shadow-soft" : "text-brand-dim hover:text-brand-text"
              }`}
            >
              {dir === "all" ? "All" : dir.charAt(0).toUpperCase() + dir.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Call List */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-soft">
        <div className="divide-y divide-brand-border/50">
          {filteredCalls.map((call) => {
            const style = DIRECTION_STYLES[call.direction];
            const Icon = style.icon;
            return (
              <div key={call.id} className="flex items-center gap-4 px-5 py-4 hover:bg-brand-card-hover transition-colors cursor-pointer">
                <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${style.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-brand-text">{call.lead_name}</p>
                    <span className={`badge text-[10px] ${style.bg} ${style.color}`}>{style.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-brand-dim">{call.phone}</span>
                    {call.notes && <span className="text-xs text-brand-dim">&middot; {call.notes}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-brand-text">{call.duration > 0 ? formatDuration(call.duration) : "--"}</p>
                  <p className="text-xs text-brand-dim">{call.timestamp.split(" ").slice(1).join(" ")}</p>
                </div>
                {call.recording && (
                  <button className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/15 transition-colors shrink-0">
                    <Play className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
