"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { TbBell, TbLoader2, TbAt, TbChecklist, TbCalendarOff, TbClipboardList, TbChevronRight } from "react-icons/tb"
import { formatDistanceToNow } from "date-fns"
import type { Notification } from "@/types"

function iconFor(type: string) {
  if (type === "mention") return <TbAt className="h-4 w-4" />
  if (type.startsWith("work")) return <TbChecklist className="h-4 w-4" />
  if (type.startsWith("task")) return <TbClipboardList className="h-4 w-4" />
  if (type.startsWith("leave")) return <TbCalendarOff className="h-4 w-4" />
  return <TbBell className="h-4 w-4" />
}

export default function NotificationsPage() {
  const { employee } = useUser()
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!employee) return
    const { data } = await supabase
      .from("fs_notifications")
      .select("*")
      .eq("recipient_id", employee.id)
      .order("created_at", { ascending: false })
      .limit(100)
    setItems((data as unknown as Notification[]) || [])
    setLoading(false)
  }, [employee, supabase])

  useEffect(() => {
    if (!employee) return
    load()
    const channel = supabase
      .channel("notifications-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "fs_notifications", filter: `recipient_id=eq.${employee.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [employee?.id, load, supabase])

  async function open(n: Notification) {
    if (!n.is_read) {
      await supabase.from("fs_notifications").update({ is_read: true }).eq("id", n.id)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    }
    if (n.link) {
      // /leads/{uuid} → /leads (no detail page exists)
      const cleaned = n.link.replace(/^\/leads\/[0-9a-f-]+$/i, "/leads")
      router.push(cleaned)
    }
  }

  async function markAllRead() {
    if (!employee) return
    await supabase.from("fs_notifications").update({ is_read: true }).eq("recipient_id", employee.id).eq("is_read", false)
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
  }

  const unread = items.filter((n) => !n.is_read).length

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You're all caught up"} />
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><TbLoader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-border bg-[#0D1B2A] p-12 text-center shadow-soft">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary"><TbBell className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-[#0D1B2A] shadow-soft">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={`flex w-full items-start gap-3 border-b border-border/70 px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-secondary/50 ${!n.is_read ? "bg-[#00BCD4]/10" : ""}`}
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${!n.is_read ? "bg-[#00BCD4] text-white" : "bg-secondary text-muted-foreground"}`}>
                {iconFor(n.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-[#00BCD4]" />}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
              </div>
              {n.link && <TbChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
