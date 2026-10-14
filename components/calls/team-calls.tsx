"use client"

import { useCallback, useEffect, useState } from "react"
import { GlassCard } from "@/components/shared/glass-card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  TbChevronDown,
  TbChevronRight,
  TbArrowsSort,
  TbLoader2,
} from "react-icons/tb"

interface TeamCallRow {
  id: string
  full_name: string
  designation?: string
  avatar_url?: string
  total_calls: number
  inbound_calls: number
  outbound_calls: number
  missed_calls: number
  total_duration_seconds: number
  avg_duration_seconds: number
  first_call_at: string | null
  last_call_at: string | null
  calling_window_minutes: number
  unique_numbers: number
  connected_calls: number
  device_name: string | null
  app_version: string | null
  last_heartbeat_at: string | null
  device_stale: boolean
}

interface AiAnalysis {
  summary: string | null
  sentiment: string | null
  coaching: {
    opening?: number
    discovery?: number
    listening?: number
    objection_handling?: number
    product_fit?: number
    next_step_commitment?: number
    followup_quality?: number
    compliance?: number
    talk_ratio?: { rep_pct: number; customer_pct: number }
    missed_opportunities?: string[]
    strengths?: string[]
    overall_recommendation?: string
    detailed_scores?: Record<string, { score: number; evidence: string }>
  } | null
  signals: {
    intent?: string
    objections?: string[]
    decision_makers?: string[]
  } | null
  next_action: {
    type?: string
    due_at?: string
    description?: string
  } | null
}

interface CallLogRow {
  id: string
  client_number: string
  direction: "inbound" | "outbound" | "missed"
  duration_seconds: number
  call_started_at: string
  lead_id: string | null
  recording_url: string | null
  disposition: string | null
  transcript: { summary: string }[] | null
  ai_analysis: AiAnalysis[] | null
}

type SortKey =
  | "full_name"
  | "total_calls"
  | "inbound_calls"
  | "outbound_calls"
  | "missed_calls"
  | "total_duration_seconds"
  | "avg_duration_seconds"
  | "calling_window_minutes"

function fmtDuration(secs: number) {
  if (secs === 0) return "0s"
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function TeamCalls() {
  const [rows, setRows] = useState<TeamCallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [sortKey, setSortKey] = useState<SortKey>("total_calls")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calls/team?date=${date}`)
      if (!res.ok) {
        setRows([])
        return
      }
      const data = await res.json()
      setRows(data.team || [])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "full_name" ? "asc" : "desc")
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  // Aggregated stats
  const totalCalls = rows.reduce((s, r) => s + r.total_calls, 0)
  const totalTalkTime = rows.reduce((s, r) => s + r.total_duration_seconds, 0)
  const totalConnected = rows.reduce((s, r) => s + r.connected_calls, 0)
  const connectedRate =
    totalCalls > 0 ? Math.round((totalConnected / totalCalls) * 100) : 0
  const activeReps = rows.filter((r) => r.total_calls > 0).length

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Calls" value={String(totalCalls)} />
        <StatCard label="Talk Time" value={fmtDuration(totalTalkTime)} />
        <StatCard label="Connected Rate" value={`${connectedRate}%`} />
        <StatCard label="Active Reps" value={String(activeReps)} />
      </div>

      {/* Team table */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Team Call Activity</p>
            <p className="text-[11px] text-muted-foreground/70">
              Per-rep call stats for the selected date
            </p>
          </div>
          <Input
            type="date"
            value={date}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-auto"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <TbLoader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No call data for this date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-6" />
                  <SortableTh label="Name" k="full_name" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Total" k="total_calls" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                  <SortableTh label="In" k="inbound_calls" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                  <SortableTh label="Out" k="outbound_calls" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                  <SortableTh label="Missed" k="missed_calls" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                  <SortableTh label="Talk Time" k="total_duration_seconds" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                  <SortableTh label="Avg Dur." k="avg_duration_seconds" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                  <SortableTh label="Window" k="calling_window_minutes" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                  <th className="py-2 px-2">Device</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <CallRow
                    key={r.id}
                    row={r}
                    date={date}
                    expanded={expanded === r.id}
                    onToggle={() =>
                      setExpanded(expanded === r.id ? null : r.id)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border bg-[#0D1B2A] p-4 shadow-soft backdrop-blur-sm transition-all hover:scale-[1.02]">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

/* ── Sortable header ── */
function SortableTh({
  label,
  k,
  active,
  dir,
  onSort,
  numeric,
}: {
  label: string
  k: SortKey
  active: SortKey
  dir: "asc" | "desc"
  onSort: (k: SortKey) => void
  numeric?: boolean
}) {
  return (
    <th className={`py-2 px-2 ${numeric ? "text-right" : ""}`}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active === k ? "text-foreground font-medium" : ""}`}
      >
        {label}
        <TbArrowsSort className="h-3 w-3 opacity-50" />
        {active === k && (
          <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    </th>
  )
}

/* ── Direction badge ── */
const DIR_STYLE: Record<string, string> = {
  inbound: "bg-blue-100 text-[#00E5FF]",
  outbound: "bg-emerald-100 text-emerald-700",
  missed: "bg-red-100 text-red-700",
}

/* ── Call row with expandable detail ── */
function CallRow({
  row,
  date,
  expanded,
  onToggle,
}: {
  row: TeamCallRow
  date: string
  expanded: boolean
  onToggle: () => void
}) {
  const [detail, setDetail] = useState<CallLogRow[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!expanded || detail) return
    setLoadingDetail(true)

    async function fetchDetail() {
      try {
        const res = await fetch(
          `/api/calls/team?date=${date}&employeeId=${row.id}&detail=true`
        )
        if (res.ok) {
          const data = await res.json()
          setDetail(data.calls ?? [])
        } else {
          setDetail([])
        }
      } finally {
        setLoadingDetail(false)
      }
    }
    fetchDetail()
  }, [expanded, detail, row.id, date])

  return (
    <>
      <tr className="border-b hover:bg-muted/30">
        <td className="py-2 pl-1">
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <TbChevronDown className="h-4 w-4" />
            ) : (
              <TbChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="py-2 px-2">
          <span className="font-medium">{row.full_name}</span>
          {row.designation && (
            <span className="block text-[11px] text-muted-foreground">
              {row.designation}
            </span>
          )}
        </td>
        <td className="py-2 px-2 text-right tabular-nums font-medium">
          {row.total_calls}
        </td>
        <td className="py-2 px-2 text-right tabular-nums">{row.inbound_calls}</td>
        <td className="py-2 px-2 text-right tabular-nums">{row.outbound_calls}</td>
        <td className="py-2 px-2 text-right tabular-nums">{row.missed_calls}</td>
        <td className="py-2 px-2 text-right tabular-nums">
          {fmtDuration(row.total_duration_seconds)}
        </td>
        <td className="py-2 px-2 text-right tabular-nums">
          {fmtDuration(row.avg_duration_seconds)}
        </td>
        <td className="py-2 px-2 text-right tabular-nums">
          {row.calling_window_minutes > 0
            ? `${row.calling_window_minutes}m`
            : "—"}
        </td>
        <td className="py-2 px-2">
          {row.device_name ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${row.device_stale ? "bg-red-400" : "bg-[#34D399]"}`}
                title={
                  row.device_stale
                    ? "Silent >2h during work hours"
                    : "Active"
                }
              />
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {row.device_name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No device</span>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={10} className="p-4">
            {loadingDetail ? (
              <div className="flex justify-center py-4 text-muted-foreground">
                <TbLoader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : !detail || detail.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No individual call records.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground mb-2">
                  Call Log ({detail.length} calls)
                </p>
                {detail.map((c) => {
                  const ai = c.ai_analysis?.[0] ?? null
                  const coaching = ai?.coaching ?? null
                  const hasSummary = !!(ai?.summary || c.transcript?.[0]?.summary)
                  const hasCoaching = !!(coaching?.detailed_scores || coaching?.overall_recommendation)

                  return (
                    <CallDetailCard
                      key={c.id}
                      call={c}
                      ai={ai}
                      coaching={coaching}
                      hasSummary={hasSummary}
                      hasCoaching={hasCoaching}
                    />
                  )
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Coaching score color ── */
function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600"
  if (score >= 5) return "text-amber-600"
  return "text-red-500"
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-emerald-100"
  if (score >= 5) return "bg-amber-100"
  return "bg-red-100"
}

const DIMENSION_LABELS: Record<string, string> = {
  opening: "Opening",
  discovery: "Discovery",
  listening: "Listening",
  objection_handling: "Objection Handling",
  product_fit: "Product Fit",
  next_step_commitment: "Next Step",
  followup_quality: "Follow-up",
  compliance: "Compliance",
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  neutral: "bg-[#1A2B45] text-[#CBD5E1]",
  negative: "bg-red-100 text-red-700",
}

/* ── Call Detail Card ── */
function CallDetailCard({
  call: c,
  ai,
  coaching,
  hasSummary,
  hasCoaching,
}: {
  call: CallLogRow
  ai: AiAnalysis | null
  coaching: AiAnalysis["coaching"]
  hasSummary: boolean
  hasCoaching: boolean
}) {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const summaryText = ai?.summary || c.transcript?.[0]?.summary || null

  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-2">
      {/* Row 1: call meta */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 ${DIR_STYLE[c.direction] ?? ""}`}
          >
            {c.direction}
          </Badge>
          <span className="tabular-nums font-mono">
            {c.client_number}
          </span>
          {c.recording_url && (
            <span className="text-orange-500" title="Has recording">
              &#9679;
            </span>
          )}
          {c.disposition && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${c.disposition === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
            >
              {c.disposition}
            </Badge>
          )}
          {ai?.sentiment && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${SENTIMENT_STYLE[ai.sentiment] ?? "bg-[#1A2B45] text-[#CBD5E1]"}`}
            >
              {ai.sentiment}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>{fmtDuration(c.duration_seconds)}</span>
          <span className="tabular-nums">{fmtTime(c.call_started_at)}</span>
        </div>
      </div>

      {/* Row 2: AI summary */}
      {summaryText && (
        <div className="bg-[#00BCD4]/10 border border-blue-200 rounded-md px-3 py-2">
          <p className="text-[11px] font-medium text-blue-800 mb-0.5">AI Summary</p>
          <p className="text-xs text-[#00E5FF] leading-relaxed">
            {summaryText}
          </p>
        </div>
      )}

      {/* Row 3: Signals — intent & next action */}
      {(ai?.signals?.intent || ai?.next_action?.description) && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {ai?.signals?.intent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              Intent: {ai.signals.intent}
            </span>
          )}
          {ai?.next_action?.description && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
              Next: {ai.next_action.description}
            </span>
          )}
        </div>
      )}

      {/* Row 4: Coaching toggle */}
      {hasCoaching && (
        <div>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showAnalysis ? (
              <TbChevronDown className="h-3 w-3" />
            ) : (
              <TbChevronRight className="h-3 w-3" />
            )}
            Coaching Analysis
          </button>

          {showAnalysis && coaching && (
            <div className="mt-2 space-y-3">
              {/* Score grid */}
              {coaching.detailed_scores && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(coaching.detailed_scores).map(([dim, val]) => (
                    <div key={dim} className={`rounded-md px-2 py-1.5 ${scoreBg(val.score)}`}>
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {DIMENSION_LABELS[dim] ?? dim}
                      </p>
                      <p className={`text-sm font-bold ${scoreColor(val.score)}`}>
                        {val.score}/10
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {val.evidence}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Talk ratio */}
              {coaching.talk_ratio && (
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-muted-foreground">Talk ratio:</span>
                  <span className="font-medium">Rep {coaching.talk_ratio.rep_pct}%</span>
                  <div className="flex-1 h-2 bg-[#1A2B45] rounded-full overflow-hidden max-w-[200px]">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${coaching.talk_ratio.rep_pct}%` }}
                    />
                  </div>
                  <span className="font-medium">Customer {coaching.talk_ratio.customer_pct}%</span>
                </div>
              )}

              {/* Strengths & missed opportunities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {coaching.strengths && coaching.strengths.length > 0 && (
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <p className="text-[10px] font-semibold text-emerald-700 mb-1">Strengths</p>
                    <ul className="text-[11px] text-emerald-700 space-y-0.5">
                      {coaching.strengths.map((s, i) => (
                        <li key={i}>+ {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.missed_opportunities && coaching.missed_opportunities.length > 0 && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                    <p className="text-[10px] font-semibold text-amber-700 mb-1">Missed Opportunities</p>
                    <ul className="text-[11px] text-amber-700 space-y-0.5">
                      {coaching.missed_opportunities.map((m, i) => (
                        <li key={i}>- {m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Overall recommendation */}
              {coaching.overall_recommendation && (
                <div className="rounded-md bg-indigo-50 border border-indigo-200 px-3 py-2">
                  <p className="text-[10px] font-semibold text-indigo-700 mb-0.5">Recommendation</p>
                  <p className="text-[11px] text-indigo-700">{coaching.overall_recommendation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Device Health Panel ── */
interface DeviceHealthRow {
  id: string
  device_id: string
  device_name: string | null
  os_version: string | null
  app_version: string | null
  last_heartbeat_at: string | null
  is_active: boolean
  employee_name: string
  stale: boolean
}

export function DeviceHealthPanel() {
  const [devices, setDevices] = useState<DeviceHealthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/calls/device-health")
      .then((r) => r.json())
      .then((d) => setDevices(d.devices ?? []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false))
  }, [])

  const staleCount = devices.filter((d) => d.stale).length

  return (
    <GlassCard>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <p className="text-sm font-semibold">
            Device Health
            {staleCount > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px]">
                {staleCount} stale
              </Badge>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            {devices.length} registered device{devices.length !== 1 ? "s" : ""}
          </p>
        </div>
        {open ? (
          <TbChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <TbChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <TbLoader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No devices registered.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 px-2">Employee</th>
                  <th className="py-2 px-2">Device</th>
                  <th className="py-2 px-2">OS</th>
                  <th className="py-2 px-2">App Version</th>
                  <th className="py-2 px-2">Last Sync</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium">
                      {d.employee_name}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {d.device_name ?? d.device_id}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {d.os_version ?? "—"}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {d.app_version ?? "—"}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-muted-foreground">
                      {d.last_heartbeat_at
                        ? new Date(d.last_heartbeat_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </td>
                    <td className="py-2 px-2">
                      {d.stale ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Stale
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          OK
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </GlassCard>
  )
}
