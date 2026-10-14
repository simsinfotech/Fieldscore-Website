"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { GlassCard } from "@/components/shared/glass-card"
import { AttendanceTable } from "@/components/attendance/attendance-table"
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar"
import { GpsMap } from "@/components/attendance/gps-map"
import { TeamActivity } from "@/components/attendance/team-activity"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TbChevronLeft,
  TbChevronRight,
  TbCalendarEvent,
  TbTable,
  TbMapPin,
  TbClock,
  TbUserCheck,
  TbUserX,
  TbAlertTriangle,
  TbClockPlay,
  TbClipboardList,
  TbDownload,
  TbActivityHeartbeat,
} from "react-icons/tb"
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns"
import type { Attendance, Employee } from "@/types"

export default function AttendancePage() {
  const { employee, isAdmin } = useUser()
  const orgId = useOrg()
  const supabase = createClient()

  const [records, setRecords] = useState<Attendance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")
  const [month, setMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employee) return

    if (isAdmin) {
      fetchEmployees()
    }
    fetchAttendance()
  }, [employee?.id, orgId, month, selectedEmployee])

  async function fetchEmployees() {
    const { data } = await supabase
      .from("fs_employees")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
    if (data) setEmployees(data)
  }

  async function fetchAttendance() {
    setLoading(true)
    const from = format(startOfMonth(month), "yyyy-MM-dd")
    const to = format(endOfMonth(month), "yyyy-MM-dd")

    let query = supabase
      .from("fs_attendance")
      .select("*, employee:fs_employees(*)")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })

    if (!isAdmin) {
      query = query.eq("employee_id", employee!.id)
    } else if (selectedEmployee !== "all") {
      query = query.eq("employee_id", selectedEmployee)
    }

    const { data } = await query
    if (data) {
      const filtered = isAdmin
        ? data.filter((a: any) => a.employee?.org_id === orgId)
        : data
      setRecords(filtered as unknown as Attendance[])
    }
    setLoading(false)
  }

  const mapPoints = records
    .filter((r) => r.check_in_lat && r.check_in_lng)
    .map((r) => ({
      lat: r.check_in_lat!,
      lng: r.check_in_lng!,
      label: r.employee?.full_name ?? "You",
      time: format(new Date(r.check_in), "MMM d, hh:mm a"),
    }))

  function exportCSV() {
    if (records.length === 0) return
    const headers = ["Date", "Employee", "Check In", "Check Out", "Status", "Working Hours"]
    const rows = records.map((r) => [
      r.date,
      r.employee?.full_name ?? "—",
      r.check_in ? format(new Date(r.check_in), "hh:mm a") : "—",
      r.check_out ? format(new Date(r.check_out), "hh:mm a") : "—",
      r.status,
      r.work_hours?.toFixed(1) ?? "—",
    ])
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-${format(month, "yyyy-MM")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* Stats */
  const stats = {
    present: records.filter((r) => r.status === "present").length,
    late: records.filter((r) => r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
    halfDay: records.filter((r) => r.status === "half_day").length,
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00BCD4] text-white border border-border">
            <TbClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
            <p className="text-sm text-muted-foreground">Track attendance and locations</p>
          </div>
        </div>

        {/* Month nav + Employee filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month picker pills */}
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary p-1 backdrop-blur-sm">
            <button
              onClick={() => setMonth(subMonths(month, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <TbChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] px-2 text-center text-sm font-semibold">
              {format(month, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setMonth(addMonths(month, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <TbChevronRight className="h-4 w-4" />
            </button>
          </div>

          {isAdmin && (
            <Select value={selectedEmployee} onValueChange={(v) => v !== null && setSelectedEmployee(v)}>
              <SelectTrigger className="w-full sm:w-[200px] rounded-full border border-border bg-secondary backdrop-blur-sm">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            onClick={exportCSV}
            disabled={records.length === 0}
            className="rounded-full border border-border bg-secondary hover:bg-secondary"
          >
            <TbDownload className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<TbUserCheck className="h-4 w-4" />} label="Present" value={stats.present} color="emerald" />
        <StatCard icon={<TbClockPlay className="h-4 w-4" />} label="Late" value={stats.late} color="orange" />
        <StatCard icon={<TbUserX className="h-4 w-4" />} label="Absent" value={stats.absent} color="red" />
        <StatCard icon={<TbAlertTriangle className="h-4 w-4" />} label="Half Day" value={stats.halfDay} color="amber" />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="table">
        <TabsList className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-secondary p-1 backdrop-blur-sm">
          <TabsTrigger
            value="table"
            className="gap-1.5 rounded-full px-4 text-xs data-active:bg-[#00BCD4] data-active:text-white data-active:shadow-none"
          >
            <TbTable className="h-3.5 w-3.5" />
            Table
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="gap-1.5 rounded-full px-4 text-xs data-active:bg-[#00BCD4] data-active:text-white data-active:shadow-none"
          >
            <TbCalendarEvent className="h-3.5 w-3.5" />
            Calendar
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="map"
              className="gap-1.5 rounded-full px-4 text-xs data-active:bg-[#00BCD4] data-active:text-white data-active:shadow-none"
            >
              <TbMapPin className="h-3.5 w-3.5" />
              Map
            </TabsTrigger>
          )}
          {(isAdmin || employee?.role === "manager") && (
            <TabsTrigger
              value="activity"
              className="gap-1.5 rounded-full px-4 text-xs data-active:bg-[#00BCD4] data-active:text-white data-active:shadow-none"
            >
              <TbActivityHeartbeat className="h-3.5 w-3.5" />
              Team Activity
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="table" className="mt-4">
          {loading ? (
            <LoadingSkeleton />
          ) : records.length === 0 ? (
            <EmptyState />
          ) : (
            <GlassCard className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <AttendanceTable records={records} showEmployee={isAdmin} />
              </div>
            </GlassCard>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <GlassCard className="border border-border">
            <AttendanceCalendar records={records} month={month} />
          </GlassCard>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="map" className="mt-4">
            {mapPoints.length === 0 ? (
              <EmptyState message="No location data for this period" />
            ) : (
              <GlassCard className="p-0 overflow-hidden rounded-2xl border border-border">
                <GpsMap points={mapPoints} height="500px" />
              </GlassCard>
            )}
          </TabsContent>
        )}

        {(isAdmin || employee?.role === "manager") && (
          <TabsContent value="activity" className="mt-4">
            <TeamActivity />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: "emerald" | "orange" | "red" | "amber"
}) {
  const palette = {
    emerald: {
      icon: "bg-[#00BCD4] text-white",
    },
    orange: {
      icon: "bg-[#DBEAFE] text-[#0F172A]",
    },
    red: {
      icon: "bg-destructive/15 text-destructive",
    },
    amber: {
      icon: "bg-[#EDE9FE] text-[#0F172A]",
    },
  }
  const c = palette[color]

  return (
    <div
      className="group relative overflow-hidden rounded-3xl border border-border bg-[#0D1B2A] p-4 shadow-soft backdrop-blur-sm transition-all hover:scale-[1.02]"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${c.icon}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Empty State ── */
function EmptyState({ message }: { message?: string }) {
  return (
    <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00BCD4] text-white border border-border mb-4">
        <TbClock className="h-7 w-7 text-[#0F172A]" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No records found</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {message ?? "There are no attendance records for the selected period. Adjust the month or employee filter."}
      </p>
    </GlassCard>
  )
}

/* ── Loading Skeleton ── */
function LoadingSkeleton() {
  return (
    <GlassCard className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-9 w-9 animate-pulse rounded-full bg-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded-md bg-secondary" />
            <div className="h-2 w-1/4 animate-pulse rounded-md bg-secondary" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-secondary" />
        </div>
      ))}
    </GlassCard>
  )
}
