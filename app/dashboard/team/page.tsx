"use client";

import { useState } from "react";
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Clock,
  Target,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Plus,
  Filter,
  Users,
} from "lucide-react";
import { teamMembers } from "@/lib/mock-data";

export default function TeamPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "checked_in" | "not_checked_in">("all");

  const filteredMembers = teamMembers.filter((m) => {
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus === "checked_in" && !m.checked_in) return false;
    if (filterStatus === "not_checked_in" && m.checked_in) return false;
    return true;
  });

  const checkedInCount = teamMembers.filter((m) => m.checked_in).length;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Team</h1>
          <p className="text-brand-dim text-sm mt-1">{teamMembers.length} members &middot; {checkedInCount} checked in</p>
        </div>
        <button className="btn-primary flex items-center gap-2 !py-2.5 rounded-xl text-sm">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-brand-dim">Total Members</span>
          </div>
          <p className="text-2xl font-black text-brand-text">{teamMembers.length}</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-brand-dim">Checked In</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">{checkedInCount}</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-brand-dim">Total Leads</span>
          </div>
          <p className="text-2xl font-black text-brand-text">{teamMembers.reduce((s, m) => s + m.leads_count, 0)}</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-brand-dim">Deals Won</span>
          </div>
          <p className="text-2xl font-black text-violet-400">{teamMembers.reduce((s, m) => s + m.deals_won, 0)}</p>
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
            placeholder="Search team members..."
            className="input-field !pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "checked_in", "not_checked_in"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                filterStatus === status ? "bg-brand-card text-brand-text border border-brand-border shadow-soft" : "text-brand-dim hover:text-brand-text"
              }`}
            >
              {status === "all" ? "All" : status === "checked_in" ? "Checked In" : "Not Checked In"}
            </button>
          ))}
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMembers.map((member) => (
          <div key={member.id} className="bg-brand-card border border-brand-border rounded-2xl p-5 hover:border-cyan-500/20 transition-colors shadow-soft hover:shadow-card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    {member.avatar_initial}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-brand-card ${member.checked_in ? "bg-emerald-500" : "bg-slate-600"}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-brand-text">{member.name}</p>
                  <p className="text-xs text-brand-dim">{member.role}</p>
                </div>
              </div>
              <button className="text-brand-dim hover:text-brand-text p-1 rounded">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {member.checked_in ? (
              <div className="flex items-center gap-2 mb-4 px-2.5 py-1.5 bg-emerald-500/10 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Checked in at {member.check_in_time}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-4 px-2.5 py-1.5 bg-brand-surface rounded-xl">
                <XCircle className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-400">Not checked in</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="text-center py-2 bg-brand-surface rounded-xl">
                <p className="text-lg font-bold text-cyan-400">{member.leads_count}</p>
                <p className="text-[10px] text-brand-dim">Leads</p>
              </div>
              <div className="text-center py-2 bg-brand-surface rounded-xl">
                <p className="text-lg font-bold text-emerald-400">{member.deals_won}</p>
                <p className="text-[10px] text-brand-dim">Won</p>
              </div>
              <div className="text-center py-2 bg-brand-surface rounded-xl">
                <p className="text-lg font-bold text-blue-400">{member.calls_today}</p>
                <p className="text-[10px] text-brand-dim">Calls</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button className="flex-1 btn-secondary flex items-center justify-center gap-1.5 !py-2 rounded-xl text-xs">
                <Phone className="w-3 h-3" /> Call
              </button>
              <button className="flex-1 btn-secondary flex items-center justify-center gap-1.5 !py-2 rounded-xl text-xs">
                <Mail className="w-3 h-3" /> Email
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
