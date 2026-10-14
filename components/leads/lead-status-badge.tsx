import { cn } from "@/lib/utils"
import type { LeadStatus } from "@/types"

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-[#0D1B2A] text-foreground border-slate-200",
  },
  contacted: {
    label: "Contacted",
    className: "bg-[#EDE9FE] text-foreground border-transparent",
  },
  qualified: {
    label: "Interested",
    className: "bg-[#DBEAFE] text-foreground border-transparent",
  },
  site_visit: {
    label: "Site Visit",
    className: "bg-[#DBEAFE] text-foreground border-transparent",
  },
  negotiation: {
    label: "Negotiation",
    className: "bg-[#00BCD4]/20 text-foreground border-transparent",
  },
  won: {
    label: "Won",
    className: "bg-[#00BCD4] text-white border-transparent",
  },
  lost: {
    label: "Lost",
    className: "bg-[#F1F5F9] text-muted-foreground border-transparent",
  },
  junk: {
    label: "Not Interested",
    className: "bg-[#F1F5F9] text-muted-foreground border-transparent",
  },
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = statusConfig[status] || statusConfig.new

  return (
    <span
      className={cn(
        "inline-flex items-center border rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
