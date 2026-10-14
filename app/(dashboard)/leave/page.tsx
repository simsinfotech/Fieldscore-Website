"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { GlassCard } from "@/components/shared/glass-card"
import { LeaveRequestForm } from "@/components/leave/leave-request-form"
import { LeaveApprovalDialog } from "@/components/leave/leave-approval-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import {
  TbCalendarHeart,
  TbBeach,
  TbStethoscope,
  TbAward,
  TbClock,
  TbCircleCheck,
  TbCircleX,
  TbInbox,
  TbListCheck,
  TbUsers,
  TbCalendarTime,
  TbFileText,
  TbPencil,
  TbTrash,
} from "react-icons/tb"
import { toast } from "sonner"
import {
  Dialog as ConfirmDialog,
  DialogContent as ConfirmDialogContent,
  DialogHeader as ConfirmDialogHeader,
  DialogTitle as ConfirmDialogTitle,
} from "@/components/ui/dialog"
import type { LeaveBalance, LeaveRequest } from "@/types"

export default function LeavePage() {
  const { employee, isAdmin } = useUser()
  const orgId = useOrg()
  const supabase = createClient()

  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [allBalances, setAllBalances] = useState<(LeaveBalance & { employee?: any })[]>([])
  const [reviewRequest, setReviewRequest] = useState<LeaveRequest | null>(null)
  const [editRequest, setEditRequest] = useState<LeaveRequest | null>(null)
  const [deleteRequest, setDeleteRequest] = useState<LeaveRequest | null>(null)
  const [activeTab, setActiveTab] = useState<string>(isAdmin ? "pending" : "history")

  // Re-seed the active tab once the role resolves (admin sees a different tab
  // set than employees). Controlled Tabs avoids Base UI's "changing default
  // value of an uncontrolled component" warning.
  useEffect(() => {
    setActiveTab(isAdmin ? "pending" : "history")
  }, [isAdmin])

  useEffect(() => {
    if (!employee) return
    fetchData()

    // Live updates: admins see new requests land in Pending; employees see
    // their status/note change the moment an admin reviews.
    const channel = supabase
      .channel("leave-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fs_leave_requests" },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, orgId])

  async function fetchData() {
    // Own balance
    const { data: lb } = await supabase
      .from("fs_leave_balances")
      .select("*")
      .eq("employee_id", employee!.id)
      .eq("year", new Date().getFullYear())
      .single()
    if (lb) setBalance(lb)

    // Requests
    // fs_leave_requests has TWO FKs to fs_employees (employee_id and
    // reviewed_by), so the employee embed must name the FK constraint —
    // otherwise PostgREST rejects it as ambiguous and returns no rows.
    let reqQuery = supabase
      .from("fs_leave_requests")
      .select("*, employee:fs_employees!fs_leave_requests_employee_id_fkey(*)")
      .order("created_at", { ascending: false })

    if (!isAdmin) {
      reqQuery = reqQuery.eq("employee_id", employee!.id)
    }

    const { data: reqs, error: reqError } = await reqQuery
    if (reqError) {
      console.error("Failed to load leave requests:", reqError)
    }
    if (reqs) {
      const filtered = isAdmin
        ? reqs.filter((r: any) => r.employee?.org_id === orgId)
        : reqs
      setRequests(filtered as unknown as LeaveRequest[])
    }

    // All balances (admin)
    if (isAdmin) {
      const { data: balances } = await supabase
        .from("fs_leave_balances")
        .select("*, employee:fs_employees(*)")
        .eq("year", new Date().getFullYear())
      if (balances) {
        setAllBalances(
          balances.filter((b: any) => b.employee?.org_id === orgId)
        )
      }
    }
  }

  async function handleDelete(request: LeaveRequest) {
    const { error } = await supabase
      .from("fs_leave_requests")
      .delete()
      .eq("id", request.id)
      .eq("status", "pending")

    if (error) {
      toast.error("Failed to delete request")
    } else {
      toast.success(`Leave request ${request.reference} deleted`)
      fetchData()
    }
    setDeleteRequest(null)
  }

  const pending = requests.filter((r) => r.status === "pending")

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F172A] text-white border border-border">
            <TbCalendarHeart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leave Management</h1>
            <p className="text-sm text-muted-foreground">Manage leave requests and balances</p>
          </div>
        </div>
        {!isAdmin && (
          <LeaveRequestForm
            balance={balance}
            onSuccess={fetchData}
            editRequest={editRequest}
            onEditClose={() => setEditRequest(null)}
          />
        )}
      </div>

      {/* ── Employee: Balance Cards ── */}
      {!isAdmin && balance && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BalanceCard
            label="Casual Leave"
            icon={<TbBeach className="h-5 w-5" />}
            used={balance.casual_used}
            total={balance.casual_total}
            color="blue"
          />
          <BalanceCard
            label="Sick Leave"
            icon={<TbStethoscope className="h-5 w-5" />}
            used={balance.sick_used}
            total={balance.sick_total}
            color="orange"
          />
          <BalanceCard
            label="Earned Leave"
            icon={<TbAward className="h-5 w-5" />}
            used={balance.earned_used}
            total={balance.earned_total}
            color="green"
          />
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
        <TabsList className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-secondary p-1 backdrop-blur-sm">
          {isAdmin && (
            <>
              <TabsTrigger
                value="pending"
                className="gap-1.5 rounded-full px-4 text-xs data-active:bg-[#00BCD4] data-active:text-white data-active:shadow-none"
              >
                <TbInbox className="h-3.5 w-3.5" />
                Pending
                {pending.length > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0F172A] px-1.5 text-[10px] font-semibold text-white">
                    {pending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="gap-1.5 rounded-full px-4 text-xs data-active:bg-[#00BCD4] data-active:text-white data-active:shadow-none"
              >
                <TbListCheck className="h-3.5 w-3.5" />
                All Requests
              </TabsTrigger>
              <TabsTrigger
                value="balances"
                className="gap-1.5 rounded-full px-4 text-xs data-active:bg-[#00BCD4] data-active:text-white data-active:shadow-none"
              >
                <TbUsers className="h-3.5 w-3.5" />
                Balances
              </TabsTrigger>
            </>
          )}
          {!isAdmin && (
            <TabsTrigger
              value="history"
              className="gap-1.5 rounded-full px-4 text-xs data-active:bg-[#00BCD4] data-active:text-white data-active:shadow-none"
            >
              <TbCalendarTime className="h-3.5 w-3.5" />
              My Requests
            </TabsTrigger>
          )}
        </TabsList>

        {/* Admin: Pending */}
        {isAdmin && (
          <TabsContent value="pending" className="mt-4">
            {pending.length === 0 ? (
              <LeaveEmptyState message="No pending leave requests to review" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((r) => (
                  <PendingCard
                    key={r.id}
                    request={r}
                    onReview={() => setReviewRequest(r)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* All / History */}
        <TabsContent value={isAdmin ? "all" : "history"} className="mt-4">
          {requests.length === 0 ? (
            <LeaveEmptyState message="No leave requests yet" />
          ) : (
            <GlassCard className="p-0 overflow-hidden rounded-3xl border border-border shadow-soft">
              <div className="overflow-x-auto">
                <RequestsTable
                  requests={requests}
                  showEmployee={isAdmin}
                  currentEmployeeId={employee?.id}
                  onEdit={(r) => setEditRequest(r)}
                  onDelete={(r) => setDeleteRequest(r)}
                />
              </div>
            </GlassCard>
          )}
        </TabsContent>

        {/* Admin: Balances */}
        {isAdmin && (
          <TabsContent value="balances" className="mt-4">
            {allBalances.length === 0 ? (
              <LeaveEmptyState message="No leave balances found for this year" />
            ) : (
              <GlassCard className="p-0 overflow-hidden rounded-3xl border border-border shadow-soft">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-muted-foreground">Employee</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Casual</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Sick</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Earned</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allBalances.map((b) => (
                        <TableRow key={b.id} className="border-border transition-colors hover:bg-secondary">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172A] text-xs font-semibold text-white border border-border">
                                {b.employee?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                              </div>
                              <span className="font-medium">{b.employee?.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <BalancePill used={b.casual_used} total={b.casual_total} color="blue" />
                          </TableCell>
                          <TableCell>
                            <BalancePill used={b.sick_used} total={b.sick_total} color="orange" />
                          </TableCell>
                          <TableCell>
                            <BalancePill used={b.earned_used} total={b.earned_total} color="green" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </GlassCard>
            )}
          </TabsContent>
        )}
      </Tabs>

      <LeaveApprovalDialog
        request={reviewRequest}
        open={!!reviewRequest}
        onClose={() => setReviewRequest(null)}
        onSuccess={fetchData}
      />

      <ConfirmDialog open={!!deleteRequest} onOpenChange={(o) => !o && setDeleteRequest(null)}>
        <ConfirmDialogContent>
          <ConfirmDialogHeader>
            <ConfirmDialogTitle>Delete Leave Request</ConfirmDialogTitle>
          </ConfirmDialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete {deleteRequest?.reference}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteRequest(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRequest && handleDelete(deleteRequest)}
            >
              Delete
            </Button>
          </div>
        </ConfirmDialogContent>
      </ConfirmDialog>
    </div>
  )
}

/* ── Balance Card (Employee) ── */
function BalanceCard({
  label,
  icon,
  used,
  total,
  color,
}: {
  label: string
  icon: React.ReactNode
  used: number
  total: number
  color: "blue" | "orange" | "green"
}) {
  const remaining = total - used
  const percent = total > 0 ? (used / total) * 100 : 0

  const palette = {
    blue: {
      cardBg: "bg-[#00BCD4]/20",
      bar: "bg-[#00BCD4]",
      barTrack: "bg-[#F1F5F9]",
      text: "text-foreground",
      iconBg: "bg-[#00BCD4] text-white",
    },
    orange: {
      cardBg: "bg-[#DBEAFE]",
      bar: "bg-[#00BCD4]",
      barTrack: "bg-[#F1F5F9]",
      text: "text-foreground",
      iconBg: "bg-[#0F172A] text-white",
    },
    green: {
      cardBg: "bg-[#00BCD4]/20",
      bar: "bg-[#00BCD4]",
      barTrack: "bg-[#F1F5F9]",
      text: "text-foreground",
      iconBg: "bg-[#00BCD4] text-white",
    },
  }
  const c = palette[color]

  return (
    <div className={`group relative overflow-hidden rounded-3xl border border-border shadow-soft ${c.cardBg} p-5 backdrop-blur-sm transition-all hover:scale-[1.02]`}>
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-4xl font-semibold tabular-nums ${c.text}`}>
              {remaining}
            </span>
            <span className="text-sm text-muted-foreground">/ {total} days</span>
          </div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${c.iconBg}`}>
          <span>{icon}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className={`h-2 w-full overflow-hidden rounded-full ${c.barTrack}`}>
          <div
            className={`h-full rounded-full ${c.bar} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{used} used</span>
          <span>{remaining} remaining</span>
        </div>
      </div>
    </div>
  )
}

/* ── Balance Pill (Admin table) ── */
function BalancePill({
  used,
  total,
  color,
}: {
  used: number
  total: number
  color: "blue" | "orange" | "green"
}) {
  const remaining = total - used
  const percent = total > 0 ? (used / total) * 100 : 0
  const palette = {
    blue: { bar: "bg-[#00BCD4]", track: "bg-[#F1F5F9]", text: "text-foreground" },
    orange: { bar: "bg-[#00BCD4]", track: "bg-[#F1F5F9]", text: "text-foreground" },
    green: { bar: "bg-[#00BCD4]", track: "bg-[#F1F5F9]", text: "text-foreground" },
  }
  const c = palette[color]

  return (
    <div className="flex items-center gap-2">
      <div className={`h-1.5 w-16 overflow-hidden rounded-full ${c.track}`}>
        <div
          className={`h-full rounded-full ${c.bar} transition-all`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${c.text}`}>
        {used}/{total}
      </span>
    </div>
  )
}

/* ── Pending Card (Admin) ── */
function PendingCard({
  request,
  onReview,
}: {
  request: LeaveRequest
  onReview: () => void
}) {
  const leaveTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
    casual: { label: "Casual", color: "text-[#0F172A]", bg: "bg-[#00BCD4]/25" },
    sick: { label: "Sick", color: "text-foreground", bg: "bg-[#DBEAFE]" },
    earned: { label: "Earned", color: "text-[#0F172A]", bg: "bg-[#00BCD4]/25" },
  }
  const lt = leaveTypeConfig[request.leave_type] ?? leaveTypeConfig.casual

  const initials = request.employee?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2) ?? "?"

  const days =
    Math.ceil(
      (new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1

  return (
    <GlassCard className="group relative overflow-hidden rounded-3xl border border-border shadow-soft p-5 transition-all">
      {/* Reference number */}
      <div className="mb-3">
        <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
          {request.reference}
        </span>
      </div>
      {/* Top: avatar + name + type badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F172A] text-sm font-semibold text-white border border-border">
            {initials}
          </div>
          <div>
            <p className="font-semibold">{request.employee?.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {request.employee?.designation ?? "Employee"}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${lt.bg} ${lt.color}`}>
          {lt.label}
        </span>
      </div>

      {/* Date range */}
      <div className="mt-4 flex items-center gap-2 text-sm">
        <TbCalendarTime className="h-4 w-4 text-muted-foreground" />
        <span>
          {format(new Date(request.start_date), "MMM d")} &mdash; {format(new Date(request.end_date), "MMM d, yyyy")}
        </span>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {days} day{days !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Reason */}
      {request.reason && (
        <div className="mt-3 flex items-start gap-2">
          <TbFileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {request.reason}
          </p>
        </div>
      )}

      {/* Action button */}
      <div className="mt-4">
        <Button
          onClick={onReview}
          className="w-full bg-[#00BCD4] text-white border border-border transition-all hover:brightness-105"
          size="sm"
        >
          Review Request
        </Button>
      </div>
    </GlassCard>
  )
}

/* ── Requests Table ── */
function RequestsTable({
  requests,
  showEmployee,
  currentEmployeeId,
  onEdit,
  onDelete,
}: {
  requests: LeaveRequest[]
  showEmployee?: boolean
  currentEmployeeId?: string
  onEdit?: (request: LeaveRequest) => void
  onDelete?: (request: LeaveRequest) => void
}) {
  const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    pending: {
      icon: <TbClock className="h-3 w-3" />,
      color: "text-muted-foreground",
      bg: "bg-[#EDE9FE]",
    },
    approved: {
      icon: <TbCircleCheck className="h-3 w-3" />,
      color: "text-foreground",
      bg: "bg-[#DBEAFE]",
    },
    rejected: {
      icon: <TbCircleX className="h-3 w-3" />,
      color: "text-destructive",
      bg: "bg-destructive/15",
    },
  }

  const leaveTypeColors: Record<string, string> = {
    casual: "text-foreground",
    sick: "text-foreground",
    earned: "text-foreground",
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="text-xs font-semibold text-muted-foreground">Reference</TableHead>
          {showEmployee && <TableHead className="text-xs font-semibold text-muted-foreground">Employee</TableHead>}
          <TableHead className="text-xs font-semibold text-muted-foreground">Type</TableHead>
          <TableHead className="text-xs font-semibold text-muted-foreground">Period</TableHead>
          <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
          <TableHead className="text-xs font-semibold text-muted-foreground">Reason</TableHead>
          <TableHead className="text-xs font-semibold text-muted-foreground">Admin Note</TableHead>
          <TableHead className="text-xs font-semibold text-muted-foreground">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((r) => {
          const sc = statusConfig[r.status] ?? statusConfig.pending
          const days =
            Math.ceil(
              (new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) /
                (1000 * 60 * 60 * 24)
            ) + 1

          return (
            <TableRow key={r.id} className="border-border transition-colors hover:bg-secondary">
              <TableCell>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs font-medium text-foreground">
                  {r.reference}
                </span>
              </TableCell>
              {showEmployee && (
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0F172A] text-[10px] font-semibold text-white border border-border">
                      {r.employee?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="font-medium">{r.employee?.full_name}</span>
                  </div>
                </TableCell>
              )}
              <TableCell>
                <span className={`text-sm font-medium capitalize ${leaveTypeColors[r.leave_type] ?? ""}`}>
                  {r.leave_type}
                </span>
              </TableCell>
              <TableCell>
                <div>
                  <span className="text-sm">
                    {format(new Date(r.start_date), "MMM d")} &mdash; {format(new Date(r.end_date), "MMM d")}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({days}d)
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.bg} ${sc.color}`}>
                  {sc.icon}
                  <span className="capitalize">{r.status}</span>
                </span>
              </TableCell>
              <TableCell className="max-w-[200px]">
                <p className="truncate text-sm text-muted-foreground">
                  {r.reason ?? "\u2014"}
                </p>
              </TableCell>
              <TableCell className="max-w-[220px]">
                {r.review_notes ? (
                  <p className="truncate text-sm text-foreground" title={r.review_notes}>
                    {r.review_notes}
                  </p>
                ) : (
                  <span className="text-sm text-muted-foreground">{"\u2014"}</span>
                )}
              </TableCell>
              <TableCell>
                {r.status === "pending" && r.employee_id === currentEmployeeId && (
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(r)}
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <TbPencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(r)}
                        className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <TbTrash className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/* ── Empty State ── */
function LeaveEmptyState({ message }: { message?: string }) {
  return (
    <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F172A] text-white border border-border mb-4">
        <TbCalendarHeart className="h-7 w-7 text-white" />
      </div>
      <h3 className="text-base font-semibold text-foreground">Nothing here yet</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {message ?? "No leave data to display. Check back later!"}
      </p>
    </GlassCard>
  )
}
