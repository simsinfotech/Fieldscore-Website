"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  TbPlus,
  TbLoader2,
  TbPin,
  TbTrash,
  TbSpeakerphone,
  TbClock,
  TbUser,
  TbAlertCircle,
  TbPinnedOff,
} from "react-icons/tb"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import type { Announcement } from "@/types"

const priorityConfig: Record<
  string,
  { dot: string; border: string; badge: string; label: string }
> = {
  urgent: {
    dot: "bg-destructive",
    border: "border-l-[#00BCD4]",
    badge: "bg-destructive/15 text-destructive",
    label: "Urgent",
  },
  high: {
    dot: "bg-[#00BCD4]",
    border: "border-l-[#00BCD4]",
    badge: "bg-[#00BCD4]/25 text-[#1E40AF]",
    label: "High",
  },
  normal: {
    dot: "bg-[#DBEAFE]",
    border: "border-l-border",
    badge: "bg-[#DBEAFE] text-foreground",
    label: "Normal",
  },
  low: {
    dot: "bg-[#F1F5F9]",
    border: "border-l-border",
    badge: "bg-[#F1F5F9] text-muted-foreground",
    label: "Low",
  },
}

export default function AnnouncementsPage() {
  const { employee, isAdmin } = useUser()
  const orgId = useOrg()
  const supabase = createClient()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  async function fetchData() {
    const { data } = await supabase
      .from("fs_announcements")
      .select("*, author:fs_employees!created_by(*)")
      .eq("org_id", orgId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
    if (data) setAnnouncements(data as unknown as Announcement[])
  }

  useEffect(() => {
    if (!employee) return
    fetchData()

    const channel = supabase
      .channel("announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fs_announcements" },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [employee?.id, orgId])

  async function deleteAnnouncement(id: string) {
    const { error } = await supabase
      .from("fs_announcements")
      .delete()
      .eq("id", id)
    if (error) {
      toast.error("Failed to delete")
    } else {
      toast.success("Announcement deleted")
      fetchData()
    }
  }

  async function togglePin(id: string, currentPin: boolean) {
    await supabase
      .from("fs_announcements")
      .update({ is_pinned: !currentPin })
      .eq("id", id)
    fetchData()
  }

  const pinned = announcements.filter((a) => a.is_pinned)
  const regular = announcements.filter((a) => !a.is_pinned)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-white border border-border">
            <TbSpeakerphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Announcements
            </h1>
            <p className="text-sm text-muted-foreground">
              Company-wide updates and notices
            </p>
          </div>
        </div>
        {isAdmin && (
          <NewAnnouncementDialog
            orgId={orgId}
            createdBy={employee?.id}
            onSuccess={fetchData}
          />
        )}
      </div>

      {/* Empty State */}
      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
            <TbSpeakerphone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-muted-foreground">
            No announcements yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {isAdmin
              ? "Create the first announcement to keep your team informed"
              : "Announcements from your organization will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Section */}
          {pinned.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TbPin className="h-3.5 w-3.5" />
                <span>Pinned</span>
              </div>
              <div className="space-y-3">
                {pinned.map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    isAdmin={isAdmin}
                    onDelete={deleteAnnouncement}
                    onTogglePin={togglePin}
                    isPinned
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Section */}
          {regular.length > 0 && (
            <div className="space-y-3">
              {pinned.length > 0 && (
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TbClock className="h-3.5 w-3.5" />
                  <span>Recent</span>
                </div>
              )}
              <div className="space-y-3">
                {regular.map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    isAdmin={isAdmin}
                    onDelete={deleteAnnouncement}
                    onTogglePin={togglePin}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AnnouncementCard({
  announcement: a,
  isAdmin,
  onDelete,
  onTogglePin,
  isPinned,
}: {
  announcement: Announcement
  isAdmin: boolean
  onDelete: (id: string) => void
  onTogglePin: (id: string, currentPin: boolean) => void
  isPinned?: boolean
}) {
  const config = priorityConfig[a.priority] ?? priorityConfig.normal

  return (
    <div
      className={`group relative rounded-3xl border border-border shadow-soft bg-[#0D1B2A] backdrop-blur-sm transition-all duration-300 overflow-hidden ${
        isPinned ? "ring-2 ring-[#00BCD4]" : ""
      }`}
    >
      {/* Priority left border */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${config.dot} rounded-l-3xl`} />

      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title row */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {isPinned && (
                <TbPin className="h-3.5 w-3.5 text-[#00E5FF] shrink-0" />
              )}
              <h3 className="font-semibold text-[15px] leading-tight">
                {a.title}
              </h3>
              <Badge
                variant="secondary"
                className={`text-[11px] px-2 py-0 h-5 rounded-full ${config.badge}`}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full mr-1.5 ${config.dot}`}
                />
                {config.label}
              </Badge>
            </div>

            {/* Content */}
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">
              {a.content}
            </p>

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <TbUser className="h-3 w-3" />
                <span>{a.author?.full_name ?? "Admin"}</span>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1.5">
                <TbClock className="h-3 w-3" />
                <span>
                  {formatDistanceToNow(new Date(a.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-secondary"
                onClick={() => onTogglePin(a.id, a.is_pinned)}
                title={a.is_pinned ? "Unpin" : "Pin to top"}
              >
                {a.is_pinned ? (
                  <TbPinnedOff className="h-4 w-4 text-foreground" />
                ) : (
                  <TbPin className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-secondary"
                onClick={() => onDelete(a.id)}
                title="Delete"
              >
                <TbTrash className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NewAnnouncementDialog({
  orgId,
  createdBy,
  onSuccess,
}: {
  orgId: string
  createdBy?: string
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState("normal")
  const [isPinned, setIsPinned] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !content || !createdBy) return
    setLoading(true)

    const { error } = await supabase.from("fs_announcements").insert({
      org_id: orgId,
      title,
      content,
      priority,
      is_pinned: isPinned,
      created_by: createdBy,
    })

    if (error) {
      toast.error("Failed to create announcement")
    } else {
      toast.success("Announcement posted!")
      setOpen(false)
      setTitle("")
      setContent("")
      setPriority("normal")
      setIsPinned(false)
      onSuccess()
    }
    setLoading(false)
  }

  const priorities = [
    { value: "low", label: "Low", color: "bg-[#F1F5F9]", ring: "ring-[#00BCD4]" },
    { value: "normal", label: "Normal", color: "bg-[#DBEAFE]", ring: "ring-[#00BCD4]" },
    { value: "high", label: "High", color: "bg-[#00BCD4]", ring: "ring-[#00BCD4]" },
    { value: "urgent", label: "Urgent", color: "bg-destructive", ring: "ring-[#00BCD4]" },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#00BCD4] hover:brightness-105 text-white border border-[#1A2B45]">
          <TbPlus className="mr-2 h-4 w-4" />
          New Announcement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TbSpeakerphone className="h-5 w-5 text-foreground" />
            Post Announcement
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
              required
              className="bg-[#0D1B2A] rounded-xl border border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement details..."
              rows={4}
              required
              className="bg-[#0D1B2A] rounded-xl border border-border resize-none"
            />
          </div>

          {/* Priority pills */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Priority</Label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all border ${
                    priority === p.value
                      ? `${p.ring} ring-2 border-border bg-[#00BCD4] text-white`
                      : "border-border bg-[#0D1B2A] hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full ${p.color}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-[#0D1B2A] p-3">
            <div className="flex items-center gap-2">
              <TbPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Pin to top</span>
            </div>
            <Switch checked={isPinned} onCheckedChange={setIsPinned} />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#00BCD4] hover:brightness-105 text-white border border-border"
            disabled={loading}
          >
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post Announcement
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
