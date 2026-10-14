"use client"

import { useEffect, useState, useCallback } from "react"
import { useUser } from "@/hooks/use-user"
import { GlassCard } from "@/components/shared/glass-card"
import { AddSheetDialog } from "@/components/leads/add-sheet-dialog"
import { SheetSourceCard } from "@/components/leads/sheet-source-card"
import { TbCloudDownload, TbLoader2 } from "react-icons/tb"
import type { LeadSourceSheet } from "@/types"

export default function SheetsPage() {
  const { employee, isAdmin } = useUser()
  const [sources, setSources] = useState<LeadSourceSheet[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/leads/sheet-sources")
      if (res.ok) {
        const data = await res.json()
        setSources(data.sources)
      }
    } catch (err) {
      console.error("Failed to fetch sheet sources:", err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!employee || !isAdmin) return
    fetchSources()
  }, [employee?.id, isAdmin, fetchSources])

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground">
          Only admins can manage sheet sources.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F172A] text-white border border-border">
            <TbCloudDownload className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sheet Sources
            </h1>
            <p className="text-sm text-muted-foreground">
              Connect Google Sheets to auto-import leads
            </p>
          </div>
        </div>
        <AddSheetDialog onSuccess={fetchSources} />
      </div>

      {/* Sources Grid */}
      {loading ? (
        <GlassCard className="flex items-center justify-center py-16">
          <TbLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </GlassCard>
      ) : sources.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00BCD4] border border-border mb-4">
            <TbCloudDownload className="h-7 w-7 text-[#0F172A]" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No sheets connected
          </h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Connect a Google Sheet to automatically sync new leads every 5
            minutes.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => (
            <SheetSourceCard
              key={source.id}
              source={source}
              onRefresh={fetchSources}
            />
          ))}
        </div>
      )}
    </div>
  )
}
