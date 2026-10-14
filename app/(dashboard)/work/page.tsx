"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { TbPlus, TbLoader2, TbTrash, TbArrowRight } from "react-icons/tb"
import { toast } from "sonner"
import { format } from "date-fns"
import type { WorkItem, WorkType, WorkStatus } from "@/types"

// The board covers these four kinds of work. (The DB enum still allows
// 'ticket'/'request' for any legacy rows, but they're no longer offered.)
const TYPES: WorkType[] = ["task", "content", "campaign", "bug"]
const TYPE_ITEMS: Record<string, string> = {
  all: "All types", task: "Task", content: "Content", campaign: "Campaign", bug: "Bug",
}
const STATUS_ORDER: WorkStatus[] = [
  "backlog", "todo", "in_progress", "review", "approved", "blocked", "done", "cancelled",
]
const STATUS_LABEL: Record<WorkStatus, string> = {
  backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review",
  approved: "Approved", blocked: "Blocked", done: "Done", cancelled: "Cancelled",
}

export default function WorkPage() {
  const { employee, isAdmin } = useUser()
  const supabase = createClient()

  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [mine, setMine] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== "all") params.set("type", typeFilter)
      if (mine) params.set("mine", "1")
      const res = await fetch(`/api/work-items?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } finally {
      setLoading(false)
    }
  }, [typeFilter, mine])

  useEffect(() => {
    fetchItems()
    // Realtime: reflect new/updated work items live (work_items published).
    const channel = supabase
      .channel("work-items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_items" },
        () => fetchItems()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchItems, supabase])

  const grouped = useMemo(() => {
    const map = new Map<WorkStatus, WorkItem[]>()
    for (const s of STATUS_ORDER) map.set(s, [])
    for (const it of items) map.get(it.status)?.push(it)
    return STATUS_ORDER.map((s) => ({ status: s, items: map.get(s)! })).filter((g) => g.items.length > 0)
  }, [items])

  async function changeStatus(id: string, status: WorkStatus) {
    const res = await fetch(`/api/work-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { toast.error("Failed to update"); return }
    fetchItems()
  }

  async function remove(id: string) {
    const res = await fetch(`/api/work-items/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to delete"); return }
    toast.success("Deleted")
    fetchItems()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Work" description="Tasks, content, campaigns and bugs — all in one place" />
        <Button asChild>
          <Link href="/work/new">
            <TbPlus className="h-4 w-4 mr-1.5" /> New
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={mine ? "default" : "outline"} size="sm" onClick={() => setMine((m) => !m)}>
          Assigned to me
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><TbLoader2 className="h-6 w-6 animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <GlassCard><p className="text-sm text-muted-foreground text-center py-10">No work items yet.</p></GlassCard>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ status, items }) => (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{STATUS_LABEL[status]}</h3>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((w) => {
                  const canDelete = isAdmin || w.created_by === employee?.id
                  return (
                    <GlassCard key={w.id} className="p-4 space-y-3 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                          {w.reference}
                        </span>
                        {canDelete && (
                          <button onClick={() => remove(w.id)} className="text-muted-foreground hover:text-destructive shrink-0" title="Delete">
                            <TbTrash className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <Link href={`/work/${w.id}`} className="block group">
                        <p className="text-sm font-medium leading-snug group-hover:underline">{w.title}</p>
                      </Link>

                      {w.description && <p className="text-xs text-muted-foreground line-clamp-2">{w.description}</p>}

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="capitalize">{w.type}</Badge>
                        <Badge variant="secondary">P{w.priority}</Badge>
                        {w.due_at && <span className="text-[11px] text-muted-foreground">Due {format(new Date(w.due_at), "MMM d")}</span>}
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {w.assigned_to ? `Assigned: ${w.assignee?.full_name ?? "—"}` : "Unassigned"}
                      </div>

                      <div className="mt-auto flex items-center gap-2 pt-1">
                        <Select value={w.status} onValueChange={(v) => v && changeStatus(w.id, v as WorkStatus)}>
                          <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Link
                          href={`/work/${w.id}`}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          Open <TbArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </GlassCard>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
