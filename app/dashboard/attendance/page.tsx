"use client";

import { useState } from "react";
import {
  Clock,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Timer,
  TrendingUp,
} from "lucide-react";
import { attendance } from "@/lib/mock-data";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  present: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Present" },
  late: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Late" },
  absent: { bg: "bg-red-500/10", text: "text-red-400", label: "Absent" },
  "half-day": { bg: "bg-blue-500/10", text: "text-blue-400", label: "Half Day" },
  leave: { bg: "bg-violet-500/10", text: "text-violet-400", label: "Leave" },
};

function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

export default function AttendancePage() {
  const [currentDate] = useState(new Date(2026, 9)); // October 2026
  const [checkedIn, setCheckedIn] = useState(true);
  const calendarDays = generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth());

  const totalPresent = attendance.filter((a) => a.status === "present").length;
  const totalLate = attendance.filter((a) => a.status === "late").length;
  const avgMinutes = Math.round(attendance.filter(a => a.active_minutes > 0).reduce((sum, a) => sum + a.active_minutes, 0) / attendance.filter(a => a.active_minutes > 0).length);

  // Map attendance data to calendar
  const attendanceMap: Record<number, typeof attendance[0]> = {};
  attendance.forEach((a) => {
    const day = new Date(a.date).getDate();
    attendanceMap[day] = a;
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Attendance</h1>
          <p className="text-brand-dim text-sm mt-1">Track your daily check-in and working hours</p>
        </div>
        <button
          onClick={() => setCheckedIn(!checkedIn)}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
            checkedIn
              ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15"
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${checkedIn ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          {checkedIn ? "Check Out" : "Check In"}
        </button>
      </div>

      {/* Current Session */}
      {checkedIn && (
        <div className="bg-brand-card border border-cyan-500/20 rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-400">Active Session</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-brand-dim mb-1">Check-in Time</p>
              <p className="text-lg font-bold text-brand-text">09:15 AM</p>
            </div>
            <div>
              <p className="text-xs text-brand-dim mb-1">Active Duration</p>
              <p className="text-lg font-bold text-cyan-400">5h 42m</p>
            </div>
            <div>
              <p className="text-xs text-brand-dim mb-1">Location</p>
              <p className="text-sm font-medium flex items-center gap-1"><MapPin className="w-3 h-3 text-cyan-400" /> Prestige Lakeside Office</p>
            </div>
            <div>
              <p className="text-xs text-brand-dim mb-1">Sessions Today</p>
              <p className="text-lg font-bold text-brand-text">1</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-brand-dim">Present Days</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">{totalPresent}</p>
          <p className="text-xs text-brand-dim mt-1">out of 10 working days</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-brand-dim">Late Marks</span>
          </div>
          <p className="text-2xl font-black text-amber-400">{totalLate}</p>
          <p className="text-xs text-brand-dim mt-1">after 9:30 AM threshold</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-brand-dim">Avg. Active Hours</span>
          </div>
          <p className="text-2xl font-black text-cyan-400">{Math.floor(avgMinutes / 60)}h {avgMinutes % 60}m</p>
          <p className="text-xs text-brand-dim mt-1">per working day</p>
        </div>
        <div className="stat-card bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-brand-dim">Attendance Rate</span>
          </div>
          <p className="text-2xl font-black text-violet-400">80%</p>
          <p className="text-xs text-brand-dim mt-1">this month</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-brand-text">
              {currentDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex items-center gap-2">
              <button className="p-1.5 text-brand-dim hover:text-brand-text hover:bg-brand-card-hover rounded-xl transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-brand-dim hover:text-brand-text hover:bg-brand-card-hover rounded-xl transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs text-brand-dim font-medium py-2">{day}</div>
            ))}
            {calendarDays.map((day, i) => {
              const record = day ? attendanceMap[day] : null;
              const isToday = day === 5;
              return (
                <div
                  key={i}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-colors cursor-pointer ${
                    !day ? "" :
                    isToday ? "bg-cyan-500/10 border border-cyan-500/20" :
                    record ? `${STATUS_STYLES[record.status]?.bg} hover:opacity-80` :
                    "hover:bg-brand-card-hover"
                  }`}
                >
                  {day && (
                    <>
                      <span className={`font-medium ${isToday ? "text-cyan-400" : record ? STATUS_STYLES[record.status]?.text : "text-brand-dim"}`}>
                        {day}
                      </span>
                      {record && record.active_minutes > 0 && (
                        <span className="text-[9px] text-brand-dim mt-0.5">
                          {Math.floor(record.active_minutes / 60)}h
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-brand-border/50">
            {Object.entries(STATUS_STYLES).map(([key, style]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${style.bg}`} />
                <span className="text-xs text-brand-dim">{style.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent History */}
        <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl p-5 shadow-soft">
          <h2 className="text-lg font-bold text-brand-text mb-4">Recent History</h2>
          <div className="space-y-3">
            {attendance.map((record, i) => {
              const style = STATUS_STYLES[record.status];
              return (
                <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-brand-card-hover transition-colors">
                  <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
                    {record.status === "present" ? <CheckCircle2 className={`w-5 h-5 ${style.text}`} /> :
                     record.status === "late" ? <AlertTriangle className={`w-5 h-5 ${style.text}`} /> :
                     record.status === "absent" ? <XCircle className={`w-5 h-5 ${style.text}`} /> :
                     <Clock className={`w-5 h-5 ${style.text}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-brand-text">
                        {new Date(record.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <span className={`badge text-[10px] ${style.bg} ${style.text}`}>{style.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-brand-dim">In: {record.check_in}</span>
                      <span className="text-xs text-brand-dim">Out: {record.check_out}</span>
                      {record.active_minutes > 0 && (
                        <span className="text-xs text-cyan-400">{Math.floor(record.active_minutes / 60)}h {record.active_minutes % 60}m</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
