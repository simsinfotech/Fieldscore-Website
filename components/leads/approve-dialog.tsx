"use client"

import { useEffect, useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { TbLoader2, TbCheck } from "react-icons/tb"
import { toast } from "sonner"

interface Setter { id: string; full_name: string }

/**
 * Manager approves pending leads → round-robin split to setters, with an
 * optional PRIVATE instruction note per setter (each only sees their own).
 */
export function ApproveDialog({
  open, count, onClose, onDone,
}: {
  open: boolean
  count: number
  onClose: () => void
  onDone: () => void
}) {
  const [setters, setSetters] = useState<Setter[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/leads/assign/setters")
      .then((r) => r.json())
      .then((d) => setSetters(d.setters || []))
      .finally(() => setLoading(false))
  }, [open])

  async function approve() {
    setSaving(true)
    try {
      const res = await fetch("/api/leads/assign/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Failed"); return }
      toast.success(`Distributed ${data.distributed} lead(s) to ${data.setters} setter(s)`)
      setNotes({})
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve &amp; distribute {count} lead(s)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Leads split evenly (round-robin) across your setters. Add an optional
            instruction — <b>each setter only sees their own note</b>.
          </p>
          {loading ? (
            <div className="flex justify-center py-4 text-muted-foreground"><TbLoader2 className="h-4 w-4 animate-spin" /></div>
          ) : setters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active setters report to you — add setters in Team first.</p>
          ) : (
            <div className="space-y-3">
              {setters.map((s) => (
                <div key={s.id} className="space-y-1.5">
                  <Label className="text-sm">Note to {s.full_name}</Label>
                  <Textarea
                    rows={2}
                    value={notes[s.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                    placeholder="Optional instructions…"
                  />
                </div>
              ))}
            </div>
          )}
          <Button onClick={approve} disabled={saving || setters.length === 0} className="w-full bg-[#00BCD4] text-white hover:bg-[#2563EB]">
            {saving ? <TbLoader2 className="h-4 w-4 animate-spin mr-2" /> : <TbCheck className="h-4 w-4 mr-2" />}
            Approve &amp; distribute
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
