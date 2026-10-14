"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/hooks/use-user"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { TbArrowLeft, TbLoader2 } from "react-icons/tb"
import { toast } from "sonner"
import type { WorkType, RecurrenceType, Department, Employee } from "@/types"

const TYPES: { value: WorkType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "content", label: "Content" },
  { value: "campaign", label: "Campaign" },
  { value: "bug", label: "Bug" },
]
const TYPE_ITEMS = Object.fromEntries(TYPES.map((t) => [t.value, t.label]))
const PRIORITY_ITEMS = { "1": "P1", "2": "P2", "3": "P3", "4": "P4", "5": "P5" }
const RECURRENCE_ITEMS: Record<RecurrenceType, string> = { none: "None", daily: "Daily", weekly: "Weekly" }

export default function NewWorkPage() {
  const router = useRouter()
  const { employee, isAdmin } = useUser()

  const [title, setTitle] = useState("")
  const [type, setType] = useState<WorkType>("task")
  const [priority, setPriority] = useState("3")
  const [assignee, setAssignee] = useState("none")
  const [dept, setDept] = useState("none")
  const [due, setDue] = useState("")
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])
  const [people, setPeople] = useState<Pick<Employee, "id" | "full_name">[]>([])

  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then((d) => setDepartments(d.departments || [])).catch(() => {})
    fetch("/api/people").then((r) => r.json()).then((d) => setPeople(d.people || [])).catch(() => {})
  }, [])

  const canAssignOthers = isAdmin || employee?.role === "manager"
  const assignablePeople = canAssignOthers
    ? people
    : employee
      ? [{ id: employee.id, full_name: employee.full_name }]
      : []

  const assigneeItems: Record<string, string> = {
    none: "Unassigned",
    ...Object.fromEntries(assignablePeople.map((p) => [p.id, p.full_name])),
  }
  const deptItems: Record<string, string> = {
    none: "None",
    ...Object.fromEntries(departments.map((d) => [d.id, d.name])),
  }

  async function save() {
    if (!title.trim()) { toast.error("Title is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, type, priority: Number(priority),
          assigned_to: assignee !== "none" ? assignee : null,
          department_id: dept !== "none" ? dept : null,
          due_at: due ? new Date(due).toISOString() : null,
          recurrence,
          description: description || null,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "Failed"); return }
      const { item } = await res.json()
      toast.success("Work item created")
      // Land on the detail page so files/links can be attached right away.
      router.push(`/work/${item.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/work" className="text-muted-foreground hover:text-foreground">
          <TbArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader title="New work item" description="Create a task, content, campaign or bug" />
      </div>

      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v as WorkType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PRIORITY_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={assignee} onValueChange={(v) => v && setAssignee(v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {assignablePeople.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={dept} onValueChange={(v) => v && setDept(v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Recurrence</Label>
            <Select value={recurrence} onValueChange={(v) => v && setRecurrence(v as RecurrenceType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Add details, context, links…" />
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? <TbLoader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create &amp; add files
          </Button>
          <Button variant="outline" onClick={() => router.push("/work")}>Cancel</Button>
        </div>
      </GlassCard>
    </div>
  )
}
