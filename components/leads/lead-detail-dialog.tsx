"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { TbPhone, TbBrandWhatsapp, TbNote, TbLoader2, TbClockHour4 } from "react-icons/tb"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import type { Lead, LeadActivity } from "@/types"

// The 6 outcome statuses the setters use (site_visit/negotiation hidden).
const STATUS_OPTIONS: { value: string; label: string; cls: string }[] = [
  { value: "new", label: "New", cls: "border-border text-foreground" },
  { value: "contacted", label: "Contacted", cls: "border-border text-foreground" },
  { value: "qualified", label: "Interested", cls: "border-border text-foreground" },
  { value: "won", label: "Won", cls: "border-border text-foreground" },
  { value: "lost", label: "Lost", cls: "border-border text-foreground" },
  { value: "junk", label: "Not Interested", cls: "border-border text-foreground" },
]

const CALL_OUTCOMES = ["Connected", "No answer", "Callback", "Wrong number", "Not interested"]

export function LeadDetailDialog({
  lead, open, onClose, onUpdated, canEdit,
}: {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  canEdit: boolean
}) {
  const [status, setStatus] = useState<string>(lead?.status ?? "new")
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [logType, setLogType] = useState<"call" | "whatsapp" | "note">("call")
  const [logOutcome, setLogOutcome] = useState("Connected")
  const [logBody, setLogBody] = useState("")
  const [logging, setLogging] = useState(false)

  const fetchActivity = useCallback(async () => {
    if (!lead) return
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/activity`)
      if (res.ok) setActivities((await res.json()).activities || [])
    } finally {
      setLoading(false)
    }
  }, [lead])

  useEffect(() => {
    if (open && lead) {
      setStatus(lead.status)
      setLogBody("")
      fetchActivity()
    }
  }, [open, lead, fetchActivity])

  async function changeStatus(next: string) {
    if (!lead || next === status) return
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "Failed to update status")
        return
      }
      setStatus(next)
      toast.success("Status updated")
      fetchActivity()
      onUpdated()
    } finally {
      setSavingStatus(false)
    }
  }

  async function logActivity() {
    if (!lead) return
    const body = logType === "call" ? `[${logOutcome}] ${logBody}`.trim() : logBody.trim()
    if (!body) { toast.error("Add a note about what happened"); return }
    setLogging(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: logType, body }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "Failed to log")
        return
      }
      setLogBody("")
      fetchActivity()
    } finally {
      setLogging(false)
    }
  }

  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {lead.full_name}
            {lead.source_label && <Badge variant="outline">{lead.source_label}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p>{lead.phone_e164}</p>
            {lead.email && <p>{lead.email}</p>}
            {lead.city && <p>{lead.city}</p>}
          </div>

          {/* Outcome status */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Outcome</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  disabled={!canEdit || savingStatus}
                  onClick={() => changeStatus(s.value)}
                  className={`rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    status === s.value ? `${s.cls} bg-[#00BCD4] text-white ring-1 ring-border` : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Log a contact attempt */}
          {canEdit && (
            <div className="space-y-2 rounded-2xl border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Log activity</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={logType} onValueChange={(v) => v && setLogType(v as "call" | "whatsapp" | "note")}>
                  <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
                {logType === "call" && (
                  <Select value={logOutcome} onValueChange={(v) => v && setLogOutcome(v)}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CALL_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Textarea rows={2} value={logBody} onChange={(e) => setLogBody(e.target.value)} placeholder="What happened?" />
              <Button size="sm" onClick={logActivity} disabled={logging} className="w-full">
                {logging ? <TbLoader2 className="h-4 w-4 animate-spin" /> : "Add to timeline"}
              </Button>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Activity</p>
            {loading ? (
              <div className="flex justify-center py-4 text-muted-foreground"><TbLoader2 className="h-4 w-4 animate-spin" /></div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-2 text-sm">
                    <div className="mt-0.5 text-muted-foreground">
                      {a.type === "call" ? <TbPhone className="h-4 w-4" /> : a.type === "whatsapp" ? <TbBrandWhatsapp className="h-4 w-4" /> : a.type === "status_change" ? <TbClockHour4 className="h-4 w-4" /> : <TbNote className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground break-words">{a.body}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.actor?.full_name ?? "System"} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
