"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TbPlus, TbLoader2, TbStar } from "react-icons/tb"
import { toast } from "sonner"
import type { Appraisal, Employee } from "@/types"

export default function AppraisalsPage() {
  const { employee, isAdmin } = useUser()
  const orgId = useOrg()
  const supabase = createClient()

  const [appraisals, setAppraisals] = useState<Appraisal[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [editAppraisal, setEditAppraisal] = useState<Appraisal | null>(null)

  useEffect(() => {
    if (!employee) return
    fetchData()
  }, [employee?.id, orgId])

  async function fetchData() {
    let query = supabase
      .from("fs_appraisals")
      .select("*, employee:fs_employees(*)")
      .order("created_at", { ascending: false })

    if (!isAdmin) {
      query = query.eq("employee_id", employee!.id)
    }

    const { data } = await query
    if (data) {
      const filtered = isAdmin
        ? data.filter((a: any) => a.employee?.org_id === orgId)
        : data
      setAppraisals(filtered as unknown as Appraisal[])
    }

    if (isAdmin) {
      const { data: emps } = await supabase
        .from("fs_employees")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
      if (emps) setEmployees(emps as unknown as Employee[])
    }
  }

  const statusStyles: Record<string, string> = {
    pending_self: "bg-[#EDE9FE] text-foreground rounded-full",
    pending_manager: "bg-[#00BCD4]/25 text-[#1E40AF] rounded-full",
    completed: "bg-[#DBEAFE] text-foreground rounded-full",
  }

  const statusLabels: Record<string, string> = {
    pending_self: "Self Review",
    pending_manager: "Manager Review",
    completed: "Completed",
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Appraisals" description="Performance appraisal cycles">
        {isAdmin && (
          <NewAppraisalDialog employees={employees} onSuccess={fetchData} />
        )}
      </PageHeader>

      <div className="space-y-4">
        {appraisals.length === 0 ? (
          <GlassCard>
            <p className="text-center text-muted-foreground py-8">
              No appraisals found
            </p>
          </GlassCard>
        ) : (
          appraisals.map((a) => (
            <GlassCard key={a.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{a.cycle}</h3>
                  {isAdmin && a.employee && (
                    <p className="text-sm text-muted-foreground">
                      {a.employee.full_name}
                    </p>
                  )}
                </div>
                <Badge className={statusStyles[a.status]}>
                  {statusLabels[a.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Self Review */}
                <div className="p-3 rounded-2xl bg-secondary/60 border border-border">
                  <p className="text-xs text-muted-foreground mb-2">Self Rating</p>
                  {a.self_rating != null ? (
                    <>
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <TbStar
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < Math.round(a.self_rating!)
                                ? "text-[#00E5FF] fill-[#00BCD4]"
                                : "text-slate-300"
                            }`}
                          />
                        ))}
                        <span className="text-sm ml-1">{a.self_rating}/5</span>
                      </div>
                      {a.self_comments && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {a.self_comments}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Pending</p>
                  )}
                </div>

                {/* Manager Review */}
                <div className="p-3 rounded-2xl bg-secondary/60 border border-border">
                  <p className="text-xs text-muted-foreground mb-2">Manager Rating</p>
                  {a.manager_rating != null ? (
                    <>
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <TbStar
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < Math.round(a.manager_rating!)
                                ? "text-[#00E5FF] fill-[#00BCD4]"
                                : "text-slate-300"
                            }`}
                          />
                        ))}
                        <span className="text-sm ml-1">{a.manager_rating}/5</span>
                      </div>
                      {a.manager_comments && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {a.manager_comments}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Pending</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {!isAdmin && a.status === "pending_self" && (
                <Button
                  size="sm"
                  onClick={() => setEditAppraisal(a)}
                >
                  Submit Self Review
                </Button>
              )}
              {isAdmin && a.status === "pending_manager" && (
                <Button
                  size="sm"
                  onClick={() => setEditAppraisal(a)}
                >
                  Submit Manager Review
                </Button>
              )}
            </GlassCard>
          ))
        )}
      </div>

      {/* Self/Manager Review Dialog */}
      {editAppraisal && (
        <ReviewDialog
          appraisal={editAppraisal}
          isManager={isAdmin}
          open={!!editAppraisal}
          onClose={() => setEditAppraisal(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}

function ReviewDialog({
  appraisal,
  isManager,
  open,
  onClose,
  onSuccess,
}: {
  appraisal: Appraisal
  isManager: boolean
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState("")
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return
    setLoading(true)

    const updates = isManager
      ? {
          manager_rating: rating,
          manager_comments: comments || null,
          status: "completed",
        }
      : {
          self_rating: rating,
          self_comments: comments || null,
          status: "pending_manager",
        }

    const { error } = await supabase
      .from("fs_appraisals")
      .update(updates)
      .eq("id", appraisal.id)

    if (error) {
      toast.error("Failed to submit review")
    } else {
      toast.success("Review submitted!")
      onClose()
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isManager ? "Manager" : "Self"} Review — {appraisal.cycle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRating(v)}
                  className="p-1"
                >
                  <TbStar
                    className={`h-7 w-7 transition-colors ${
                      v <= rating
                        ? "text-[#00E5FF] fill-[#00BCD4]"
                        : "text-slate-300 hover:text-[#00E5FF]"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={
                isManager
                  ? "Manager's feedback and observations..."
                  : "Reflect on your performance..."
              }
              rows={4}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !rating}>
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewAppraisalDialog({
  employees,
  onSuccess,
}: {
  employees: Employee[]
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [cycle, setCycle] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cycle || !employeeId) return
    setLoading(true)

    const { error } = await supabase.from("fs_appraisals").insert({
      employee_id: employeeId,
      cycle,
    })

    if (error) {
      toast.error("Failed to create appraisal")
    } else {
      await supabase.from("fs_notifications").insert({
        recipient_id: employeeId,
        type: "appraisal_started",
        title: "Appraisal Started",
        message: `Your ${cycle} appraisal has been initiated. Please submit your self-review.`,
        link: "/appraisals",
      })
      toast.success("Appraisal created!")
      setOpen(false)
      setCycle("")
      setEmployeeId("")
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TbPlus className="mr-2 h-4 w-4" />
        New Appraisal
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Appraisal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cycle</Label>
            <Input
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              placeholder="e.g., H1 2026, Q2 2026"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={(v) => v !== null && setEmployeeId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Appraisal
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
