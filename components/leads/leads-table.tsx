"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LeadStatusBadge } from "./lead-status-badge"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import type { Lead } from "@/types"

interface LeadsTableProps {
  leads: Lead[]
  onSelect?: (lead: Lead) => void
}

const STAGE_META: Record<string, { label: string; variant: "secondary" | "outline" | "default" }> = {
  unassigned: { label: "Unassigned", variant: "outline" },
  pending_approval: { label: "Pending", variant: "secondary" },
  assigned: { label: "Assigned", variant: "default" },
}

function StageBadge({ state }: { state?: string }) {
  const m = STAGE_META[state ?? "unassigned"] ?? STAGE_META.unassigned
  return <Badge variant={m.variant}>{m.label}</Badge>
}

function formatBudget(min?: number, max?: number): string {
  if (!min && !max) return "-"

  const fmt = (v: number) => {
    if (v >= 1_00_00_000) return `${(v / 1_00_00_000).toFixed(1)} Cr`
    if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(1)} L`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
    return v.toString()
  }

  if (min && max && min !== max) {
    return `${fmt(min)} - ${fmt(max)}`
  }

  return fmt(min || max || 0)
}

export function LeadsTable({ leads, onSelect }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">No leads found</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile: card layout */}
      <div className="sm:hidden divide-y divide-gray-100">
        {leads.map((lead) => (
          <div key={lead.id} onClick={() => onSelect?.(lead)} className="px-4 py-3 space-y-1.5 cursor-pointer active:bg-[#0A1628]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{lead.full_name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <StageBadge state={lead.assignment_state} />
                <LeadStatusBadge status={lead.status} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{lead.phone_e164}</p>
            {lead.source_label && (
              <p className="text-[11px] text-muted-foreground">{lead.source_label}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {lead.project && <span>{lead.project}</span>}
              <span>{formatBudget(lead.budget_min, lead.budget_max)}</span>
              {lead.city && <span>{lead.city}</span>}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="capitalize">{lead.source.replace("_", " ")}</span>
              {lead.assigned_employee && (
                <span className="text-foreground">{lead.assigned_employee.full_name}</span>
              )}
              <span>{format(new Date(lead.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table layout */}
      <Table className="hidden sm:table">
        <TableHeader>
          <TableRow className="border-gray-100 hover:bg-transparent">
            <TableHead className="text-xs font-semibold text-muted-foreground">Name</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Phone</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Project</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Budget</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">City</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Stage</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Source</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Assigned To</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} onClick={() => onSelect?.(lead)} className="border-gray-50 hover:bg-[#0A1628]/50 cursor-pointer">
              <TableCell className="font-medium">{lead.full_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {lead.phone_e164}
              </TableCell>
              <TableCell className="text-sm">{lead.project || "-"}</TableCell>
              <TableCell className="text-sm">
                {formatBudget(lead.budget_min, lead.budget_max)}
              </TableCell>
              <TableCell className="text-sm">{lead.city || "-"}</TableCell>
              <TableCell>
                <LeadStatusBadge status={lead.status} />
              </TableCell>
              <TableCell>
                <StageBadge state={lead.assignment_state} />
              </TableCell>
              <TableCell className="text-sm">
                <span className="capitalize">{lead.source.replace("_", " ")}</span>
                {lead.source_label && (
                  <span className="block text-[11px] text-muted-foreground">{lead.source_label}</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {lead.assigned_employee ? (
                  <span className="text-foreground font-medium">{lead.assigned_employee.full_name}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(lead.created_at), "MMM d, yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
