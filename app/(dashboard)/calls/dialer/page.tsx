"use client"

import { useUser } from "@/hooks/use-user"
import { Dialer } from "@/components/calls/dialer"
import { TbPhone } from "react-icons/tb"

export default function DialerPage() {
  const { employee } = useUser()

  if (!employee) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#16a34a] text-white border border-border">
          <TbPhone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dialer</h1>
          <p className="text-sm text-muted-foreground">
            Make calls and view your call history
          </p>
        </div>
      </div>

      <Dialer />
    </div>
  )
}
