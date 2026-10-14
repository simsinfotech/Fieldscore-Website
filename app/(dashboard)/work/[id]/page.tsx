"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { CanvasEditor } from "@/components/work/canvas-editor"
import { ImageLightbox } from "@/components/work/image-lightbox"
import {
  TbArrowLeft, TbLoader2, TbTrash, TbLink, TbDownload, TbFile,
  TbUpload, TbCheck, TbCircleDashed, TbUser, TbBuilding, TbCalendar,
  TbFlag, TbProgress, TbPhoto, TbX, TbUserPlus,
  TbClock, TbPlayerPlay, TbPlayerStop, TbRepeat,
} from "react-icons/tb"
import { toast } from "sonner"
import { format } from "date-fns"
import type { WorkItem, WorkStatus, WorkType, WorkAttachment, WorkTimeEntry, RecurrenceType, Department, Employee } from "@/types"

const RECURRENCE_ITEMS: Record<RecurrenceType, string> = {
  none: "None",
  daily: "Daily",
  weekly: "Weekly",
}

const TYPES: { value: WorkType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "content", label: "Content" },
  { value: "campaign", label: "Campaign" },
  { value: "bug", label: "Bug" },
]
const PRIORITY_ITEMS = { "1": "P1", "2": "P2", "3": "P3", "4": "P4", "5": "P5" }
const STATUS_ORDER: WorkStatus[] = [
  "backlog", "todo", "in_progress", "review", "approved", "blocked", "done", "cancelled",
]
const STATUS_LABEL: Record<WorkStatus, string> = {
  backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review",
  approved: "Approved", blocked: "Blocked", done: "Done", cancelled: "Cancelled",
}

function formatBytes(n?: number | null) {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
const isImage = (a: WorkAttachment) => a.kind === "file" && !!a.mime_type?.startsWith("image/")

type SaveState = "idle" | "saving" | "saved"

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { employee, isAdmin } = useUser()
  const supabase = createClient()

  const [item, setItem] = useState<WorkItem | null>(null)
  const [attachments, setAttachments] = useState<WorkAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>("idle")

  const [departments, setDepartments] = useState<Department[]>([])
  const [people, setPeople] = useState<Pick<Employee, "id" | "full_name">[]>([])

  const load = useCallback(async () => {
    const [itemRes, attRes] = await Promise.all([
      fetch(`/api/work-items/${id}`),
      fetch(`/api/work-items/${id}/attachments`),
    ])
    if (itemRes.status === 404 || itemRes.status === 403) { setNotFound(true); setLoading(false); return }
    if (itemRes.ok) setItem((await itemRes.json()).item)
    if (attRes.ok) setAttachments((await attRes.json()).attachments || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    fetch("/api/departments").then((r) => r.json()).then((d) => setDepartments(d.departments || [])).catch(() => {})
    // Workspace people via the admin-backed endpoint so names resolve for
    // everyone (RLS otherwise limits a non-admin to their own row).
    fetch("/api/people").then((r) => r.json()).then((d) => setPeople(d.people || [])).catch(() => {})
    // Realtime for props/status/attachments. The canvas body seeds once (the
    // editor is keyed by item id), so background refreshes never disrupt typing;
    // the body itself is last-writer-wins.
    const channel = supabase
      .channel(`work-item-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_items", filter: `id=eq.${id}` }, () => {
        fetch(`/api/work-items/${id}`).then((r) => r.ok ? r.json() : null).then((d) => d?.item && setItem(d.item)).catch(() => {})
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "work_item_attachments", filter: `work_item_id=eq.${id}` }, () => {
        fetch(`/api/work-items/${id}/attachments`).then((r) => r.ok ? r.json() : null).then((d) => d && setAttachments(d.attachments || [])).catch(() => {})
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, load, supabase])

  const canEdit = !!item && (isAdmin || item.created_by === employee?.id)
  const canChangeStatus = !!item && (canEdit || item.assigned_to === employee?.id)
  const canAssignOthers = isAdmin || employee?.role === "manager"

  // Task scope = its members: creator + assignee + added people (watchers).
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p.full_name])), [people])
  const participantIds = useMemo(() => {
    if (!item) return [] as string[]
    return [...new Set([
      item.created_by,
      ...(item.assigned_to ? [item.assigned_to] : []),
      ...(item.watchers ?? []),
    ])]
  }, [item])
  const isMember = !!item && (isAdmin || (!!employee && participantIds.includes(employee.id)))
  const canEditBody = isMember
  // @mentions on a task are scoped to that task's members only.
  const mentionItems = useCallback(
    (query: string) =>
      participantIds
        .map((pid) => ({ id: pid, label: peopleById.get(pid) || "Someone" }))
        .filter((m) => m.label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8),
    [participantIds, peopleById]
  )

  // Persist field changes without reloading the whole item (keeps the editor
  // from being disrupted mid-typing).
  const saveField = useCallback(async (patch: Record<string, unknown>) => {
    setSaveState("saving")
    const res = await fetch(`/api/work-items/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || "Failed to save")
      setSaveState("idle")
      return
    }
    const { item: updated } = await res.json()
    setItem((prev) => (prev ? { ...prev, ...updated } : prev))
    setSaveState("saved")
    setTimeout(() => setSaveState("idle"), 1200)
  }, [id])

  // Upload a pasted/dropped/inserted canvas image → stable proxy src.
  const uploadCanvasImage = useCallback(async (file: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch(`/api/work-items/${id}/images`, { method: "POST", body: fd })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || "Image upload failed")
      return null
    }
    return (await res.json()).src as string
  }, [id])

  async function removeItem() {
    if (!confirm("Delete this work item and its attachments?")) return
    const res = await fetch(`/api/work-items/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to delete"); return }
    toast.success("Deleted")
    router.push("/work")
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-muted-foreground"><TbLoader2 className="h-6 w-6 animate-spin" /></div>
  }
  if (notFound || !item) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/work" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <TbArrowLeft className="h-4 w-4" /> Back to Work
        </Link>
        <div className="rounded-3xl border border-border bg-[#0D1B2A] p-10 text-center text-sm text-muted-foreground shadow-soft">
          Work item not found, or you don&apos;t have access.
        </div>
      </div>
    )
  }

  const assignablePeople = canAssignOthers ? people : employee ? [{ id: employee.id, full_name: employee.full_name }] : []
  const assignableItems: Record<string, string> = {
    none: "Unassigned",
    ...Object.fromEntries(assignablePeople.map((p) => [p.id, p.full_name])),
    ...(item.assigned_to && item.assignee ? { [item.assigned_to]: item.assignee.full_name } : {}),
  }
  const deptItems: Record<string, string> = { none: "None", ...Object.fromEntries(departments.map((d) => [d.id, d.name])) }
  const initialBody = (item.body ?? item.description ?? "") as unknown

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <Link href="/work" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <TbArrowLeft className="h-4 w-4" /> Back to Work
        </Link>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          {canEdit && (
            <button onClick={removeItem} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive">
              <TbTrash className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Document canvas (full space, no box) ── */}
      <div className="px-1 pb-28 sm:px-3">
        {/* meta chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono font-semibold text-foreground">{item.reference}</span>
          <span className="rounded-full border border-border px-2.5 py-0.5 capitalize text-muted-foreground">{item.type}</span>
          <span className="rounded-full bg-[#00BCD4]/20 px-2.5 py-0.5 font-medium text-[#1E40AF]">P{item.priority}</span>
          {item.recurrence && item.recurrence !== "none" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#8B5CF6]/15 px-2.5 py-0.5 font-medium text-[#6D28D9]">
              <TbRepeat className="h-3 w-3" /> {item.recurrence === "daily" ? "Daily" : "Weekly"}
            </span>
          )}
        </div>

        {/* Title */}
        <TitleField value={item.title} editable={canEdit} onSave={(title) => saveField({ title })} />

        {/* Properties */}
        <div className="mt-4 space-y-0.5 border-y border-border/70 py-3">
          <PropertyRow icon={<TbProgress className="h-4 w-4" />} label="Status">
            {canChangeStatus ? (
              <InlineSelect value={item.status} items={STATUS_LABEL} onChange={(v) => saveField({ status: v })}>
                {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </InlineSelect>
            ) : <PropText>{STATUS_LABEL[item.status]}</PropText>}
          </PropertyRow>
          <PropertyRow icon={<TbUser className="h-4 w-4" />} label="Assignee">
            {canEdit ? (
              <InlineSelect value={item.assigned_to || "none"} items={assignableItems} onChange={(v) => saveField({ assigned_to: v === "none" ? null : v })}>
                <SelectItem value="none">Unassigned</SelectItem>
                {assignablePeople.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </InlineSelect>
            ) : <PropText>{item.assignee?.full_name ?? "Unassigned"}</PropText>}
          </PropertyRow>
          <PropertyRow icon={<TbFlag className="h-4 w-4" />} label="Priority">
            {canEdit ? (
              <InlineSelect value={String(item.priority)} items={PRIORITY_ITEMS} onChange={(v) => saveField({ priority: Number(v) })}>
                {Object.entries(PRIORITY_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </InlineSelect>
            ) : <PropText>P{item.priority}</PropText>}
          </PropertyRow>
          <PropertyRow icon={<TbBuilding className="h-4 w-4" />} label="Department">
            {canEdit ? (
              <InlineSelect value={item.department_id || "none"} items={deptItems} onChange={(v) => saveField({ department_id: v === "none" ? null : v })}>
                <SelectItem value="none">None</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </InlineSelect>
            ) : <PropText>{item.department?.name ?? "None"}</PropText>}
          </PropertyRow>
          <PropertyRow icon={<TbCalendar className="h-4 w-4" />} label="Due">
            {canEdit ? (
              <input
                type="date"
                value={item.due_at ? item.due_at.slice(0, 10) : ""}
                onChange={(e) => saveField({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm hover:border-border focus:border-border focus:outline-none"
              />
            ) : <PropText>{item.due_at ? format(new Date(item.due_at), "MMM d, yyyy") : "—"}</PropText>}
          </PropertyRow>
          <PropertyRow icon={<TbRepeat className="h-4 w-4" />} label="Recurrence">
            {canEdit ? (
              <InlineSelect value={item.recurrence || "none"} items={RECURRENCE_ITEMS} onChange={(v) => saveField({ recurrence: v })}>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </InlineSelect>
            ) : <PropText>{RECURRENCE_ITEMS[(item.recurrence || "none") as RecurrenceType]}</PropText>}
          </PropertyRow>
        </div>

        {/* People / scope — who can see, edit and be @mentioned on this task */}
        <PeopleControl
          participants={participantIds.map((pid) => ({
            id: pid,
            name: peopleById.get(pid) || "Someone",
            role: pid === item.created_by ? "owner" : pid === item.assigned_to ? "assignee" : "member",
          }))}
          canManage={canEdit}
          addable={people.filter((p) => !participantIds.includes(p.id))}
          onAdd={(pid) => saveField({ watchers: [...(item.watchers ?? []), pid] })}
          onRemove={(pid) => saveField({ watchers: (item.watchers ?? []).filter((w) => w !== pid) })}
        />

        {/* Body canvas */}
        <div className="mt-5 min-h-[240px]">
          <CanvasEditor
            key={item.id}
            content={initialBody}
            editable={canEditBody}
            mentionItems={mentionItems}
            onImageUpload={canEditBody ? uploadCanvasImage : undefined}
            placeholder="Write details — type “# ” for a heading, “- [ ] ” for a checklist, “@” to mention, or paste an image."
            onChange={({ json, text }) => saveField({ body: json, description: text })}
          />
        </div>

        {/* Timer */}
        <TimerSection workItemId={item.id} />

        {/* Files */}
        <FilesSection
          workItemId={item.id}
          attachments={attachments}
          currentEmployeeId={employee?.id}
          isAdmin={isAdmin}
          onChanged={load}
        />

        <p className="mt-10 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
          Created by {item.creator?.full_name ?? "—"} · {format(new Date(item.created_at), "MMM d, yyyy")}
        </p>
      </div>
    </div>
  )
}

/* ── Save indicator ── */
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {state === "saving" ? <TbCircleDashed className="h-3.5 w-3.5 animate-spin" /> : <TbCheck className="h-3.5 w-3.5 text-[#7a9a6f]" />}
      {state === "saving" ? "Saving…" : "Saved"}
    </span>
  )
}

/* ── Title ── */
function TitleField({ value, editable, onSave }: { value: string; editable: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)
  const autosize = () => { const t = ref.current; if (t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px" } }
  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { autosize() }, [draft, editable])
  if (!editable) return <h1 className="mt-3 text-3xl font-semibold tracking-tight">{value}</h1>
  return (
    <textarea
      ref={ref}
      value={draft}
      onChange={(e) => { setDraft(e.target.value); autosize() }}
      onBlur={() => { const v = draft.trim(); if (v && v !== value) onSave(v); else setDraft(value) }}
      rows={1}
      placeholder="Untitled"
      className="mt-3 w-full resize-none border-none bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
    />
  )
}

/* ── People / scope control ── */
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}
function PeopleControl({
  participants, canManage, addable, onAdd, onRemove,
}: {
  participants: { id: string; name: string; role: "owner" | "assignee" | "member" }[]
  canManage: boolean
  addable: { id: string; full_name: string }[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-muted-foreground">People</span>
      {participants.map((p) => (
        <span
          key={p.id}
          title={`${p.name}${p.role === "owner" ? " · owner" : p.role === "assignee" ? " · assignee" : ""}`}
          className="group inline-flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pl-0.5 pr-2.5 text-xs"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F172A] text-[9px] font-semibold text-white">
            {initials(p.name)}
          </span>
          <span className="font-medium">{p.name.split(" ")[0]}</span>
          {p.role === "owner" && <span className="text-[10px] text-muted-foreground">owner</span>}
          {canManage && p.role === "member" && (
            <button onClick={() => onRemove(p.id)} className="ml-0.5 text-muted-foreground hover:text-destructive" title="Remove from task">
              <TbX className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}

      {canManage && addable.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
          >
            <TbUserPlus className="h-3.5 w-3.5" /> Add
          </button>
          {open && (
            <div className="absolute left-0 z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-xl border border-border bg-[#0D1B2A] py-1 shadow-soft">
              {addable.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onAdd(p.id); setOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F172A] text-[9px] font-semibold text-white">
                    {initials(p.full_name)}
                  </span>
                  {p.full_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Property row + helpers ── */
function PropertyRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <div className="flex w-36 shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>{label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
function PropText({ children }: { children: React.ReactNode }) {
  return <span className="px-2 text-sm font-medium">{children}</span>
}
function InlineSelect({
  value, items, onChange, children,
}: {
  value: string; items: Record<string, React.ReactNode>
  onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-8 w-full max-w-[240px] border-transparent bg-transparent hover:border-border hover:bg-secondary/40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

/* ── Timer section ── */
function formatDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.floor(totalMinutes % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
function formatElapsed(startedAt: string) {
  const elapsed = Math.max(0, Date.now() - new Date(startedAt).getTime())
  const secs = Math.floor(elapsed / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function TimerSection({ workItemId }: { workItemId: string }) {
  const [entries, setEntries] = useState<WorkTimeEntry[]>([])
  const [running, setRunning] = useState<WorkTimeEntry | null>(null)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [elapsed, setElapsed] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/work-items/${workItemId}/timer`)
    if (!res.ok) return
    const data = await res.json()
    setEntries(data.entries || [])
    setRunning(data.running || null)
    setTotalMinutes(data.totalMinutes || 0)
  }, [workItemId])

  useEffect(() => { load() }, [load])

  // Live elapsed counter
  useEffect(() => {
    if (!running) { setElapsed(""); return }
    setElapsed(formatElapsed(running.started_at))
    const iv = setInterval(() => setElapsed(formatElapsed(running.started_at)), 1000)
    return () => clearInterval(iv)
  }, [running])

  async function start() {
    setBusy(true)
    try {
      const res = await fetch(`/api/work-items/${workItemId}/timer`, { method: "POST" })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "Failed to start timer")
        return
      }
      await load()
    } finally { setBusy(false) }
  }

  async function stop() {
    setBusy(true)
    try {
      const res = await fetch(`/api/work-items/${workItemId}/timer`, { method: "PATCH" })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "Failed to stop timer")
        return
      }
      await load()
    } finally { setBusy(false) }
  }

  const recentEntries = entries.filter((e) => e.ended_at).slice(0, 5)

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <TbClock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Time tracking</h2>
        {totalMinutes > 0 && (
          <span className="text-xs text-muted-foreground">
            Total: {formatDuration(totalMinutes)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {running ? (
          <>
            <span className="font-mono text-lg font-semibold tabular-nums text-[#DC2626]">
              {elapsed}
            </span>
            <Button variant="outline" size="sm" onClick={stop} disabled={busy}>
              {busy ? <TbLoader2 className="h-4 w-4 animate-spin mr-1.5" /> : <TbPlayerStop className="h-4 w-4 mr-1.5" />}
              Stop
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={start} disabled={busy}>
            {busy ? <TbLoader2 className="h-4 w-4 animate-spin mr-1.5" /> : <TbPlayerPlay className="h-4 w-4 mr-1.5" />}
            Start timer
          </Button>
        )}
      </div>

      {recentEntries.length > 0 && (
        <div className="mt-3 space-y-1">
          {recentEntries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{format(new Date(e.started_at), "MMM d, HH:mm")}</span>
              <span>—</span>
              <span>{e.ended_at ? format(new Date(e.ended_at), "HH:mm") : "running"}</span>
              {e.duration_minutes != null && (
                <span className="font-medium text-foreground">
                  {formatDuration(e.duration_minutes)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Files (inline, with image previews) ── */
function FilesSection({
  workItemId, attachments, currentEmployeeId, isAdmin, onChanged,
}: {
  workItemId: string; attachments: WorkAttachment[]
  currentEmployeeId?: string; isAdmin: boolean; onChanged: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkLabel, setLinkLabel] = useState("")
  const [addingLink, setAddingLink] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData(); fd.append("file", file)
      const res = await fetch(`/api/work-items/${workItemId}/attachments`, { method: "POST", body: fd })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "Upload failed"); return }
      toast.success("File attached"); onChanged()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }
  async function addLink() {
    if (!linkUrl.trim()) { toast.error("Enter a URL"); return }
    setAddingLink(true)
    try {
      const res = await fetch(`/api/work-items/${workItemId}/attachments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim(), label: linkLabel.trim() || undefined }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "Failed"); return }
      toast.success("Link added"); setLinkUrl(""); setLinkLabel(""); onChanged()
    } finally { setAddingLink(false) }
  }
  async function remove(attId: string) {
    const res = await fetch(`/api/work-items/${workItemId}/attachments/${attId}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to delete"); return }
    onChanged()
  }

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <TbPhoto className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Files &amp; links</h2>
        {attachments.length > 0 && <span className="text-xs text-muted-foreground">{attachments.length}</span>}
      </div>

      {attachments.length > 0 && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {attachments.map((a) => {
            const canDelete = isAdmin || a.uploaded_by === currentEmployeeId
            return (
              <div key={a.id} className="group overflow-hidden rounded-2xl border border-border bg-[#0D1B2A]">
                {isImage(a) ? (
                  <button
                    type="button"
                    onClick={() => setLightbox(`/api/work-items/${workItemId}/attachments/${a.id}?inline=1`)}
                    className="block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/work-items/${workItemId}/attachments/${a.id}?inline=1`} alt={a.file_name} className="h-40 w-full cursor-zoom-in object-cover" />
                  </button>
                ) : null}
                <div className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary shrink-0">
                    {a.kind === "link" ? <TbLink className="h-4 w-4" /> : <TbFile className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.file_name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {a.kind === "link" ? a.url : formatBytes(a.size_bytes)}
                      {a.uploader?.full_name ? ` · ${a.uploader.full_name}` : ""}
                    </p>
                  </div>
                  <a
                    href={`/api/work-items/${workItemId}/attachments/${a.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title={a.kind === "link" ? "Open" : "Download"}
                  >
                    {a.kind === "link" ? <TbLink className="h-4 w-4" /> : <TbDownload className="h-4 w-4" />}
                  </a>
                  {canDelete && (
                    <button onClick={() => remove(a.id)} className="rounded-full p-1.5 text-muted-foreground hover:text-destructive" title="Remove">
                      <TbTrash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <TbLoader2 className="h-4 w-4 animate-spin mr-1.5" /> : <TbUpload className="h-4 w-4 mr-1.5" />}
          Upload file
        </Button>
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Paste a link…" className="min-w-0 flex-1" />
          <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" className="w-32" />
          <Button variant="secondary" size="sm" onClick={addLink} disabled={addingLink}>
            {addingLink ? <TbLoader2 className="h-4 w-4 animate-spin" /> : <TbLink className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Sheets, images, .md, plan files… (max 25 MB)</p>
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
