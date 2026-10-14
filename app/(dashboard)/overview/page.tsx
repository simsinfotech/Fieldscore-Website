"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { GpsMap } from "@/components/attendance/gps-map"
import { ActivityHeatmapStrip } from "@/components/attendance/activity-heatmap"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  TbUsers,
  TbClock,
  TbCalendarOff,
  TbCreditCard,
  TbSpeakerphone,
  TbMapPin,
  TbPin,
  TbTrendingUp,
  TbUserCheck,
  TbAlertCircle,
  TbCoffee,
  TbLoader2,
  TbActivityHeartbeat,
  TbClockPlay,
  TbClockPause,
} from "react-icons/tb"
import { format } from "date-fns"
import type { Attendance, Employee, Announcement } from "@/types"

export default function OverviewPage() {
  const { employee } = useUser()
  const orgId = useOrg()
  const supabase = createClient()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayAttendance, setTodayAttendance] = useState<(Attendance & { employee: Employee })[]>([])
  const [pendingLeaves, setPendingLeaves] = useState(0)
  const [payrollSummary, setPayrollSummary] = useState({ total: 0, paid: 0 })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedCheckin, setSelectedCheckin] = useState<(Attendance & { employee: Employee }) | null>(null)

  const today = format(new Date(), "yyyy-MM-dd")

  useEffect(() => {
    if (!employee) return
    fetchAll()

    // Realtime for attendance
    const channel = supabase
      .channel("admin-attendance")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fs_attendance",
        },
        () => {
          fetchAttendance()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [employee?.id, orgId])

  async function fetchAll() {
    await Promise.all([
      fetchEmployees(),
      fetchAttendance(),
      fetchLeaves(),
      fetchPayroll(),
      fetchAnnouncements(),
    ])
  }

  async function fetchEmployees() {
    const { data, error } = await supabase
      .from("fs_employees")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
    if (error) console.error("fetchEmployees error:", error)
    if (data) setEmployees(data)
  }

  async function fetchAttendance() {
    const { data, error } = await supabase
      .from("fs_attendance")
      .select("*, employee:fs_employees(*)")
      .eq("date", today)
      .order("check_in", { ascending: false })
    if (error) console.error("fetchAttendance error:", error)
    if (data) {
      // Filter by org and only active employees
      const filtered = data.filter((a: any) => a.employee?.org_id === orgId && a.employee?.is_active !== false)
      setTodayAttendance(filtered as any)
    }
  }

  async function fetchLeaves() {
    const { data, error } = await supabase
      .from("fs_leave_requests")
      .select("employee_id, status, employee:fs_employees!employee_id(org_id)")
      .eq("status", "pending")
    if (error) console.error("fetchLeaves error:", error)
    const filtered = (data ?? []).filter((r: any) => r.employee?.org_id === orgId)
    setPendingLeaves(filtered.length)
  }

  async function fetchPayroll() {
    const month = new Date().getMonth() + 1
    const year = new Date().getFullYear()
    const { data, error } = await supabase
      .from("fs_payroll")
      .select("status, net_salary, employee:fs_employees(org_id)")
      .eq("month", month)
      .eq("year", year)
    if (error) console.error("fetchPayroll error:", error)
    if (data) {
      const filtered = data.filter((p: any) => p.employee?.org_id === orgId)
      setPayrollSummary({
        total: filtered.length,
        paid: filtered.filter((p: any) => p.status === "paid").length,
      })
    }
  }

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from("fs_announcements")
      .select("*")
      .eq("org_id", orgId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5)
    if (data) setAnnouncements(data)
  }

  const checkedInCount = todayAttendance.length
  const mapPoints = todayAttendance
    .filter((a) => a.check_in_lat && a.check_in_lng)
    .map((a) => ({
      lat: a.check_in_lat!,
      lng: a.check_in_lng!,
      label: a.employee?.full_name ?? "Unknown",
      time: format(new Date(a.check_in), "hh:mm a"),
    }))

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Overview"
        description={`Dashboard for ${orgId === "ORG-001" ? "SimsInfotech" : "Estate Hive"}`}
      />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={TbUsers}
          label="Team Headcount"
          value={employees.length}
          subtitle="Active employees"
          iconBg="bg-[#00BCD4] text-white"
          href="/team"
        />
        <StatCard
          icon={TbUserCheck}
          label="Checked-In Today"
          value={checkedInCount}
          subtitle={employees.length > 0 ? `${Math.round((checkedInCount / employees.length) * 100)}% of team` : "No employees"}
          iconBg="bg-[#00BCD4]/10 text-[#F1F5F9]"
          href="/attendance"
        />
        <StatCard
          icon={TbCalendarOff}
          label="Pending Leaves"
          value={pendingLeaves}
          subtitle="Awaiting approval"
          iconBg="bg-[#7C4DFF]/10 text-[#F1F5F9]"
          href="/leave"
        />
        <StatCard
          icon={TbCreditCard}
          label="Payroll Status"
          value={`${payrollSummary.paid}/${payrollSummary.total}`}
          subtitle="Processed this month"
          iconBg="bg-[#1A2B45] text-white"
          href="/payroll"
        />
      </div>

      {/* ── Today's Check-ins + Map ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Check-ins List */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#00BCD4] text-white flex items-center justify-center border border-border">
                  <TbClock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Today&apos;s Check-ins</h3>
                  <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
                </div>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {checkedInCount} total
              </Badge>
            </div>
          </div>

          <div className="overflow-auto max-h-[400px] px-3 py-2">
            {todayAttendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-[#0A1628] flex items-center justify-center mb-4">
                  <TbCoffee className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium">No check-ins yet today</p>
                <p className="text-xs mt-1 text-muted-foreground/70">Employees will appear here when they check in</p>
              </div>
            ) : (
              <div className="space-y-1">
                {todayAttendance.map((a) => {
                  const initials = (a.employee?.full_name ?? "?")
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()

                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedCheckin(a)}
                      className="group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-[#0A1628] cursor-pointer"
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#1A2B45] flex items-center justify-center text-white text-xs font-semibold border border-border">
                          {initials}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-border ${
                          a.status === "present" ? "bg-[#00BCD4]" :
                          a.status === "late" ? "bg-[#7C4DFF]/10" :
                          a.status === "half_day" ? "bg-[#7C4DFF]/10" : "bg-destructive"
                        }`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.employee?.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <TbClock className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(a.check_in), "hh:mm a")}
                          </span>
                          {a.check_in_address && (
                            <>
                              <span className="text-muted-foreground/30">|</span>
                              <TbMapPin className="h-3 w-3 text-muted-foreground/60" />
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {a.check_in_address}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <StatusBadge status={a.status} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Map */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-2xl bg-[#00BCD4] text-white flex items-center justify-center border border-border">
                <TbMapPin className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Field Locations</h3>
                <p className="text-xs text-muted-foreground">{mapPoints.length} active locations</p>
              </div>
            </div>
          </div>
          <GpsMap points={mapPoints} height="370px" />
        </GlassCard>
      </div>

      {/* ── Employee Detail Dialog ── */}
      <EmployeeActivityDialog
        attendance={selectedCheckin}
        onClose={() => setSelectedCheckin(null)}
      />

      {/* ── Announcements ── */}
      {announcements.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-2xl bg-[#1A2B45] text-white flex items-center justify-center border border-border">
              <TbSpeakerphone className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold">Announcements</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {announcements.map((a) => {
              const borderColor = "border-l-border"

              const priorityDot =
                a.priority === "urgent"
                  ? "bg-destructive"
                  : a.priority === "normal"
                  ? "bg-[#00BCD4]"
                  : "bg-[#34D399]"

              return (
                <GlassCard
                  key={a.id}
                  className={`border border-border border-l-[3px] ${borderColor} transition-all duration-200 hover:translate-y-[-2px]`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {a.is_pinned && (
                        <TbPin className="h-3.5 w-3.5 text-[#F1F5F9] shrink-0 fill-[#00BCD4]" />
                      )}
                      <h4 className="text-sm font-semibold truncate">{a.title}</h4>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${priorityDot}`} />
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {a.priority}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {a.content}
                  </p>
                  {a.created_at && (
                    <p className="text-[10px] text-muted-foreground/50 mt-3">
                      {format(new Date(a.created_at), "MMM d, yyyy")}
                    </p>
                  )}
                </GlassCard>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  iconBg,
  href,
}: {
  icon: any
  label: string
  value: number | string
  subtitle: string
  iconBg: string
  href?: string
}) {
  const inner = (
    <GlassCard className="group relative overflow-hidden rounded-3xl border border-border shadow-soft transition-all duration-300 hover:translate-y-[-3px] cursor-default">
      <div className="relative flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">{subtitle}</p>
        </div>
      </div>
    </GlassCard>
  )

  if (href) {
    return <a href={href} className="block">{inner}</a>
  }
  return inner
}

/* ── Employee Activity Dialog ── */
function EmployeeActivityDialog({
  attendance,
  onClose,
}: {
  attendance: (Attendance & { employee: Employee }) | null
  onClose: () => void
}) {
  const [buckets, setBuckets] = useState<string[]>([])
  const [sessions, setSessions] = useState<{ id: string; started_at: string; ended_at?: string; end_reason?: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [, setTick] = useState(0)

  const fetchActivity = useCallback(
    async (showLoader: boolean) => {
      if (!attendance) return
      if (showLoader) setLoading(true)
      try {
        const today = format(new Date(), "yyyy-MM-dd")
        const res = await fetch(
          `/api/attendance/activity?employeeId=${attendance.employee_id}&date=${today}`
        )
        const data = await res.json()
        setBuckets(data.buckets ?? [])
        setSessions(data.sessions ?? [])
      } catch {
        setBuckets([])
        setSessions([])
      } finally {
        if (showLoader) setLoading(false)
      }
    },
    [attendance?.employee_id]
  )

  // Initial fetch + poll every 30s while the dialog is open
  useEffect(() => {
    if (!attendance) {
      setBuckets([])
      setSessions([])
      return
    }
    fetchActivity(true)
    const id = setInterval(() => fetchActivity(false), 30_000)
    return () => clearInterval(id)
  }, [attendance?.id, fetchActivity])

  // Tick every second while the employee has an open session so
  // "Working hours" and "Idle Time" update in real time.
  const isStillActive = !!attendance && !attendance.check_out
  useEffect(() => {
    if (!isStillActive) return
    const id = setInterval(() => setTick((t) => t + 1), 1_000)
    return () => clearInterval(id)
  }, [isStillActive])

  if (!attendance) return null

  const emp = attendance.employee
  const totalSessions = sessions.length

  // Working hours = total checked-in time (check-in to check-out/now)
  const checkInTime = new Date(attendance.check_in).getTime()
  const endTime = attendance.check_out
    ? new Date(attendance.check_out).getTime()
    : Date.now()
  const workedMinutes = Math.max(0, Math.round((endTime - checkInTime) / 60000))

  // Idle = total span minus active buckets (each bucket = 1 min of activity)
  const activeBucketCount = buckets.length
  const idleMinutes = Math.max(0, workedMinutes - activeBucketCount)

  // "Last active" — derived from the most recent activity bucket
  let lastActiveLabel = ""
  if (buckets.length > 0) {
    const lastBucket = new Date(buckets[buckets.length - 1]).getTime()
    const minsAgo = Math.floor((Date.now() - lastBucket) / 60_000)
    if (minsAgo < 2) lastActiveLabel = "Active just now"
    else if (minsAgo < 60) lastActiveLabel = `Last active ${minsAgo}m ago`
    else {
      const h = Math.floor(minsAgo / 60)
      const m = minsAgo % 60
      lastActiveLabel = `Last active ${h}h ${m}m ago`
    }
  }

  return (
    <Dialog open={!!attendance} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1A2B45] flex items-center justify-center text-white text-xs font-semibold border border-border">
              {(emp?.full_name ?? "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <DialogTitle>{emp?.full_name}</DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{emp?.designation}</span>
                <StatusBadge status={attendance.status} />
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <TbLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            {/* Check-in / Check-out */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TbClockPlay className="h-3.5 w-3.5 text-[#00E5FF]" />
                  <span className="text-[11px] font-medium text-muted-foreground">Check-in</span>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {format(new Date(attendance.check_in), "hh:mm a")}
                </p>
                {attendance.check_in_address && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                    <TbMapPin className="inline h-3 w-3 mr-0.5" />
                    {attendance.check_in_address}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TbClockPause className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground">Check-out</span>
                </div>
                {attendance.check_out ? (
                  <>
                    <p className="text-sm font-semibold tabular-nums">
                      {format(new Date(attendance.check_out), "hh:mm a")}
                    </p>
                    {attendance.check_out_address && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                        <TbMapPin className="inline h-3 w-3 mr-0.5" />
                        {attendance.check_out_address}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-medium text-[#00E5FF]">Active</p>
                )}
              </div>
            </div>

            {/* Working hours + Idle Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-lg font-semibold tabular-nums text-[#00E5FF]">{Math.floor(workedMinutes / 60)}h {workedMinutes % 60}m</p>
                <p className="text-[10px] text-muted-foreground">Working hours</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-lg font-semibold tabular-nums">{Math.floor(idleMinutes / 60)}h {idleMinutes % 60}m</p>
                <p className="text-[10px] text-muted-foreground">Idle Time</p>
                {lastActiveLabel && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{lastActiveLabel}</p>
                )}
              </div>
            </div>

            {/* Activity Heatmap */}
            {buckets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TbActivityHeartbeat className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Activity Heatmap</span>
                </div>
                <ActivityHeatmapStrip buckets={buckets} compact />
              </div>
            )}

            {/* Sessions */}
            {sessions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TbClock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Sessions</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{totalSessions} total</span>
                </div>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${!s.ended_at ? "bg-[#00BCD4] animate-pulse" : "bg-muted-foreground/30"}`} />
                        <span className="text-xs tabular-nums">
                          {format(new Date(s.started_at), "hh:mm a")}
                          {" → "}
                          {s.ended_at ? format(new Date(s.ended_at), "hh:mm a") : "now"}
                        </span>
                      </div>
                      {s.end_reason && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {s.end_reason.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    present: { bg: "bg-[#00BCD4]", text: "text-white", label: "Present" },
    late: { bg: "bg-[#7C4DFF]/10", text: "text-white", label: "Late" },
    half_day: { bg: "bg-[#7C4DFF]/10", text: "text-white", label: "Half Day" },
    absent: { bg: "bg-destructive/15", text: "text-destructive", label: "Absent" },
  }

  const c = config[status] ?? { bg: "bg-[#0A1628]", text: "text-foreground", label: status }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
