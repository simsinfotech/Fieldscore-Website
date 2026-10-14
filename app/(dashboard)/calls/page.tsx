"use client"

import { useUser } from "@/hooks/use-user"
import { TeamCalls, DeviceHealthPanel } from "@/components/calls/team-calls"
import { TbPhone } from "react-icons/tb"

export default function CallsPage() {
  const { employee, isAdmin } = useUser()

  // Admin/manager only gate
  const allowed =
    isAdmin ||
    employee?.role === "manager" ||
    employee?.role === "sales_admin"

  if (!employee) return null

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to this page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00BCD4] text-white border border-border">
          <TbPhone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
          <p className="text-sm text-muted-foreground">
            Team call activity and device health
          </p>
        </div>
      </div>

      {/* Team calls table with stats */}
      <TeamCalls />

      {/* Device health panel (admin only) */}
      {isAdmin && <DeviceHealthPanel />}
    </div>
  )
}
