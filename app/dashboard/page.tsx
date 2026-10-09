"use client";

import Link from "next/link";
import {
  Target,
  TrendingUp,
  Users,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Calendar,
  Zap,
  MapPin,
  BarChart3,
} from "lucide-react";
import { stats, leads, tasks, pipeline, formatCurrency, statusColors, statusLabels, priorityColors } from "@/lib/mock-data";

const KPI_CARDS = [
  { label: "Total Leads", value: stats.totalLeads.toLocaleString(), change: "+12.5%", up: true, icon: Target, gradient: "from-cyan-500 to-blue-600", bg: "bg-cyan-50", iconColor: "text-cyan-600" },
  { label: "Active Deals", value: stats.activeLeads.toLocaleString(), change: "+8.3%", up: true, icon: TrendingUp, gradient: "from-blue-500 to-cyan-500", bg: "bg-blue-50", iconColor: "text-blue-600" },
  { label: "Won This Month", value: stats.wonDeals.toLocaleString(), change: "+23.1%", up: true, icon: CheckCircle2, gradient: "from-emerald-500 to-teal-500", bg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { label: "Revenue", value: formatCurrency(stats.revenue), change: "+18.7%", up: true, icon: BarChart3, gradient: "from-violet-500 to-pink-500", bg: "bg-violet-50", iconColor: "text-violet-600" },
];

const QUICK_ACTIONS = [
  { label: "Add Lead", href: "/dashboard/leads", icon: Target, color: "bg-cyan-50 text-cyan-600 border-cyan-500/20" },
  { label: "New Task", href: "/dashboard/tasks", icon: CheckCircle2, color: "bg-blue-50 text-blue-600 border-blue-500/20" },
  { label: "View Pipeline", href: "/dashboard/pipeline", icon: TrendingUp, color: "bg-violet-50 text-violet-600 border-violet-500/20" },
  { label: "Team Status", href: "/dashboard/team", icon: Users, color: "bg-emerald-50 text-emerald-600 border-emerald-500/20" },
];

export default function DashboardPage() {
  const recentLeads = leads.slice(0, 5);
  const upcomingTasks = tasks.filter((t) => t.status !== "done").slice(0, 4);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-text">Good morning, Arjun</h1>
          <p className="text-brand-dim text-sm mt-1">Here&apos;s your sales overview for today</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-500/20 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm text-emerald-600 font-semibold">Checked In</span>
          <span className="text-xs text-emerald-500">09:15 AM</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-2xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
              </div>
              <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${kpi.up ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.change}
              </div>
            </div>
            <p className="text-2xl font-black text-brand-text">{kpi.value}</p>
            <p className="text-xs text-brand-dim mt-1 font-medium">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.label} href={action.href} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${action.color} hover:shadow-soft transition-all`}>
            <action.icon className="w-5 h-5" />
            <span className="text-sm font-semibold">{action.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pipeline Summary */}
        <div className="lg:col-span-2 bg-brand-card rounded-2xl border border-brand-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-brand-text">Sales Pipeline</h2>
            <Link href="/dashboard/pipeline" className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-1.5 h-10 rounded-xl overflow-hidden mb-4">
            {pipeline.map((stage) => (
              <div key={stage.id} className="relative group cursor-pointer transition-all hover:opacity-80 rounded-sm" style={{ flex: stage.count, backgroundColor: stage.color + "30" }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold" style={{ color: stage.color }}>{stage.count}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {pipeline.map((stage) => (
              <div key={stage.id} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs text-brand-dim font-medium">{stage.label}</span>
                </div>
                <p className="text-sm font-bold text-brand-text">{stage.count}</p>
                <p className="text-[10px] text-brand-muted">{formatCurrency(stage.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Status */}
        <div className="bg-brand-card rounded-2xl border border-brand-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-brand-text">Team Status</h2>
            <Link href="/dashboard/team" className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1">
              View <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex items-center gap-4 mb-5">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1A2B45" strokeWidth="3" />
                <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#gradient)" strokeWidth="3" strokeDasharray={`${(stats.checkedIn / stats.teamSize) * 100}, 100`} strokeLinecap="round" />
                <defs><linearGradient id="gradient"><stop offset="0%" stopColor="#00E5FF" /><stop offset="100%" stopColor="#1976D2" /></linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-black text-brand-text">{stats.checkedIn}/{stats.teamSize}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-600">{stats.checkedIn} Checked In</p>
              <p className="text-xs text-brand-dim">{stats.teamSize - stats.checkedIn} not yet</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Total Calls Today", value: "121", icon: Phone, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Site Visits", value: "8", icon: MapPin, color: "text-amber-500", bg: "bg-amber-50" },
              { label: "Tasks Overdue", value: stats.tasksOverdue.toString(), icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 px-3 bg-brand-surface rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <span className="text-xs text-brand-dim font-medium">{item.label}</span>
                </div>
                <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-brand-card rounded-2xl border border-brand-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-brand-text">Recent Leads</h2>
            <Link href="/dashboard/leads" className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-brand-card-hover transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center text-xs font-bold text-cyan-600 shrink-0">
                  {lead.full_name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-brand-text truncate">{lead.full_name}</p>
                    {lead.starred && <Zap className="w-3 h-3 text-amber-500" />}
                  </div>
                  <p className="text-xs text-brand-dim truncate">{lead.project} &middot; {lead.source}</p>
                </div>
                <span className={`badge text-[10px] ${statusColors[lead.status]}`}>{statusLabels[lead.status]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-brand-card rounded-2xl border border-brand-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-brand-text">Upcoming Tasks</h2>
            <Link href="/dashboard/tasks" className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 py-3 px-3 rounded-xl hover:bg-brand-card-hover transition-colors cursor-pointer">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                  task.priority === "urgent" ? "bg-red-500" : task.priority === "high" ? "bg-orange-500" : task.priority === "medium" ? "bg-amber-500" : "bg-blue-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-text">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-brand-dim flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(task.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    {task.lead_name && <span className="text-xs text-brand-dim">&middot; {task.lead_name}</span>}
                  </div>
                </div>
                <span className={`badge text-[10px] ${priorityColors[task.priority]}`}>{task.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-brand-card rounded-2xl border border-brand-border p-5 shadow-soft">
        <h2 className="text-lg font-bold text-brand-text mb-5">Today&apos;s Activity</h2>
        <div className="space-y-4">
          {[
            { time: "11:30 AM", text: "Called Rajesh Kumar - Discussed 3BHK options", icon: Phone, color: "text-blue-600", bg: "bg-blue-50" },
            { time: "10:45 AM", text: "Priya Sharma moved to Site Visit stage", icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50" },
            { time: "10:15 AM", text: "New lead assigned: Amit Verma from MagicBricks", icon: Target, color: "text-cyan-600", bg: "bg-cyan-50" },
            { time: "09:50 AM", text: "Negotiation call with Sneha Reddy - 420 seconds", icon: Phone, color: "text-emerald-600", bg: "bg-emerald-50" },
            { time: "09:15 AM", text: "Checked in at Prestige Lakeside Office", icon: MapPin, color: "text-amber-500", bg: "bg-amber-50" },
          ].map((activity, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl ${activity.bg} flex items-center justify-center shrink-0`}>
                <activity.icon className={`w-4 h-4 ${activity.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-brand-body">{activity.text}</p>
                <p className="text-xs text-brand-muted mt-0.5">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
