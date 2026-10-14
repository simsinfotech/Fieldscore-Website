"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TbRefresh,
  TbPlayerPause,
  TbPlayerPlay,
  TbTrash,
  TbLoader2,
  TbCheck,
  TbAlertTriangle,
  TbClock,
} from "react-icons/tb"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import type { LeadSourceSheet } from "@/types"

interface SheetSourceCardProps {
  source: LeadSourceSheet
  onRefresh: () => void
}

export function SheetSourceCard({ source, onRefresh }: SheetSourceCardProps) {
  const [syncing, setSyncing] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch(`/api/leads/sheet-sources/${source.id}/sync`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Sync failed")
      } else {
        toast.success(
          `Synced: ${data.synced} new, ${data.skipped} skipped, ${data.errors} errors`
        )
        onRefresh()
      }
    } catch {
      toast.error("Sync failed")
    }
    setSyncing(false)
  }

  async function handleToggle() {
    setToggling(true)
    try {
      const res = await fetch(`/api/leads/sheet-sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !source.is_active }),
      })
      if (!res.ok) {
        toast.error("Failed to update")
      } else {
        toast.success(source.is_active ? "Source paused" : "Source activated")
        onRefresh()
      }
    } catch {
      toast.error("Failed to update")
    }
    setToggling(false)
  }

  async function handleDelete() {
    if (!confirm("Delete this sheet source? This cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/leads/sheet-sources/${source.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        toast.error("Failed to delete")
      } else {
        toast.success("Source deleted")
        onRefresh()
      }
    } catch {
      toast.error("Failed to delete")
    }
    setDeleting(false)
  }

  const statusColor = "text-foreground"

  const StatusIcon = source.last_sync_error
    ? TbAlertTriangle
    : source.is_syncing
      ? TbLoader2
      : source.is_active
        ? TbCheck
        : TbClock

  return (
    <div className="rounded-3xl border border-border shadow-soft bg-secondary p-5 space-y-3 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full border border-border ${
              source.last_sync_error
                ? "bg-destructive"
                : source.is_active
                  ? "bg-[#00BCD4]"
                  : "bg-secondary"
            }`} />
            <h3 className="font-semibold text-sm truncate">{source.label}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {source.sheet_name} &middot; Row {source.header_row} header
          </p>
        </div>
        <Badge
          variant="secondary"
          className={`text-[10px] shrink-0 rounded-full border border-border ${
            source.is_active
              ? "bg-[#00BCD4] text-white"
              : "bg-secondary text-foreground"
          }`}
        >
          {source.is_active ? "Active" : "Paused"}
        </Badge>
      </div>

      {/* Status info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <StatusIcon
          className={`h-3.5 w-3.5 ${statusColor} ${
            source.is_syncing ? "animate-spin" : ""
          }`}
        />
        {source.last_sync_error ? (
          <span className="text-destructive truncate">
            {source.last_sync_error}
          </span>
        ) : source.last_synced_at ? (
          <span>
            Last synced{" "}
            {formatDistanceToNow(new Date(source.last_synced_at), {
              addSuffix: true,
            })}
            {source.last_sync_row > 0 && ` (${source.last_sync_row} rows)`}
          </span>
        ) : (
          <span>Never synced</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing || !source.is_active}
          className="text-xs h-8 rounded-xl"
        >
          {syncing ? (
            <TbLoader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <TbRefresh className="h-3.5 w-3.5 mr-1.5" />
          )}
          Sync Now
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          disabled={toggling}
          className="text-xs h-8 rounded-xl"
        >
          {source.is_active ? (
            <TbPlayerPause className="h-3.5 w-3.5 mr-1.5" />
          ) : (
            <TbPlayerPlay className="h-3.5 w-3.5 mr-1.5" />
          )}
          {source.is_active ? "Pause" : "Resume"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs h-8 rounded-xl text-foreground hover:bg-destructive/10 hover:text-destructive ml-auto"
        >
          <TbTrash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
