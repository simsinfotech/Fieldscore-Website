"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { TbLoader2, TbPlus, TbCircleCheck, TbCopy } from "react-icons/tb"
import { toast } from "sonner"
import type { LeaveBalance, LeaveRequest } from "@/types"

interface LeaveRequestFormProps {
  balance: LeaveBalance | null
  onSuccess: () => void
  editRequest?: LeaveRequest | null
  onEditClose?: () => void
}

export function LeaveRequestForm({ balance, onSuccess, editRequest, onEditClose }: LeaveRequestFormProps) {
  const [open, setOpen] = useState(false)
  const [leaveType, setLeaveType] = useState<string>("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [submittedRef, setSubmittedRef] = useState<string | null>(null)
  const { employee } = useUser()
  const supabase = createClient()

  const isEditMode = !!editRequest

  // Open dialog and pre-fill form when editRequest is set
  useEffect(() => {
    if (editRequest) {
      setLeaveType(editRequest.leave_type)
      setStartDate(editRequest.start_date)
      setEndDate(editRequest.end_date)
      setReason(editRequest.reason ?? "")
      setSubmittedRef(null)
      setOpen(true)
    }
  }, [editRequest])

  function resetForm() {
    setLeaveType("")
    setStartDate("")
    setEndDate("")
    setReason("")
    setSubmittedRef(null)
  }

  function handleOpenChange(o: boolean) {
    setOpen(o)
    if (!o) {
      resetForm()
      onEditClose?.()
    }
  }

  function getRemaining(type: string): number {
    if (!balance) return 0
    switch (type) {
      case "casual":
        return balance.casual_total - balance.casual_used
      case "sick":
        return balance.sick_total - balance.sick_used
      case "earned":
        return balance.earned_total - balance.earned_used
      default:
        return 0
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee || !leaveType || !startDate || !endDate) return

    const days =
      Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1

    // For edit mode, add back the days from the original request when checking balance
    const originalDays = isEditMode
      ? Math.ceil(
          (new Date(editRequest!.end_date).getTime() - new Date(editRequest!.start_date).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : 0
    const isSameType = isEditMode && editRequest!.leave_type === leaveType
    const effectiveRemaining = getRemaining(leaveType) + (isSameType ? originalDays : 0)

    if (days > effectiveRemaining) {
      toast.error("Insufficient leave balance")
      return
    }

    setLoading(true)

    if (isEditMode) {
      const { error } = await supabase
        .from("fs_leave_requests")
        .update({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        })
        .eq("id", editRequest!.id)
        .eq("status", "pending")

      if (error) {
        toast.error("Failed to update request")
      } else {
        toast.success(`Leave request ${editRequest!.reference} updated`)
        onSuccess()
        setOpen(false)
        resetForm()
        onEditClose?.()
      }
    } else {
      const { data, error } = await supabase
        .from("fs_leave_requests")
        .insert({
          employee_id: employee.id,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        })
        .select("reference")
        .single()

      if (error || !data) {
        toast.error("Failed to submit request")
      } else {
        toast.success(`Leave request ${data.reference} submitted!`)
        setSubmittedRef(data.reference)
        onSuccess()
      }
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isEditMode && (
        <DialogTrigger asChild>
          <Button>
            <TbPlus className="mr-2 h-4 w-4" />
            Request Leave
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {submittedRef
              ? "Request submitted"
              : isEditMode
                ? `Edit ${editRequest!.reference}`
                : "New Leave Request"}
          </DialogTitle>
        </DialogHeader>

        {submittedRef ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00BCD4]/10">
              <TbCircleCheck className="h-7 w-7 text-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Your request was sent to your admin for review. Keep this
                reference number to track it:
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="rounded-full bg-secondary px-4 py-1.5 font-mono text-base font-semibold tracking-tight text-foreground">
                  {submittedRef}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(submittedRef)
                    toast.success("Reference copied")
                  }}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Copy reference number"
                >
                  <TbCopy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
            >
              Done
            </Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select value={leaveType} onValueChange={(v) => v !== null && setLeaveType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">
                  Casual ({getRemaining("casual")} remaining)
                </SelectItem>
                <SelectItem value="sick">
                  Sick ({getRemaining("sick")} remaining)
                </SelectItem>
                <SelectItem value="earned">
                  Earned ({getRemaining("earned")} remaining)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for leave..."
              rows={3}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? "Update Request" : "Submit Request"}
          </Button>
        </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
