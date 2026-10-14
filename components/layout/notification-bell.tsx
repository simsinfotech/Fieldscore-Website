"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TbBell } from "react-icons/tb"
import type { Notification } from "@/types"
import { formatDistanceToNow } from "date-fns"

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const { employee } = useUser()
  const router = useRouter()
  const supabase = createClient()

  async function openNotification(n: Notification) {
    if (!n.is_read) {
      await supabase.from("fs_notifications").update({ is_read: true }).eq("id", n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  useEffect(() => {
    if (!employee) return

    async function fetchNotifications() {
      const { data } = await supabase
        .from("fs_notifications")
        .select("*")
        .eq("recipient_id", employee!.id)
        .order("created_at", { ascending: false })
        .limit(20)
      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
      }
    }

    fetchNotifications()

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fs_notifications",
          filter: `recipient_id=eq.${employee.id}`,
        },
        (payload: any) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [employee?.id])

  async function markAllRead() {
    if (!employee) return
    await supabase
      .from("fs_notifications")
      .update({ is_read: true })
      .eq("recipient_id", employee.id)
      .eq("is_read", false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-[#8094B0] hover:text-white hover:bg-[#1A2B45]">
          <TbBell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#00E5FF] text-[10px] font-medium flex items-center justify-center text-[#060B18]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-[#0D1B2A] border-[#1A2B45]">
        <div className="flex items-center justify-between p-3 border-b border-[#1A2B45]">
          <h4 className="text-sm font-medium text-[#F1F5F9]">Notifications</h4>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-[#00E5FF] hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-[#8094B0] text-center">No notifications yet</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className="block w-full text-left p-3 border-b border-[#1A2B45] transition-colors hover:bg-[#0A1628]"
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.is_read ? "bg-[#00E5FF]" : "bg-transparent"}`} />
                  <div>
                    <p className={`text-sm ${!n.is_read ? "font-semibold text-[#F1F5F9]" : "font-medium text-[#8094B0]"}`}>{n.title}</p>
                    <p className="text-xs text-[#8094B0] mt-0.5">{n.message}</p>
                    <p className="text-xs text-[#4A6080] mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-[#1A2B45] p-2.5 text-center text-xs font-medium text-[#00E5FF] hover:underline"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  )
}
