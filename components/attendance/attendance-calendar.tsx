"use client"

import { useMemo } from "react"
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  isToday,
  isSameMonth,
  isSaturday,
  isSunday,
} from "date-fns"
import { cn } from "@/lib/utils"
import type { Attendance } from "@/types"

interface AttendanceCalendarProps {
  records: Attendance[]
  month: Date
}

const statusConfig: Record<string, { cell: string; badge: string; text: string; label: string }> = {
  present:  { cell: "bg-emerald-50/80 border-emerald-200", badge: "bg-emerald-500", text: "text-emerald-700", label: "Present" },
  late:     { cell: "bg-amber-50/80 border-amber-200",     badge: "bg-amber-500",   text: "text-amber-700",   label: "Late" },
  half_day: { cell: "bg-sky-50/80 border-sky-200",         badge: "bg-sky-500",      text: "text-sky-700",     label: "Half day" },
  absent:   { cell: "bg-red-50/80 border-red-200",         badge: "bg-red-500",      text: "text-red-700",     label: "Absent" },
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function AttendanceCalendar({ records, month }: AttendanceCalendarProps) {
  const attendanceMap = useMemo(() => {
    const map: Record<string, Attendance> = {}
    records.forEach((r) => {
      map[r.date] = r
    })
    return map
  }, [records])

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  })

  const startDay = getDay(startOfMonth(month))

  // Stats summary
  const stats = useMemo(() => {
    let present = 0, late = 0, halfDay = 0, absent = 0
    records.forEach((r) => {
      if (r.status === "present") present++
      else if (r.status === "late") late++
      else if (r.status === "half_day") halfDay++
      else if (r.status === "absent") absent++
    })
    return { present, late, halfDay, absent }
  }, [records])

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Present", count: stats.present, color: "bg-emerald-500" },
          { label: "Late", count: stats.late, color: "bg-amber-500" },
          { label: "Half day", count: stats.halfDay, color: "bg-sky-500" },
          { label: "Absent", count: stats.absent, color: "bg-red-500" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5">
            <span className={cn("h-3 w-3 rounded-full shrink-0", s.color)} />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight tabular-nums">{s.count}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border/50 mb-0">
        {DAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "text-center text-[11px] font-semibold uppercase tracking-wider py-3",
              i === 0 ? "text-red-400" : "text-muted-foreground/70"
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells for offset */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="border-b border-r border-border/30 min-h-[72px]" />
        ))}

        {days.map((day, idx) => {
          const dateStr = format(day, "yyyy-MM-dd")
          const record = attendanceMap[dateStr]
          const sunday = isSunday(day)
          const saturday = isSaturday(day)
          const weekend = sunday || saturday
          const cfg = record ? statusConfig[record.status] : null
          const colIdx = (startDay + idx) % 7

          return (
            <div
              key={dateStr}
              className={cn(
                "relative min-h-[72px] border-b border-r border-border/30 p-1.5 transition-colors duration-150",
                colIdx === 0 && "border-l-0",
                colIdx === 6 && "border-r-0",
                weekend && !record && "bg-muted/20",
                isToday(day) && "bg-primary/[0.04]"
              )}
            >
              {/* Date number */}
              <div className="flex items-start justify-between mb-1">
                <span
                  className={cn(
                    "inline-flex items-center justify-center h-7 w-7 rounded-full text-[13px] font-medium",
                    isToday(day) && "bg-primary text-primary-foreground font-bold",
                    sunday && !isToday(day) && "text-red-400",
                    !sunday && !isToday(day) && "text-foreground/80"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Status badge */}
              {cfg && (
                <div className={cn(
                  "rounded-md border px-1.5 py-1 text-center",
                  cfg.cell
                )}>
                  <p className={cn("text-[10px] font-semibold leading-none", cfg.text)}>
                    {record!.work_hours ? `${record!.work_hours}h` : cfg.label}
                  </p>
                  <p className={cn("text-[9px] mt-0.5 leading-none opacity-70", cfg.text)}>
                    {statusConfig[record!.status].label}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
