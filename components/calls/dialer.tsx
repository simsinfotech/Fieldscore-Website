"use client"

import { useCallback, useEffect, useState } from "react"
import { GlassCard } from "@/components/shared/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  TbPhone,
  TbBackspace,
  TbSearch,
  TbLoader2,
  TbChevronLeft,
  TbChevronRight,
  TbPhoneOutgoing,
  TbPhoneIncoming,
  TbPhoneOff,
  TbX,
} from "react-icons/tb"

/* ── Types ── */
interface CallLogRow {
  id: string
  client_number: string
  direction: "inbound" | "outbound" | "missed"
  duration_seconds: number
  call_started_at: string
  ingest_source: string
  lead_id: string | null
}

interface CallDailySummary {
  total_calls: number
  inbound_calls: number
  outbound_calls: number
  missed_calls: number
  total_duration_seconds: number
  connected_calls: number
}

interface LeadResult {
  id: string
  full_name: string
  phone_e164: string
  phone_raw?: string
  status: string
  project?: string
  city?: string
}

/* ── Helpers ── */
function fmtDuration(secs: number) {
  if (secs === 0) return "0s"
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

function displayDate(dateStr: string) {
  const today = todayStr()
  if (dateStr === today) return "Today"
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (dateStr === y.toISOString().split("T")[0]) return "Yesterday"
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

const DIR_STYLE: Record<string, string> = {
  inbound: "bg-blue-100 text-[#00E5FF]",
  outbound: "bg-emerald-100 text-emerald-700",
  missed: "bg-red-100 text-red-700",
}

const DIR_ICON: Record<string, React.ReactNode> = {
  inbound: <TbPhoneIncoming className="h-3.5 w-3.5" />,
  outbound: <TbPhoneOutgoing className="h-3.5 w-3.5" />,
  missed: <TbPhoneOff className="h-3.5 w-3.5" />,
}

/* ── Numpad Digits ── */
const NUMPAD_ROWS = [
  [
    { digit: "1", sub: "" },
    { digit: "2", sub: "ABC" },
    { digit: "3", sub: "DEF" },
  ],
  [
    { digit: "4", sub: "GHI" },
    { digit: "5", sub: "JKL" },
    { digit: "6", sub: "MNO" },
  ],
  [
    { digit: "7", sub: "PQRS" },
    { digit: "8", sub: "TUV" },
    { digit: "9", sub: "WXYZ" },
  ],
  [
    { digit: "*", sub: "" },
    { digit: "0", sub: "+" },
    { digit: "#", sub: "" },
  ],
]

/* ═══════════════════════════════════════════════
   Main Dialer Component
   ═══════════════════════════════════════════════ */

export function Dialer() {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  const handleDigit = useCallback((d: string) => {
    setPhoneNumber((prev) => prev + d)
  }, [])

  const handleDelete = useCallback(() => {
    setPhoneNumber((prev) => prev.slice(0, -1))
  }, [])

  const handleCall = useCallback(() => {
    if (!phoneNumber.trim()) return
    window.location.href = `tel:${phoneNumber.replace(/[^\d+*#]/g, "")}`
  }, [phoneNumber])

  const handleSelectLead = useCallback((lead: LeadResult) => {
    setPhoneNumber(lead.phone_e164)
    setShowSearch(false)
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Left column: Dialer */}
      <div className="space-y-4">
        {/* Phone input */}
        <GlassCard className="text-center">
          <div className="mb-4">
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter number"
              className="w-full text-center text-2xl font-light tracking-[3px] text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Numpad */}
          <div className="space-y-2 mb-4">
            {NUMPAD_ROWS.map((row, i) => (
              <div key={i} className="flex justify-center gap-3">
                {row.map(({ digit, sub }) => (
                  <button
                    key={digit}
                    onClick={() => handleDigit(digit)}
                    className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors active:scale-95"
                  >
                    <span className="text-xl font-medium text-foreground leading-none">
                      {digit}
                    </span>
                    {sub && (
                      <span className="text-[9px] tracking-wider text-muted-foreground leading-none mt-0.5">
                        {sub}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => setShowSearch(!showSearch)}
              title="Search leads"
            >
              <TbSearch className="h-5 w-5" />
            </Button>

            <button
              onClick={handleCall}
              disabled={!phoneNumber.trim()}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-soft hover:bg-[#15803d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              <TbPhone className="h-6 w-6" />
            </button>

            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={handleDelete}
              title="Delete"
            >
              <TbBackspace className="h-5 w-5" />
            </Button>
          </div>
        </GlassCard>

        {/* Lead search */}
        {showSearch && (
          <LeadSearch
            onSelect={handleSelectLead}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>

      {/* Right column: Call log */}
      <MyCallLog
        onCallNumber={(num) => {
          setPhoneNumber(num)
          window.scrollTo({ top: 0, behavior: "smooth" })
        }}
      />
    </div>
  )
}

/* ── Lead Search Panel ── */
function LeadSearch({
  onSelect,
  onClose,
}: {
  onSelect: (lead: LeadResult) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [leads, setLeads] = useState<LeadResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim() && query.length === 0) {
        // Load initial leads
        setLoading(true)
        try {
          const res = await fetch("/api/calls/my-leads?limit=20")
          if (res.ok) {
            const data = await res.json()
            setLeads(data.leads ?? [])
          }
        } finally {
          setLoading(false)
        }
        return
      }

      if (query.trim().length < 2) return

      setLoading(true)
      try {
        const res = await fetch(
          `/api/calls/my-leads?q=${encodeURIComponent(query.trim())}&limit=20`
        )
        if (res.ok) {
          const data = await res.json()
          setLeads(data.leads ?? [])
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Load initial leads on mount
  useEffect(() => {
    setLoading(true)
    fetch("/api/calls/my-leads?limit=20")
      .then((r) => r.json())
      .then((data) => setLeads(data.leads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <TbSearch className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search leads by name or phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
          autoFocus
        />
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <TbX className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-6">
            <TbLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && leads.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {query ? "No leads found" : "No leads assigned"}
          </p>
        )}

        {!loading &&
          leads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => onSelect(lead)}
              className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {lead.full_name}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] capitalize"
                >
                  {lead.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">
                  {lead.phone_e164}
                </span>
                {lead.project && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">
                      {lead.project}
                    </span>
                  </>
                )}
              </div>
            </button>
          ))}
      </div>
    </GlassCard>
  )
}

/* ── My Call Log ── */
function MyCallLog({ onCallNumber }: { onCallNumber: (num: string) => void }) {
  const [date, setDate] = useState(todayStr)
  const [calls, setCalls] = useState<CallLogRow[]>([])
  const [summary, setSummary] = useState<CallDailySummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calls/my-log?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setCalls(data.calls ?? [])
        setSummary(data.summary ?? null)
      } else {
        setCalls([])
        setSummary(null)
      }
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  function navDate(dir: -1 | 1) {
    const d = new Date(date + "T00:00:00")
    d.setDate(d.getDate() + dir)
    if (d > new Date()) return
    setDate(d.toISOString().split("T")[0])
  }

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">My Call Log</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => navDate(-1)}
          >
            <TbChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[100px] text-center">
            {displayDate(date)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => navDate(1)}
            disabled={date === todayStr()}
          >
            <TbChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatMini label="Total" value={String(summary.total_calls)} />
          <StatMini
            label="Connected"
            value={String(summary.connected_calls)}
            color="text-emerald-600"
          />
          <StatMini
            label="Missed"
            value={String(summary.missed_calls)}
            color="text-red-500"
          />
          <StatMini
            label="Talk Time"
            value={fmtDuration(summary.total_duration_seconds)}
            color="text-[#00E5FF]"
          />
        </div>
      )}

      {/* Call list */}
      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <TbLoader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TbPhone className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              No calls on {displayDate(date)}
            </p>
          </div>
        ) : (
          <div>
            <div className="px-4 py-2 border-b border-border">
              <p className="text-[11px] text-muted-foreground">
                {calls.length} call{calls.length !== 1 ? "s" : ""}
              </p>
            </div>
            {calls.map((c) => (
              <button
                key={c.id}
                onClick={() => onCallNumber(c.client_number)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors border-b border-border/50 last:border-0 text-left"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${DIR_STYLE[c.direction] ?? "bg-secondary"}`}
                >
                  {DIR_ICON[c.direction]}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground font-mono block truncate">
                    {c.client_number}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {c.direction} · {fmtDuration(c.duration_seconds)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {fmtTime(c.call_started_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

/* ── Mini stat card ── */
function StatMini({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-[#0D1B2A] p-3 text-center">
      <p className={`text-lg font-semibold tabular-nums ${color ?? "text-foreground"}`}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
