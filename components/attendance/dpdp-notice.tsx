"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DpdpPolicyText } from "@/components/attendance/dpdp-policy"
import { TbLoader2, TbShieldCheck } from "react-icons/tb"

/**
 * One-time DPDP notice shown on first login after the activity tracker
 * launches. Records an acknowledgement and won't show again for the
 * current policy version. Mounted once from the dashboard layout.
 */
export function DpdpNotice() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/attendance/dpdp")
      .then((r) => (r.ok ? r.json() : { acknowledged: true }))
      .then((d) => {
        if (!cancelled && d.acknowledged === false) setOpen(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function acknowledge() {
    setSaving(true)
    try {
      await fetch("/api/attendance/dpdp", { method: "POST" })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // Non-dismissible: acknowledgement is required.
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TbShieldCheck className="h-5 w-5 text-foreground" />
            Activity &amp; Attendance Notice
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <DpdpPolicyText />
        </div>
        <Button onClick={acknowledge} disabled={saving} className="w-full">
          {saving ? <TbLoader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          I understand
        </Button>
      </DialogContent>
    </Dialog>
  )
}
