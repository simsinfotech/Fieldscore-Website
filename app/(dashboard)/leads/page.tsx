"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { GlassCard } from "@/components/shared/glass-card"
import { LeadsTable } from "@/components/leads/leads-table"
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog"
import { ApproveDialog } from "@/components/leads/approve-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TbAddressBook,
  TbSearch,
  TbChevronLeft,
  TbChevronRight,
  TbUserPlus,
  TbUserCheck,
  TbTrophy,
  TbUserShare,
  TbCheck,
  TbX,
  TbLoader2,
  TbReportAnalytics,
} from "react-icons/tb"
import { toast } from "sonner"
import type { Lead, LeadStatus, LeadSource, Employee } from "@/types"

type AssignmentState = "unassigned" | "pending_approval" | "assigned"

export default function LeadsPage() {
  const { employee, isAdmin } = useUser()
  const orgId = useOrg()

  const isManager = employee?.role === "manager"

  const [leads, setLeads] = useState<Lead[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all")
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all")
  const [stateFilter, setStateFilter] = useState<AssignmentState | "all">("all")
  const [labelFilter, setLabelFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [unassignedCount, setUnassignedCount] = useState(0)

  // Admin: assign unassigned leads to a manager
  const [managers, setManagers] = useState<Pick<Employee, "id" | "full_name">[]>([])
  const [selectedManager, setSelectedManager] = useState("")
  const [acting, setActing] = useState(false)

  // Lead detail + manager approval dialog
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const canEditLeads = isAdmin || isManager || employee?.role === "setter"

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: "50" })
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (sourceFilter !== "all") params.set("source", sourceFilter)
    if (stateFilter !== "all") params.set("state", stateFilter)
    if (labelFilter !== "all") params.set("label", labelFilter)
    if (search.trim()) params.set("search", search.trim())

    try {
      const res = await fetch(`/api/leads?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads)
        setLabels(data.labels || [])
        setUnassignedCount(data.unassignedCount || 0)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err)
    }
    setLoading(false)
  }, [page, statusFilter, sourceFilter, stateFilter, labelFilter, search])

  useEffect(() => {
    if (!employee) return
    fetchLeads()
  }, [employee?.id, orgId, fetchLeads])

  // Admin: load managers for the assign dropdown
  useEffect(() => {
    if (!isAdmin) return
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase
        .from("fs_employees")
        .select("id, full_name")
        .eq("org_id", orgId)
        .eq("role", "manager")
        .eq("is_active", true)
        .not("auth_id", "is", null)
        .order("full_name")
      setManagers((data ?? []) as Pick<Employee, "id" | "full_name">[])
    })()
  }, [isAdmin, orgId])

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, sourceFilter, stateFilter, labelFilter, search])

  const myPending = leads.filter(
    (l) => l.assignment_state === "pending_approval" && l.pending_manager_id === employee?.id
  )

  async function assignToManager() {
    if (!selectedManager || unassignedCount === 0) return
    setActing(true)
    try {
      const res = await fetch("/api/leads/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerId: selectedManager,
          all: true,
          filters: {
            source: sourceFilter !== "all" ? sourceFilter : undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
            label: labelFilter !== "all" ? labelFilter : undefined,
            search: search.trim() || undefined,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Failed"); return }
      toast.success(`${data.assigned} lead(s) sent for approval`)
      fetchLeads()
    } finally {
      setActing(false)
    }
  }

  async function decideApproval(path: "approve" | "reject") {
    setActing(true)
    try {
      const res = await fetch(`/api/leads/assign/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Failed"); return }
      toast.success(path === "approve" ? `Distributed ${data.distributed} lead(s)` : `Returned ${data.returned} lead(s)`)
      fetchLeads()
    } finally {
      setActing(false)
    }
  }

  const stats = {
    total,
    new: leads.filter((l) => l.status === "new").length,
    qualified: leads.filter((l) => l.status === "qualified" || l.status === "site_visit" || l.status === "negotiation").length,
    won: leads.filter((l) => l.status === "won").length,
    lost: leads.filter((l) => l.status === "lost" || l.status === "junk").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1A2B45] text-white border border-border">
            <TbAddressBook className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground">Manage and track leads</p>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-1">
            <Link href="/leads/report">
              <TbReportAnalytics className="h-4 w-4 mr-1.5" /> Report
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative">
            <TbSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-[220px] rounded-full border-border bg-[#0D1B2A]"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Status filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}
            >
              <SelectTrigger className="flex-1 sm:w-[150px] rounded-full border-border bg-[#0D1B2A]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="site_visit">Site Visit</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="junk">Junk</SelectItem>
              </SelectContent>
            </Select>

            {/* Source filter */}
            <Select
              value={sourceFilter}
              onValueChange={(v) => setSourceFilter(v as LeadSource | "all")}
            >
              <SelectTrigger className="flex-1 sm:w-[140px] rounded-full border-border bg-[#0D1B2A]">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="google_sheets">Google Sheets</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="walkin">Walk-in</SelectItem>
                <SelectItem value="social">Social</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            {/* Assignment state */}
            <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as AssignmentState | "all")}>
              <SelectTrigger className="flex-1 sm:w-[150px] rounded-full border-border bg-[#0D1B2A]">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="pending_approval">Pending approval</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
              </SelectContent>
            </Select>

            {/* Sheet label */}
            {labels.length > 0 && (
              <Select value={labelFilter} onValueChange={(v) => v && setLabelFilter(v)}>
                <SelectTrigger className="flex-1 sm:w-[150px] rounded-full border-border bg-[#0D1B2A]">
                  <SelectValue placeholder="All Sheets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sheets</SelectItem>
                  {labels.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Admin: assign ALL unassigned leads (matching current filters) to a manager */}
      {isAdmin && unassignedCount > 0 && (
        <GlassCard className="flex flex-col sm:flex-row sm:items-center gap-3 border border-border bg-[#00BCD4]">
          <div className="flex items-center gap-2 text-sm">
            <TbUserShare className="h-4 w-4 text-[#F1F5F9]" />
            <span><b>{unassignedCount}</b> unassigned lead(s){labelFilter !== "all" ? " in this sheet" : ""}</span>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Select value={selectedManager || "none"} onValueChange={(v) => setSelectedManager(v === "none" ? "" : (v ?? ""))}>
              <SelectTrigger className="w-full sm:w-[200px] bg-[#0D1B2A] border-border">
                <SelectValue placeholder="Assign to manager…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select manager…</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={assignToManager} disabled={!selectedManager || acting} className="shrink-0">
              {acting ? <TbLoader2 className="h-4 w-4 animate-spin" /> : <TbUserShare className="h-4 w-4" />}
              <span className="ml-1.5">Assign all {unassignedCount}</span>
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Manager: approve / reject leads pending your approval */}
      {isManager && myPending.length > 0 && (
        <GlassCard className="flex flex-col sm:flex-row sm:items-center gap-3 border border-border bg-[#00BCD4]">
          <div className="flex items-center gap-2 text-sm">
            <TbUserCheck className="h-4 w-4 text-[#F1F5F9]" />
            <span><b>{myPending.length}</b> lead(s) awaiting your approval</span>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button onClick={() => setApproveOpen(true)} disabled={acting} className="bg-[#00BCD4] text-white hover:bg-[#00ACC1]">
              <TbCheck className="h-4 w-4" />
              <span className="ml-1.5">Approve &amp; distribute</span>
            </Button>
            <Button onClick={() => decideApproval("reject")} disabled={acting} variant="outline">
              <TbX className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Reject</span>
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<TbUserPlus className="h-4 w-4" />} label="Total Leads" value={stats.total} color="blue" />
        <StatCard icon={<TbAddressBook className="h-4 w-4" />} label="New" value={stats.new} color="emerald" />
        <StatCard icon={<TbUserCheck className="h-4 w-4" />} label="In Pipeline" value={stats.qualified} color="amber" />
        <StatCard icon={<TbTrophy className="h-4 w-4" />} label="Won" value={stats.won} color="red" />
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton />
      ) : leads.length === 0 ? (
        <EmptyState />
      ) : (
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <LeadsTable leads={leads} onSelect={(l) => setSelectedLead(l)} />
          </div>
        </GlassCard>
      )}

      <LeadDetailDialog
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdated={fetchLeads}
        canEdit={canEditLeads}
      />
      <ApproveDialog
        open={approveOpen}
        count={myPending.length}
        onClose={() => setApproveOpen(false)}
        onDone={() => { setApproveOpen(false); fetchLeads() }}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing page {page} of {totalPages} ({total} leads)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-full"
            >
              <TbChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-full"
            >
              <TbChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: "blue" | "emerald" | "amber" | "red"
}) {
  const palette = {
    blue: {
      icon: "text-white bg-[#1A2B45]",
    },
    emerald: {
      icon: "text-[#F1F5F9] bg-[#00BCD4]/10",
    },
    amber: {
      icon: "text-[#F1F5F9] bg-[#7C4DFF]/10",
    },
    red: {
      icon: "text-[#F1F5F9] bg-[#00BCD4]",
    },
  }
  const c = palette[color]

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-[#0D1B2A] p-4 shadow-soft transition-all hover:scale-[1.02]"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${c.icon}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00BCD4] border border-border mb-4">
        <TbAddressBook className="h-7 w-7 text-[#F1F5F9]" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No leads yet</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Upload an Excel or CSV file to import your first batch of leads.
      </p>
    </GlassCard>
  )
}

function LoadingSkeleton() {
  return (
    <GlassCard className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-9 w-9 animate-pulse rounded-full bg-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded-md bg-secondary" />
            <div className="h-2 w-1/4 animate-pulse rounded-md bg-secondary" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-secondary" />
        </div>
      ))}
    </GlassCard>
  )
}
