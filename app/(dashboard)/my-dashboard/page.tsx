"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { CheckinCard } from "@/components/attendance/checkin-card"
import { ActivityStatusStrip } from "@/components/attendance/activity-status-strip"
import { ActivityHeatmap } from "@/components/attendance/activity-heatmap"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  TbCalendarOff,
  TbChecklist,
  TbSpeakerphone,
  TbLoader2,
  TbPin,
  TbCircleCheck,
  TbArrowRight,
  TbCircleDot,
} from "react-icons/tb"
import type { LeaveBalance, Task, Announcement } from "@/types"

export default function MyDashboardPage() {
  const { employee, isLoading: isUserLoading } = useUser()
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  const [leaveLoading, setLeaveLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!employee?.id) return

    let cancelled = false

    async function fetchData() {
      setLeaveLoading(true)

      const [lbRes, taskRes, annRes] = await Promise.all([
        supabase
          .from("fs_leave_balances")
          .select("*")
          .eq("employee_id", employee!.id)
          .eq("year", new Date().getFullYear())
          .maybeSingle(),
        supabase
          .from("fs_tasks")
          .select("*")
          .eq("employee_id", employee!.id)
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("fs_announcements")
          .select("*")
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(3),
      ])

      if (cancelled) return

      setLeaveBalance(lbRes.data ?? null)
      setLeaveLoading(false)
      if (taskRes.data) setTasks(taskRes.data)
      if (annRes.data) setAnnouncements(annRes.data)
    }

    fetchData()

    // Realtime: assigned tasks + announcements reflect live.
    const channel = supabase
      .channel(`dash-${employee.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fs_tasks", filter: `employee_id=eq.${employee.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "fs_announcements" }, () => fetchData())
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [employee?.id, supabase])

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="My Dashboard"
        description="Your daily attendance, tasks, and updates"
      />

      {/* ── Check-in Hero Card ── */}
      <CheckinCard />

      {/* ── Activity Status Strip ── */}
      <ActivityStatusStrip />

      {/* ── Activity Heatmap ── */}
      <ActivityHeatmap />

      {/* ── Quick Stats Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Leave Balance */}
        <GlassCard className="group transition-all duration-300 hover:translate-y-[-2px] overflow-hidden relative">
          <div className="relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center border border-border">
                <TbCalendarOff className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">Leave Balance</p>
                <p className="text-[11px] text-muted-foreground/70">
                  {new Date().getFullYear()} allocation
                </p>
              </div>
            </div>

            {leaveLoading || isUserLoading ? (
              <div className="flex items-center justify-center py-6">
                <TbLoader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
              </div>
            ) : leaveBalance ? (
              <div className="space-y-4">
                <LeaveBar
                  label="Casual"
                  used={leaveBalance.casual_used}
                  total={leaveBalance.casual_total}
                  color="bg-[#00BCD4]"
                  trackColor="bg-[#F1F5F9]"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center py-4 text-muted-foreground/60">
                <TbCalendarOff className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">No leave balance for {new Date().getFullYear()}</p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Active Tasks */}
        <GlassCard className="group transition-all duration-300 hover:translate-y-[-2px] overflow-hidden relative">
          <div className="relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-[#00BCD4] text-white flex items-center justify-center border border-border">
                <TbChecklist className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Active Tasks</p>
                <p className="text-[11px] text-muted-foreground/70">
                  {tasks.length} {tasks.length === 1 ? "task" : "tasks"} pending
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-muted-foreground/60">
                  <TbCircleCheck className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">All caught up!</p>
                </div>
              ) : (
                tasks.map((t) => {
                  const priorityConfig: Record<string, { dot: string; bg: string }> = {
                    urgent: { dot: "bg-destructive", bg: "bg-destructive/15 text-destructive" },
                    high: { dot: "bg-[#0F172A]", bg: "bg-[#EDE9FE] text-[#0F172A]" },
                    normal: { dot: "bg-[#00BCD4]", bg: "bg-[#00BCD4] text-white" },
                    low: { dot: "bg-[#34D399]", bg: "bg-[#DBEAFE] text-[#0F172A]" },
                  }
                  const pc = priorityConfig[t.priority] ?? priorityConfig.normal

                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg transition-colors hover:bg-[#0A1628]"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pc.dot}`} />
                      <span className="text-sm truncate flex-1">{t.title}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${pc.bg}`}>
                        {t.priority}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </GlassCard>

        {/* Announcements */}
        <GlassCard className="group transition-all duration-300 hover:translate-y-[-2px] overflow-hidden relative">
          <div className="relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center border border-border">
                <TbSpeakerphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">Announcements</p>
                <p className="text-[11px] text-muted-foreground/70">Latest updates</p>
              </div>
            </div>

            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-muted-foreground/60">
                  <TbSpeakerphone className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">No announcements</p>
                </div>
              ) : (
                announcements.map((a) => {
                  const borderColor = "border-l-border"

                  return (
                    <div
                      key={a.id}
                      className={`border-l-2 ${borderColor} pl-3 py-1.5 transition-colors hover:bg-[#0A1628] rounded-r-lg`}
                    >
                      <div className="flex items-center gap-1.5">
                        {a.is_pinned && (
                          <TbPin className="h-3 w-3 text-[#0F172A] shrink-0 fill-[#00BCD4]" />
                        )}
                        <p className="text-sm font-medium truncate">{a.title}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 line-clamp-1 mt-0.5">
                        {a.content}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

/* ── Leave Bar with gradient progress ── */
function LeaveBar({
  label,
  used,
  total,
  color,
  trackColor,
}: {
  label: string
  used: number
  total: number
  color: string
  trackColor: string
}) {
  const remaining = total - used
  const percent = total > 0 ? (used / total) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground/70 tabular-nums">
          <span className="font-semibold text-foreground/80">{remaining}</span>/{total} left
        </span>
      </div>
      <div className={`h-2 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  )
}
