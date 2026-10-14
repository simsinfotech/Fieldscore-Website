"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TbPlus,
  TbLoader2,
  TbTrash,
  TbFileText,
  TbCalendar,
  TbCircleCheck,
  TbAlertOctagon,
  TbBulb,
  TbChevronDown,
  TbChevronUp,
  TbUser,
  TbInbox,
  TbClock,
  TbChartBar,
  TbListCheck,
  TbUsers,
  TbSearch,
} from "react-icons/tb"
import { toast } from "sonner"
import { format } from "date-fns"
import type { EodReport } from "@/types"

// Department-aware EOD templates. `auto` fields are pre-filled from the app's
// own data (sales activity) via /api/eod/prefill.
type MetricField = { key: string; label: string; auto?: boolean }
const EOD_TEMPLATES: Record<string, MetricField[]> = {
  sales: [
    { key: "calls", label: "Calls made", auto: true },
    { key: "leads_contacted", label: "Leads contacted", auto: true },
    { key: "whatsapp", label: "WhatsApp sent", auto: true },
    { key: "follow_ups", label: "Follow-ups set" },
    { key: "site_visits", label: "Site visits", auto: true },
    { key: "deals", label: "Deals won", auto: true },
  ],
  marketing: [
    { key: "content_published", label: "Content published" },
    { key: "campaigns", label: "Campaigns worked" },
    { key: "leads_generated", label: "Leads generated" },
    { key: "reach", label: "Reach / impressions" },
  ],
  development: [
    { key: "tasks_done", label: "Tasks completed" },
    { key: "bugs_fixed", label: "Bugs fixed" },
  ],
}
const METRIC_LABELS: Record<string, string> = {
  calls: "Calls", leads_contacted: "Leads contacted", whatsapp: "WhatsApp",
  follow_ups: "Follow-ups", site_visits: "Site visits", deals: "Deals won",
  content_published: "Content", campaigns: "Campaigns", leads_generated: "Leads gen.",
  reach: "Reach", tasks_done: "Tasks", bugs_fixed: "Bugs fixed",
}

type EodTask = { work_item_id?: string; reference: string; title: string; type?: string; status: string }
const WORK_STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review",
  approved: "Approved", blocked: "Blocked", done: "Done", cancelled: "Cancelled",
}
const WORK_STATUS_BADGE: Record<string, string> = {
  done: "bg-[#00BCD4]/10 text-[#F1F5F9]",
  approved: "bg-[#00BCD4]/10 text-[#F1F5F9]",
  in_progress: "bg-[#00BCD4]/25 text-[#00E5FF]",
  review: "bg-[#7C4DFF]/10 text-[#F1F5F9]",
  blocked: "bg-destructive/15 text-destructive",
  todo: "bg-secondary text-muted-foreground",
  backlog: "bg-secondary text-muted-foreground",
}

type EodPerson = {
  id: string; full_name: string; avatar_url?: string | null
  role?: string; reports_to?: string | null; is_admin?: boolean; department?: string | null
}

export default function EodReportsPage() {
  const { employee, isAdmin } = useUser()
  const isManager = employee?.role === "manager"
  const orgId = useOrg()
  const supabase = createClient()

  const [reports, setReports] = useState<EodReport[]>([])
  const [people, setPeople] = useState<EodPerson[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({})
  const [reviewing, setReviewing] = useState<string | null>(null)

  useEffect(() => {
    if (!employee) return
    fetchData()
    // Realtime: EOD submissions + reviews reflect live for everyone.
    const channel = supabase
      .channel(`eod-${employee.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fs_eod_reports" }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, orgId, selectedEmployee])

  async function fetchData() {
    setLoading(true)
    const canSeeOthers = isAdmin || isManager

    // Reports (RLS scopes: setter=own, manager=subtree, admin=all).
    let query = supabase
      .from("fs_eod_reports")
      .select("*")
      .order("date", { ascending: false })
      .limit(100)
    if (canSeeOthers) {
      if (selectedEmployee !== "all") query = query.eq("employee_id", selectedEmployee)
    } else {
      query = query.eq("employee_id", employee!.id)
    }

    // Author directory via the admin-backed endpoint — the client can't read
    // other employees' rows (RLS limits a non-admin to their own), so names
    // for team members must come from here.
    const [{ data, error }, pres] = await Promise.all([
      query,
      fetch("/api/people").then((r) => (r.ok ? r.json() : { people: [] })).catch(() => ({ people: [] })),
    ])
    if (error) console.error("Failed to load EOD reports:", error)

    const peopleList: EodPerson[] = pres.people || []
    const byId = new Set(peopleList.map((p) => p.id))
    const reps = ((data ?? []) as unknown as EodReport[]).filter((r) => byId.has(r.employee_id))

    setPeople(peopleList)
    setReports(reps)
    if (reps.length > 0) setExpandedIds(new Set([reps[0].id]))
    setLoading(false)
  }

  async function submitReview(id: string) {
    setReviewing(id)
    try {
      const res = await fetch(`/api/eod/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: reviewComment[id] || "" }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "Failed to review")
        return
      }
      toast.success("Reviewed & forwarded to admin")
      setReviewComment((c) => ({ ...c, [id]: "" }))
      fetchData()
    } finally {
      setReviewing(null)
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const empById = useMemo(() => new Map(people.map((e) => [e.id, e])), [people])
  // Filter dropdown options: admin sees the whole org; a manager sees their
  // team + themselves.
  const filterPeople = isAdmin
    ? people
    : people.filter((p) => p.reports_to === employee?.id || p.id === employee?.id)
  // A report reaches the admin directly only if its author reports to an admin
  // (or no one). Setters report to their manager, so for the admin they are
  // rolled up *under that manager* — they never appear standalone to the admin.
  function reportsDirectlyToAdmin(rt?: string | null) {
    if (!rt) return true
    const m = empById.get(rt)
    return !m || m.is_admin
  }
  // Nest only in the admin's "All employees" view.
  const nesting = isAdmin && selectedEmployee === "all"

  // Group reports by date
  const grouped = reports.reduce<Record<string, EodReport[]>>((acc, report) => {
    const dateKey = report.date
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(report)
    return acc
  }, {})

  const STATUS_BADGE: Record<string, string> = {
    completed: "bg-[#00BCD4]/10 text-[#F1F5F9]",
    in_progress: "bg-[#00BCD4]/25 text-[#00E5FF]",
    partial: "bg-[#7C4DFF]/10 text-[#F1F5F9]",
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1A2B45] text-white">
            <TbFileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">EOD Reports</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <TbCalendar className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NewEodDialog employeeId={employee?.id} onSuccess={fetchData} />
        </div>
      </div>

      {/* Team filter (admin + manager) */}
      {(isAdmin || isManager) && filterPeople.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-[#0D1B2A] backdrop-blur-md px-4 py-2">
            <TbUser className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedEmployee} onValueChange={(v) => v !== null && setSelectedEmployee(v)}>
              <SelectTrigger className="w-full sm:w-[200px] border-0 bg-transparent p-0 h-auto shadow-none focus:ring-0">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {filterPeople.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Reports Timeline */}
      {reports.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed border-border bg-[#0D1B2A] shadow-soft">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A2B45] text-white mb-4">
            <TbInbox className="h-8 w-8 text-white" />
          </div>
          <p className="text-muted-foreground font-medium mb-1">
            No reports found
          </p>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "No EOD reports have been submitted yet."
              : "Submit your first end-of-day report to get started."}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border hidden md:block" />

          <div className="space-y-6">
            {Object.entries(grouped).map(([dateKey, dateReports]) => {
              // A setter rolls up under their manager only when that manager
              // ALSO filed that day; otherwise the setter is shown directly so
              // their report is never lost.
              const managerIds = new Set(dateReports.map((r) => r.employee_id))
              const isTopLevel = (r: EodReport) => {
                const rt = empById.get(r.employee_id)?.reports_to
                if (reportsDirectlyToAdmin(rt)) return true
                return !rt || !managerIds.has(rt)
              }
              const shown = nesting ? dateReports.filter(isTopLevel) : dateReports
              const nestedCount = dateReports.length - shown.length
              return (
              <div key={dateKey} className="relative">
                {/* Date header with timeline dot */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#00BCD4] text-white shrink-0">
                    <TbCalendar className="h-4 w-4 text-[#F1F5F9]" />
                  </div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold">
                      {format(new Date(dateKey), "EEEE, MMM d, yyyy")}
                    </h2>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {shown.length} {shown.length === 1 ? "report" : "reports"}
                      {nestedCount > 0 ? ` · ${nestedCount} in teams` : ""}
                    </span>
                  </div>
                </div>

                {/* Reports for this date */}
                <div className="md:ml-14 space-y-3">
                  {shown.map((report) => {
                    const author = empById.get(report.employee_id)
                    const isExpanded = expandedIds.has(report.id)
                    const isMgr = author?.role === "manager"
                    // Setter shown directly because their manager hasn't filed.
                    const orphaned = nesting && author?.role === "setter" && !!author.reports_to && !managerIds.has(author.reports_to)
                    // For the admin, a manager's card rolls up their team's day.
                    const teamReports = nesting && isMgr
                      ? dateReports.filter((x) => empById.get(x.employee_id)?.reports_to === report.employee_id)
                      : []
                    const teamMembers = nesting && isMgr
                      ? people.filter((e) => e.reports_to === report.employee_id)
                      : []
                    return (
                      <div
                        key={report.id}
                        className="rounded-3xl border border-border bg-[#0D1B2A] backdrop-blur-md shadow-soft overflow-hidden transition-all duration-200 hover:bg-secondary"
                      >
                        {/* Collapsible header */}
                        <button
                          onClick={() => toggleExpand(report.id)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left"
                        >
                          <div className="flex items-center gap-3">
                            {(isAdmin || isManager) && author && (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A2B45] text-white">
                                <span className="text-xs font-semibold text-white">
                                  {getInitials(author.full_name)}
                                </span>
                              </div>
                            )}
                            <div>
                              {(isAdmin || isManager) && author && (
                                <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                                  {author.full_name}
                                  {author.department && (
                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                                      {author.department}
                                      {author.role && author.role !== "viewer" ? ` · ${author.role}` : ""}
                                    </span>
                                  )}
                                  {orphaned && author.reports_to && (
                                    <span className="rounded-full bg-[#00BCD4]/15 px-2 py-0.5 text-[10px] text-[#00E5FF]">
                                      awaiting {empById.get(author.reports_to)?.full_name?.split(" ")[0] ?? "manager"}
                                    </span>
                                  )}
                                  {report.review_status === "reviewed" ? (
                                    <Badge variant="secondary" className="bg-[#00BCD4]/10 text-[#F1F5F9] rounded-full">Reviewed</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground rounded-full">Pending review</Badge>
                                  )}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <TbCircleCheck className="h-3 w-3 text-[#34D399]" />
                                <span>
                                  {report.metrics && Object.keys(report.metrics).length > 0
                                    ? Object.entries(report.metrics).slice(0, 3).map(([k, v]) => `${v} ${METRIC_LABELS[k] ?? k}`).join(" · ")
                                    : (report.task_progress?.length ?? 0) > 0
                                      ? `${report.task_progress!.length} ${report.task_progress!.length === 1 ? "task" : "tasks"}`
                                      : `${(report.tasks_completed as unknown[]).length} ${(report.tasks_completed as unknown[]).length === 1 ? "highlight" : "highlights"}`}
                                </span>
                                {report.blockers && (
                                  <>
                                    <span className="text-border">|</span>
                                    <TbAlertOctagon className="h-3 w-3 text-destructive" />
                                    <span className="text-destructive">Has blockers</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                              {report.reference}
                            </span>
                            <TbClock className="h-3.5 w-3.5 text-muted-foreground" />
                            {isExpanded ? (
                              <TbChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <TbChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {/* Expandable content */}
                        {isExpanded && (
                          <div className="px-5 pb-5 space-y-4 border-t border-border">
                            {/* Metrics (department KPIs) */}
                            {report.metrics && Object.keys(report.metrics).length > 0 && (
                              <div className="pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <TbChartBar className="h-4 w-4 text-[#F1F5F9]" />
                                  <h4 className="text-xs font-semibold text-foreground">Today&apos;s numbers</h4>
                                  {report.department && (
                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] capitalize text-muted-foreground">{report.department}</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                  {Object.entries(report.metrics)
                                    .filter(([, v]) => v !== null && v !== undefined)
                                    .map(([k, v]) => (
                                      <div key={k} className="rounded-2xl bg-secondary px-3 py-2 text-center">
                                        <p className="text-lg font-semibold tabular-nums">{v as number}</p>
                                        <p className="text-[10px] text-muted-foreground">{METRIC_LABELS[k] ?? k}</p>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Task progress (from Work board) */}
                            {(report.task_progress?.length ?? 0) > 0 && (
                              <div className="pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <TbListCheck className="h-4 w-4 text-[#F1F5F9]" />
                                  <h4 className="text-xs font-semibold text-foreground">Task progress</h4>
                                </div>
                                <div className="space-y-1.5">
                                  {report.task_progress!.map((t) => (
                                    <div key={t.work_item_id ?? t.reference} className="flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2">
                                      <div className="min-w-0 flex-1">
                                        <span className="text-sm">{t.title}</span>
                                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">{t.reference}</span>
                                      </div>
                                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${WORK_STATUS_BADGE[t.status] ?? "bg-[#0D1B2A] text-muted-foreground"}`}>
                                        {WORK_STATUS_LABEL[t.status] ?? t.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Highlights */}
                            {(report.tasks_completed as { title: string }[]).length > 0 && (
                            <div className="pt-4">
                              <div className="flex items-center gap-2 mb-3">
                                <TbCircleCheck className="h-4 w-4 text-[#34D399]" />
                                <h4 className="text-xs font-semibold text-foreground">
                                  Highlights
                                </h4>
                              </div>
                              <div className="space-y-2">
                                {(report.tasks_completed as any[]).map(
                                  (t, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center gap-3 rounded-2xl bg-secondary px-3.5 py-2.5"
                                    >
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1A2B45] text-[10px] font-semibold text-white shrink-0">
                                        {i + 1}
                                      </span>
                                      <span className="text-sm flex-1">
                                        {t.title}
                                      </span>
                                      {t.status && (
                                        <span
                                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status] || "bg-[#00BCD4]/10 text-[#F1F5F9]"}`}
                                        >
                                          {t.status.replace("_", " ")}
                                        </span>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                            )}

                            {/* Blockers */}
                            {report.blockers && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <TbAlertOctagon className="h-4 w-4 text-destructive" />
                                  <h4 className="text-xs font-semibold text-foreground">
                                    Blockers
                                  </h4>
                                </div>
                                <div className="rounded-2xl bg-destructive/10 px-4 py-3">
                                  <p className="text-sm text-foreground leading-relaxed">
                                    {report.blockers}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Tomorrow plan */}
                            {report.tomorrow_plan && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <TbBulb className="h-4 w-4 text-[#34D399]" />
                                  <h4 className="text-xs font-semibold text-foreground">
                                    Tomorrow&apos;s Plan
                                  </h4>
                                </div>
                                <div className="rounded-2xl bg-[#00BCD4]/10 px-4 py-3">
                                  <p className="text-sm text-[#F1F5F9] leading-relaxed">
                                    {report.tomorrow_plan}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Team roll-up — a manager's card includes their setters' day */}
                            {nesting && isMgr && (
                              <div className="rounded-2xl border border-border p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <TbUsers className="h-4 w-4 text-[#F1F5F9]" />
                                  <h4 className="text-xs font-semibold text-foreground">
                                    Team reports · {teamMembers.length} {teamMembers.length === 1 ? "person" : "people"}
                                  </h4>
                                </div>
                                <div className="space-y-1.5">
                                  {teamMembers.map((m) => {
                                    const tr = teamReports.find((x) => x.employee_id === m.id)
                                    return (
                                      <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2">
                                        <span className="text-sm font-medium">{m.full_name}</span>
                                        {tr ? (
                                          <span className="truncate text-[11px] text-muted-foreground">
                                            {tr.metrics && Object.keys(tr.metrics).length > 0
                                              ? Object.entries(tr.metrics).slice(0, 4).map(([k, v]) => `${v} ${METRIC_LABELS[k] ?? k}`).join(" · ")
                                              : `${tr.task_progress?.length ?? 0} tasks`}
                                          </span>
                                        ) : (
                                          <span className="text-[11px] italic text-muted-foreground">Not submitted</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {teamMembers.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground">No setters report to this manager.</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Manager review / forwarded note */}
                            {report.review_status === "reviewed" && report.manager_comment && (
                              <div className="rounded-2xl bg-[#7C4DFF]/10 px-4 py-3">
                                <p className="text-xs font-semibold text-foreground mb-1">Review note</p>
                                <p className="text-sm text-foreground">{report.manager_comment}</p>
                              </div>
                            )}
                            {(isManager || isAdmin) && report.employee_id !== employee?.id && report.review_status !== "reviewed" && (
                              <div className="space-y-2 rounded-2xl border border-border p-3">
                                <Textarea
                                  rows={2}
                                  value={reviewComment[report.id] || ""}
                                  onChange={(e) => setReviewComment((c) => ({ ...c, [report.id]: e.target.value }))}
                                  placeholder={isAdmin ? "Note (optional)…" : "Note to admin (optional)…"}
                                />
                                <Button size="sm" onClick={() => submitReview(report.id)} disabled={reviewing === report.id} className="w-full bg-[#1A2B45] text-white hover:bg-[#1A2B45]">
                                  {reviewing === report.id ? <TbLoader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                  {isAdmin ? "Mark reviewed" : "Review & forward to admin"}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function NewEodDialog({
  employeeId,
  onSuccess,
}: {
  employeeId?: string
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [department, setDepartment] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Record<string, string>>({})
  const [workTasks, setWorkTasks] = useState<EodTask[]>([])
  const [highlights, setHighlights] = useState<string[]>([""])
  const [blockers, setBlockers] = useState("")
  const [tomorrowPlan, setTomorrowPlan] = useState("")
  const [loading, setLoading] = useState(false)
  const [prefilling, setPrefilling] = useState(false)
  const [allTasks, setAllTasks] = useState<EodTask[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [taskSearch, setTaskSearch] = useState("")
  const supabase = createClient()

  const template = department ? EOD_TEMPLATES[department] : undefined

  async function handleOpen(o: boolean) {
    setOpen(o)
    if (!o) return
    // reset + fetch the department template, auto numbers & assigned tasks.
    setHighlights([""]); setBlockers(""); setTomorrowPlan(""); setMetrics({}); setWorkTasks([])
    setAllTasks([]); setShowPicker(false); setTaskSearch("")
    setPrefilling(true)
    try {
      const res = await fetch("/api/eod/prefill")
      if (res.ok) {
        const { department: dept, autoMetrics, workItems, allAssignedTasks } = await res.json()
        setDepartment(dept ?? null)
        const init: Record<string, string> = {}
        for (const [k, v] of Object.entries(autoMetrics || {})) init[k] = String(v)
        setMetrics(init)
        setWorkTasks((workItems || []) as unknown as EodTask[])
        setAllTasks((allAssignedTasks || []) as unknown as EodTask[])
      }
    } finally {
      setPrefilling(false)
    }
  }

  function setMetric(key: string, val: string) {
    setMetrics((m) => ({ ...m, [key]: val.replace(/[^0-9]/g, "") }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId) return

    const cleanHighlights = highlights.map((t) => t.trim()).filter(Boolean).map((title) => ({ title }))
    const cleanMetrics: Record<string, number> = {}
    if (template) {
      for (const f of template) {
        const v = metrics[f.key]
        if (v !== undefined && v !== "") cleanMetrics[f.key] = Number(v)
      }
    }
    if (Object.keys(cleanMetrics).length === 0 && cleanHighlights.length === 0 && workTasks.length === 0) {
      toast.error("Add today's numbers, a task, or a highlight")
      return
    }

    setLoading(true)
    const { error } = await supabase.from("fs_eod_reports").insert({
      employee_id: employeeId,
      date: format(new Date(), "yyyy-MM-dd"),
      department,
      metrics: cleanMetrics,
      task_progress: workTasks,
      tasks_completed: cleanHighlights,
      blockers: blockers || null,
      tomorrow_plan: tomorrowPlan || null,
    })

    if (error) {
      if (error.code === "23505") toast.error("You already submitted today's EOD report")
      else toast.error("Failed to submit report")
    } else {
      toast.success("EOD report submitted!")
      setOpen(false)
      setMetrics({}); setHighlights([""]); setBlockers(""); setTomorrowPlan(""); setWorkTasks([])
      setAllTasks([]); setShowPicker(false); setTaskSearch("")
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#00BCD4] hover:bg-[#00ACC1] text-white">
          <TbPlus className="mr-2 h-4 w-4" />
          Submit EOD
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#1A2B45] text-white">
              <TbFileText className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg">End of Day Report</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Department metrics */}
          {prefilling ? (
            <div className="flex justify-center py-6 text-muted-foreground"><TbLoader2 className="h-5 w-5 animate-spin" /></div>
          ) : template ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <TbChartBar className="h-4 w-4 text-[#F1F5F9]" />
                <Label className="text-xs font-semibold capitalize text-foreground">{department} — today&apos;s numbers</Label>
                {department === "sales" && (
                  <span className="rounded-full bg-[#00BCD4]/10 px-2 py-0.5 text-[10px] text-[#F1F5F9]">auto-filled from your activity — edit if needed</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {template.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{f.label}{f.auto ? " ✨" : ""}</Label>
                    <Input
                      inputMode="numeric"
                      value={metrics[f.key] ?? ""}
                      onChange={(e) => setMetric(f.key, e.target.value)}
                      placeholder="0"
                      className="bg-[#0D1B2A] border border-border rounded-xl"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No department set for your account — just add your highlights below.
            </p>
          )}

          {/* Task progress — pulled from the Work board */}
          {!prefilling && workTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TbListCheck className="h-4 w-4 text-[#F1F5F9]" />
                <Label className="text-xs font-semibold text-foreground">Task progress</Label>
                <span className="text-[10px] text-muted-foreground">from your Work board</span>
              </div>
              <div className="space-y-1.5">
                {workTasks.map((t) => (
                  <div key={t.work_item_id ?? t.reference} className="flex items-center gap-2 rounded-xl border border-border bg-[#0D1B2A] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <span className="font-mono text-[10px] text-muted-foreground">{t.reference}</span>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${WORK_STATUS_BADGE[t.status] ?? "bg-secondary text-muted-foreground"}`}>
                      {WORK_STATUS_LABEL[t.status] ?? t.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWorkTasks((prev) => prev.filter((x) => x.work_item_id !== t.work_item_id))}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove from report"
                    >
                      <TbTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Select task picker — add previously completed tasks */}
          {!prefilling && allTasks.length > 0 && (() => {
            const availableTasks = allTasks
              .filter((t) => !workTasks.some((w) => w.work_item_id === t.work_item_id))
              .filter((t) => {
                if (!taskSearch) return true
                const q = taskSearch.toLowerCase()
                return t.title.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q)
              })
            return (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowPicker((v) => !v); setTaskSearch("") }}
                  className="h-8 text-xs text-muted-foreground hover:bg-secondary"
                >
                  <TbPlus className="h-3 w-3 mr-1" />
                  Select task
                </Button>
                {showPicker && (
                  <div className="rounded-xl border border-border bg-[#0D1B2A] p-2 space-y-2">
                    <div className="relative">
                      <TbSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="Search by title or reference…"
                        className="pl-8 h-8 text-sm bg-secondary border-0 rounded-lg"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {availableTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">No tasks found</p>
                      ) : (
                        availableTasks.map((t) => (
                          <button
                            key={t.work_item_id}
                            type="button"
                            onClick={() => {
                              setWorkTasks((prev) => [...prev, t])
                            }}
                            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-secondary transition-colors"
                          >
                            <TbPlus className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{t.title}</p>
                              <span className="font-mono text-[10px] text-muted-foreground">{t.reference}</span>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${WORK_STATUS_BADGE[t.status] ?? "bg-secondary text-muted-foreground"}`}>
                              {WORK_STATUS_LABEL[t.status] ?? t.status}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Highlights (optional) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TbCircleCheck className="h-4 w-4 text-[#34D399]" />
                <Label className="text-xs font-semibold text-foreground">Highlights <span className="font-normal text-muted-foreground">(optional)</span></Label>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setHighlights((h) => [...h, ""])} className="h-7 text-xs hover:bg-secondary">
                <TbPlus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {highlights.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={h}
                    onChange={(e) => setHighlights((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    placeholder="Something notable today…"
                    className="flex-1 bg-[#0D1B2A] border border-border rounded-xl"
                  />
                  {highlights.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setHighlights((prev) => prev.filter((_, idx) => idx !== i))} className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/15">
                      <TbTrash className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Blockers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TbAlertOctagon className="h-4 w-4 text-destructive" />
              <Label className="text-xs font-semibold text-foreground">Blockers</Label>
            </div>
            <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Any blockers or issues you faced today..." rows={2} className="bg-[#0D1B2A] border border-border rounded-xl resize-none" />
          </div>

          {/* Tomorrow's plan */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TbBulb className="h-4 w-4 text-[#34D399]" />
              <Label className="text-xs font-semibold text-foreground">Tomorrow&apos;s Plan</Label>
            </div>
            <Textarea value={tomorrowPlan} onChange={(e) => setTomorrowPlan(e.target.value)} placeholder="What do you plan to work on tomorrow?" rows={2} className="bg-[#0D1B2A] border border-border rounded-xl resize-none" />
          </div>

          <Button type="submit" className="w-full bg-[#00BCD4] text-white hover:bg-[#00ACC1] h-11 font-medium" disabled={loading}>
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
