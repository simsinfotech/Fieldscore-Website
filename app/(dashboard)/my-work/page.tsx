"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { GlassCard } from "@/components/shared/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TbClipboardCheck, TbAlertTriangle, TbCalendarDue, TbCalendarWeek,
  TbListCheck, TbPhoneCall, TbLoader2, TbCheck, TbX, TbAt,
  TbCalendarOff, TbArrowRight, TbChevronRight, TbFlag,
} from "react-icons/tb"
import { toast } from "sonner"
import { format, differenceInCalendarDays, formatDistanceToNow } from "date-fns"

interface WorkRow {
  id: string; reference: string; title: string
  type: string; status: string; priority: number; due_at: string | null
}
interface ApprovalStepLite {
  id: string; approval_id: string; step_number: number
  approval?: { subject_type: string; requester?: { full_name?: string } }
}
interface MentionRow { id: string; title: string; message: string; link: string | null; is_read: boolean; created_at: string }
interface LeaveRow { id: string; reference: string; leave_type: string; start_date: string; end_date: string; created_at: string }
interface MyWork {
  open: WorkRow[]
  approvalsWaiting: ApprovalStepLite[]
  mentions: MentionRow[]
  myLeaveRequests: LeaveRow[]
  uncontactedLeads: { id: string; full_name: string; phone_e164: string }[]
}

const PRIORITY_LABEL: Record<number, string> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4", 5: "P5" }
const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review",
  approved: "Approved", blocked: "Blocked", done: "Done", cancelled: "Cancelled",
}

function dueInfo(due: string | null) {
  if (!due) return { label: "No due date", tone: "none" as const, abs: "" }
  const d = new Date(due)
  const days = differenceInCalendarDays(d, new Date())
  const abs = format(d, "EEE, MMM d")
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, tone: "red" as const, abs }
  if (days === 0) return { label: "Due today", tone: "amber" as const, abs }
  if (days === 1) return { label: "Due tomorrow", tone: "amber" as const, abs }
  if (days <= 7) return { label: `Due ${format(d, "EEE")}`, tone: "soon" as const, abs }
  return { label: `Due ${format(d, "MMM d")}`, tone: "none" as const, abs }
}

export default function MyWorkPage() {
  const { employee } = useUser()
  const router = useRouter()
  const [data, setData] = useState<MyWork | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/my-work")
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!employee) return
    fetchData()
    const supabase = createClient()
    const channel = supabase
      .channel("my-work")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_items" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "fs_notifications", filter: `recipient_id=eq.${employee.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "fs_leave_requests" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_steps" }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [employee?.id, fetchData])

  async function decide(approvalId: string, decision: "approved" | "rejected") {
    setActing(approvalId + decision)
    try {
      const res = await fetch(`/api/approvals/${approvalId}/decide`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "Failed"); return }
      toast.success(`Request ${decision}`)
      fetchData()
    } finally { setActing(null) }
  }

  const buckets = useMemo(() => {
    const open = data?.open ?? []
    const dd = (w: WorkRow) => (w.due_at ? differenceInCalendarDays(new Date(w.due_at), new Date()) : null)
    return {
      overdue: open.filter((w) => { const n = dd(w); return n !== null && n < 0 }),
      dueToday: open.filter((w) => dd(w) === 0),
      thisWeek: open.filter((w) => { const n = dd(w); return n !== null && n >= 1 && n <= 7 }),
      open,
    }
  }, [data])

  if (loading) {
    return <div className="flex justify-center py-20 text-muted-foreground"><TbLoader2 className="h-6 w-6 animate-spin" /></div>
  }

  const d = data
  const hasApprovals = (d?.approvalsWaiting.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00BCD4] text-white border border-border shrink-0">
          <TbClipboardCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Work</h1>
          <p className="text-sm text-muted-foreground">Everything waiting on you, in one place</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<TbAlertTriangle className="h-4 w-4" />} label="Overdue" value={buckets.overdue.length} tone="red" />
        <StatTile icon={<TbCalendarDue className="h-4 w-4" />} label="Due today" value={buckets.dueToday.length} tone="amber" />
        <StatTile icon={<TbCalendarWeek className="h-4 w-4" />} label="This week" value={buckets.thisWeek.length} tone="soon" />
        <StatTile icon={<TbListCheck className="h-4 w-4" />} label="Open" value={buckets.open.length} tone="sage" />
      </div>

      {/* Approvals — surfaced first when present */}
      {hasApprovals && (
        <GlassCard className="space-y-3 rounded-3xl border border-border shadow-soft">
          <SectionTitle icon={<TbClipboardCheck className="h-4 w-4" />} label="Approvals waiting on you" count={d!.approvalsWaiting.length} tone="primary" />
          <div className="space-y-2">
            {d!.approvalsWaiting.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize">{s.approval?.subject_type?.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">Requested by {s.approval?.requester?.full_name ?? "someone"}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => decide(s.approval_id, "approved")} disabled={!!acting}>
                    {acting === s.approval_id + "approved" ? <TbLoader2 className="h-4 w-4 animate-spin" /> : <TbCheck className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => decide(s.approval_id, "rejected")} disabled={!!acting}>
                    {acting === s.approval_id + "rejected" ? <TbLoader2 className="h-4 w-4 animate-spin" /> : <TbX className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Overdue + Due today */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={<TbAlertTriangle className="h-4 w-4" />} label="Overdue" count={buckets.overdue.length} tone="red">
          <WorkList items={buckets.overdue} emptyText="Nothing overdue." />
        </Section>
        <Section icon={<TbCalendarDue className="h-4 w-4" />} label="Due today" count={buckets.dueToday.length} tone="amber">
          <WorkList items={buckets.dueToday} emptyText="Nothing due today." />
        </Section>
      </div>

      {/* This week + Mentions */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={<TbCalendarWeek className="h-4 w-4" />} label="Due this week" count={buckets.thisWeek.length} tone="soon">
          <WorkList items={buckets.thisWeek} emptyText="Nothing due this week." />
        </Section>
        <Section icon={<TbAt className="h-4 w-4" />} label="Mentions" count={d?.mentions.filter((m) => !m.is_read).length ?? 0} tone="primary">
          {(d?.mentions.length ?? 0) === 0 ? (
            <Empty text="You haven't been mentioned recently." />
          ) : (
            <div className="space-y-2">
              {d!.mentions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => m.link && router.push(m.link)}
                  className={`flex w-full items-start gap-2 rounded-2xl border border-border p-3 text-left transition-colors hover:bg-secondary/50 ${!m.is_read ? "bg-[#00BCD4]/10" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
                  </div>
                  <TbChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Open work + Leave requests */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={<TbListCheck className="h-4 w-4" />} label="My open work" count={buckets.open.length} tone="sage">
          <WorkList items={buckets.open} emptyText="No open work assigned to you." showDue />
          <div className="pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href="/work">
                Open work board <TbArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </Section>

        <Section icon={<TbCalendarOff className="h-4 w-4" />} label="My leave requests" count={d?.myLeaveRequests.length ?? 0} tone="lavender">
          {(d?.myLeaveRequests.length ?? 0) === 0 ? (
            <Empty text="No leave requests awaiting a decision." />
          ) : (
            <div className="space-y-2">
              {d!.myLeaveRequests.map((r) => (
                <Link key={r.id} href="/leave" className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3 hover:bg-secondary/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">{r.reference}</span>
                      <span className="text-sm font-medium capitalize">{r.leave_type} leave</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(r.start_date), "MMM d")} – {format(new Date(r.end_date), "MMM d")}
                    </p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Leads to contact (setters) — full width */}
      {(d?.uncontactedLeads.length ?? 0) > 0 && (
        <Section icon={<TbPhoneCall className="h-4 w-4" />} label="Leads to contact" count={d!.uncontactedLeads.length} tone="dark">
          <div className="grid gap-2 sm:grid-cols-2">
            {d!.uncontactedLeads.map((l) => (
              <Link key={l.id} href="/leads" className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm hover:bg-secondary/50">
                <span className="font-medium">{l.full_name}</span>
                <span className="tabular-nums text-xs text-muted-foreground">{l.phone_e164}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

/* ── Stat tile ── */
const TILE_TONES: Record<string, string> = {
  red: "bg-destructive/10 text-destructive",
  amber: "bg-[#00BCD4]/20 text-[#00E5FF]",
  soon: "bg-[#7C4DFF]/10 text-[#F1F5F9]",
  sage: "bg-[#00BCD4]/10 text-[#F1F5F9]",
}
function StatTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-3xl border border-border bg-[#0D1B2A] p-4 shadow-soft">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-2xl ${TILE_TONES[tone]}`}>{icon}</div>
      <p className="text-3xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

/* ── Section shell + title ── */
const DOT_TONES: Record<string, string> = {
  red: "bg-destructive/15 text-destructive",
  amber: "bg-[#00BCD4]/25 text-[#00E5FF]",
  soon: "bg-[#7C4DFF]/10 text-[#F1F5F9]",
  sage: "bg-[#00BCD4]/10 text-[#F1F5F9]",
  lavender: "bg-[#7C4DFF]/10 text-[#F1F5F9]",
  primary: "bg-[#00BCD4] text-white",
  dark: "bg-[#1A2B45] text-white",
}
function Section({ icon, label, count, tone, children }: { icon: React.ReactNode; label: string; count: number; tone: string; children: React.ReactNode }) {
  return (
    <GlassCard className="space-y-3 rounded-3xl border border-border shadow-soft">
      <SectionTitle icon={icon} label={label} count={count} tone={tone} />
      {children}
    </GlassCard>
  )
}
function SectionTitle({ icon, label, count, tone }: { icon: React.ReactNode; label: string; count: number; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-2xl ${DOT_TONES[tone]}`}>{icon}</div>
      <p className="text-sm font-semibold">{label}</p>
      {count > 0 && <Badge variant="secondary">{count}</Badge>}
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <p className="py-2 text-sm text-muted-foreground">{text}</p>
}

/* ── Work list + row ── */
const DUE_BADGE: Record<string, string> = {
  red: "bg-destructive/15 text-destructive",
  amber: "bg-[#00BCD4]/20 text-[#00E5FF]",
  soon: "bg-secondary text-foreground",
  none: "bg-secondary text-muted-foreground",
}
function WorkList({ items, emptyText, showDue }: { items: WorkRow[]; emptyText: string; showDue?: boolean }) {
  if (items.length === 0) return <Empty text={emptyText} />
  return (
    <div className="space-y-2">
      {items.map((w) => {
        const due = dueInfo(w.due_at)
        return (
          <Link key={w.id} href={`/work/${w.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3 transition-colors hover:bg-secondary/50">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{w.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">{w.reference}</span>
                <Badge variant="outline" className="capitalize">{w.type}</Badge>
                <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <TbFlag className="h-3 w-3" />{PRIORITY_LABEL[w.priority] ?? ""}
                </span>
                <span className="text-[11px] text-muted-foreground">{STATUS_LABEL[w.status] ?? w.status}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              {(showDue || due.tone !== "none") && w.due_at ? (
                <>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${DUE_BADGE[due.tone]}`}>{due.label}</span>
                  <p className="mt-1 text-[10px] text-muted-foreground">{due.abs}</p>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground/60">No due date</span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
