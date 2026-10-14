"use client"

import { useCallback, useEffect, useState } from "react"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ActivityHeatmapStrip } from "@/components/attendance/activity-heatmap"
import {
  TbChevronDown,
  TbChevronRight,
  TbArrowsSort,
  TbLoader2,
  TbAdjustments,
} from "react-icons/tb"
import { toast } from "sonner"

interface TeamRow {
  id: string
  full_name: string
  designation?: string
  avatar_url?: string
  liveStatus: "online" | "offline" | "checked_out"
  activeMinutes: number
  idleMinutes: number
  utilisation: number
  status: string
  flags: string[]
  buckets: string[]
}

interface SessionRow {
  id: string
  started_at: string
  ended_at: string | null
  end_reason: string | null
}

type SortKey = "full_name" | "activeMinutes" | "idleMinutes" | "status"

function fmt(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

// ISO <-> <input type="datetime-local"> value (local time)
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TeamActivity() {
  const [rows, setRows] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [sortKey, setSortKey] = useState<SortKey>("activeMinutes")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance/team?date=${date}`)
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
      setSortDir(key === "full_name" || key === "status" ? "asc" : "desc")
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Team Activity</p>
          <p className="text-[11px] text-muted-foreground/70">
            Active vs away time, with anomaly flags
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
          Nobody has checked in on this date.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-6" />
                <SortableTh label="Name" k="full_name" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="py-2 px-2">Live</th>
                <SortableTh label="Hours" k="activeMinutes" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                <SortableTh label="Idle" k="idleMinutes" active={sortKey} dir={sortDir} onSort={toggleSort} numeric />
                <SortableTh label="Status" k="status" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="py-2 px-2 min-w-[200px]">Activity</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <TeamActivityRow
                  key={r.id}
                  row={r}
                  date={date}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  onOverride={fetchTeam}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

function SortableTh({
  label, k, active, dir, onSort, numeric,
}: {
  label: string; k: SortKey; active: SortKey; dir: "asc" | "desc"
  onSort: (k: SortKey) => void; numeric?: boolean
}) {
  return (
    <th className={`py-2 px-2 ${numeric ? "text-right" : ""}`}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active === k ? "text-foreground font-medium" : ""}`}
      >
        {label}
        <TbArrowsSort className="h-3 w-3 opacity-50" />
        {active === k && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  )
}

const STATUS_COLOR: Record<string, string> = {
  online: "bg-[#34D399]",
  checked_out: "bg-[#0F172A]",
  offline: "bg-slate-300",
}

function TeamActivityRow({
  row, date, expanded, onToggle, onOverride,
}: {
  row: TeamRow; date: string; expanded: boolean; onToggle: () => void; onOverride: () => void
}) {
  const [detail, setDetail] = useState<{ buckets: string[]; sessions: SessionRow[] } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editSession, setEditSession] = useState<SessionRow | null>(null)

  useEffect(() => {
    if (!expanded || detail) return
    setLoadingDetail(true)
    fetch(`/api/attendance/activity?employeeId=${row.id}&date=${date}`)
      .then((r) => r.json())
      .then((d) => setDetail({ buckets: d.buckets || [], sessions: d.sessions || [] }))
      .finally(() => setLoadingDetail(false))
  }, [expanded, detail, row.id, date])

  return (
    <>
      <tr className="border-b hover:bg-muted/30">
        <td className="py-2 pl-1">
          <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
            {expanded ? <TbChevronDown className="h-4 w-4" /> : <TbChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="py-2 px-2">
          <span className="font-medium">{row.full_name}</span>
          {row.designation && (
            <span className="block text-[11px] text-muted-foreground">{row.designation}</span>
          )}
        </td>
        <td className="py-2 px-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLOR[row.liveStatus]}`} title={row.liveStatus} />
        </td>
        <td className="py-2 px-2 text-right tabular-nums text-foreground font-medium">{fmt(row.activeMinutes)}</td>
        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{fmt(row.idleMinutes)}</td>
        <td className="py-2 px-2 capitalize">{row.status.replace("_", " ")}</td>
        <td className="py-2 px-2">
          <ActivityHeatmapStrip buckets={row.buckets} compact />
        </td>
      </tr>

      {expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={7} className="p-4">
            {loadingDetail ? (
              <div className="flex justify-center py-4 text-muted-foreground">
                <TbLoader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">Sessions</p>
                  {(detail?.sessions.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">No sessions.</p>
                  ) : (
                    <div className="space-y-1">
                      {detail!.sessions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-xs">
                          <span className="tabular-nums">
                            {new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" → "}
                            {s.ended_at
                              ? new Date(s.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "open"}
                            {s.end_reason && <span className="text-muted-foreground"> ({s.end_reason})</span>}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => setEditSession(s)}>
                            <TbAdjustments className="h-3.5 w-3.5 mr-1" /> Adjust
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}

      <OverrideDialog
        session={editSession}
        onClose={() => setEditSession(null)}
        onSaved={() => {
          setEditSession(null)
          setDetail(null)
          onOverride()
        }}
      />
    </>
  )
}

function OverrideDialog({
  session, onClose, onSaved,
}: {
  session: SessionRow | null; onClose: () => void; onSaved: () => void
}) {
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session) {
      setStart(toLocalInput(session.started_at))
      setEnd(toLocalInput(session.ended_at))
      setReason("")
    }
  }, [session])

  async function save() {
    if (!session) return
    if (!reason.trim()) {
      toast.error("A reason is required")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, string> = { reason: reason.trim() }
      if (start) body.started_at = new Date(start).toISOString()
      if (end) body.ended_at = new Date(end).toISOString()
      const res = await fetch(`/api/attendance/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "Failed to adjust session")
        return
      }
      toast.success("Session adjusted")
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!session} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust session times</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Start</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End</Label>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Reason <span className="text-muted-foreground">(required, audited)</span></Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being adjusted?" />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <TbLoader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save adjustment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
