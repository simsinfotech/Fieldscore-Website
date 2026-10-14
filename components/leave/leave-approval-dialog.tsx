"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TbCheck, TbX, TbLoader2 } from "react-icons/tb"
import { toast } from "sonner"
import { format } from "date-fns"
import type { LeaveRequest } from "@/types"

interface LeaveApprovalDialogProps {
  request: LeaveRequest | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function LeaveApprovalDialog({
  request,
  open,
  onClose,
  onSuccess,
}: LeaveApprovalDialogProps) {
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const { employee } = useUser()
  const supabase = createClient()

  const [rejectError, setRejectError] = useState("")

  async function handleAction(status: "approved" | "rejected") {
    if (!request || !employee) return
    if (status === "rejected" && !notes.trim()) {
      setRejectError("Please provide a reason for rejection")
      return
    }
    setRejectError("")
    setLoading(true)

    const { error } = await supabase
      .from("fs_leave_requests")
      .update({
        status,
        reviewed_by: employee.id,
        review_notes: notes || null,
      })
      .eq("id", request.id)

    if (error) {
      toast.error("Failed to update request")
      setLoading(false)
      return
    }

    // If approved, update leave balance
    if (status === "approved") {
      const days =
        Math.ceil(
          (new Date(request.end_date).getTime() -
            new Date(request.start_date).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1

      const usedField = `${request.leave_type}_used`
      const { data: balance } = await supabase
        .from("fs_leave_balances")
        .select("*")
        .eq("employee_id", request.employee_id)
        .eq("year", new Date().getFullYear())
        .single()

      if (balance) {
        await supabase
          .from("fs_leave_balances")
          .update({ [usedField]: (balance as any)[usedField] + days })
          .eq("id", balance.id)
      }
    }

    // Send notification — include the reference number and the admin's note.
    const noteSuffix = notes.trim() ? ` Note: ${notes.trim()}` : ""
    await supabase.from("fs_notifications").insert({
      recipient_id: request.employee_id,
      type: "leave_" + status,
      title: `Leave ${status === "approved" ? "Approved" : "Rejected"}`,
      message: `Your ${request.leave_type} leave (${request.reference}) from ${format(
        new Date(request.start_date),
        "MMM d"
      )} to ${format(new Date(request.end_date), "MMM d")} has been ${status}.${noteSuffix}`,
      link: "/leave",
    })

    toast.success(`Leave request ${status}`)
    setNotes("")
    onClose()
    onSuccess()
    setLoading(false)
  }

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Leave Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Reference</span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs font-semibold text-foreground">
              {request.reference}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Employee</p>
              <p className="font-medium">{request.employee?.full_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium capitalize">{request.leave_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">From</p>
              <p className="font-medium">
                {format(new Date(request.start_date), "MMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">To</p>
              <p className="font-medium">
                {format(new Date(request.end_date), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          {request.reason && (
            <div className="text-sm">
              <p className="text-muted-foreground">Reason</p>
              <p>{request.reason}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Notes <span className="text-muted-foreground">(required for rejection)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setRejectError("") }}
              placeholder="Add notes or reason for rejection..."
              rows={2}
              className={rejectError ? "border-border focus:border-border" : ""}
            />
            {rejectError && (
              <p className="text-xs text-destructive">{rejectError}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => handleAction("approved")}
              disabled={loading}
              className="flex-1 bg-[#00BCD4] text-white hover:bg-[#2563EB]"
            >
              {loading ? (
                <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TbCheck className="mr-2 h-4 w-4" />
              )}
              Approve
            </Button>
            <Button
              onClick={() => handleAction("rejected")}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              {loading ? (
                <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TbX className="mr-2 h-4 w-4" />
              )}
              Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
