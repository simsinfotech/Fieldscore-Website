"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { GlassCard } from "@/components/shared/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { TbPlus, TbLoader2, TbTarget, TbChevronDown, TbChevronUp, TbSparkles } from "react-icons/tb"
import { toast } from "sonner"
import type { Okr, KeyResult, Employee } from "@/types"

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"]

/* ---------- tiny SVG progress ring ---------- */
function ProgressRing({ progress, size = 56, stroke = 5 }: { progress: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (Math.min(progress, 100) / 100) * circ
  const color = "#00BCD4"

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#F1F5F9"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize={size * 0.22}
        fontWeight="600"
        className="rotate-90 origin-center"
      >
        {Math.round(progress)}%
      </text>
    </svg>
  )
}

/* ---------- progress bar for key results ---------- */
function KRProgressBar({ percent }: { percent: number }) {
  const barColor = percent >= 70 ? "bg-[#34D399]" : "bg-[#00BCD4]"

  return (
    <div className="relative h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-500 ease-out`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

export default function OkrsPage() {
  const { employee, isAdmin } = useUser()
  const orgId = useOrg()
  const supabase = createClient()

  const [okrs, setOkrs] = useState<Okr[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedQuarter, setSelectedQuarter] = useState(
    `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`
  )
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!employee) return
    fetchData()
    const channel = supabase
      .channel(`okrs-${employee.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fs_okrs" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "fs_key_results" }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, orgId, selectedQuarter, selectedYear])

  async function fetchData() {
    let query = supabase
      .from("fs_okrs")
      .select("*, key_results:fs_key_results(*), employee:fs_employees(*)")
      .eq("quarter", selectedQuarter)
      .eq("year", parseInt(selectedYear))
      .order("created_at", { ascending: false })

    if (!isAdmin) {
      query = query.eq("employee_id", employee!.id)
    }

    const { data } = await query
    if (data) {
      const filtered = isAdmin
        ? data.filter((o: any) => o.employee?.org_id === orgId)
        : data
      setOkrs(filtered as unknown as Okr[])
    }

    if (isAdmin) {
      const { data: emps } = await supabase
        .from("fs_employees")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
      if (emps) setEmployees(emps)
    }
  }

  async function updateKeyResult(krId: string, currentValue: number) {
    const { error } = await supabase
      .from("fs_key_results")
      .update({ current_value: currentValue })
      .eq("id", krId)
    if (!error) fetchData()
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    on_track: { label: "On Track", bg: "bg-[#DBEAFE]", text: "text-white", dot: "bg-[#34D399]" },
    at_risk: { label: "At Risk", bg: "bg-[#EDE9FE]", text: "text-white", dot: "bg-[#0F172A]" },
    behind: { label: "Behind", bg: "bg-destructive/15", text: "text-destructive", dot: "bg-destructive" },
    completed: { label: "Completed", bg: "bg-[#00BCD4]", text: "text-white", dot: "bg-[#0F172A]" },
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-white">
            <TbTarget className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">OKRs</h1>
            <p className="text-sm text-muted-foreground">Objectives &amp; Key Results</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quarter pills */}
          <div className="flex rounded-full bg-secondary p-1 gap-0.5">
            {QUARTERS.map((q) => (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                  selectedQuarter === q
                    ? "bg-[#00BCD4] text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Year select */}
          <Select value={selectedYear} onValueChange={(v) => v !== null && setSelectedYear(v)}>
            <SelectTrigger className="w-[90px] h-9 bg-[#0D1B2A] border border-border rounded-xl text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <NewOkrDialog
              employees={employees}
              quarter={selectedQuarter}
              year={parseInt(selectedYear)}
              onSuccess={fetchData}
            />
          )}
        </div>
      </div>

      {/* ---- OKR Cards ---- */}
      <div className="space-y-5">
        {okrs.length === 0 ? (
          /* Empty state */
          <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0F172A] text-white mb-4">
              <TbTarget className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No OKRs for {selectedQuarter} {selectedYear}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Set ambitious objectives and track your key results to stay aligned with your goals.
            </p>
          </GlassCard>
        ) : (
          okrs.map((okr) => {
            const expanded = expandedIds.has(okr.id)
            const st = statusConfig[okr.status] ?? statusConfig.on_track

            return (
              <GlassCard key={okr.id} className="space-y-0 overflow-hidden !p-0">
                {/* card top band */}
                <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
                  {/* left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`${st.bg} ${st.text} gap-1.5 rounded-full text-[11px] font-semibold`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </Badge>
                      {isAdmin && okr.employee && (
                        <span className="text-xs text-muted-foreground truncate">
                          {okr.employee.full_name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold leading-snug">{okr.title}</h3>
                    {okr.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {okr.description}
                      </p>
                    )}
                  </div>

                  {/* right: progress ring */}
                  <ProgressRing progress={okr.progress} />
                </div>

                {/* key results toggle */}
                {okr.key_results && okr.key_results.length > 0 && (
                  <>
                    <button
                      onClick={() => toggleExpand(okr.id)}
                      className="w-full flex items-center justify-between px-6 py-3 border-t border-border hover:bg-secondary transition-colors text-sm"
                    >
                      <span className="font-medium text-muted-foreground">
                        {okr.key_results.length} Key Result{okr.key_results.length > 1 ? "s" : ""}
                      </span>
                      {expanded ? (
                        <TbChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <TbChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {expanded && (
                      <div className="px-6 pb-5 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        {okr.key_results.map((kr) => {
                          const percent =
                            kr.target_value > 0
                              ? Math.round((kr.current_value / kr.target_value) * 100)
                              : 0
                          return (
                            <div key={kr.id} className="space-y-2 rounded-2xl bg-secondary p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate">{kr.title}</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {kr.current_value} / {kr.target_value} {kr.unit ?? ""}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <KRProgressBar percent={percent} />
                                </div>
                                <span className="text-xs font-semibold min-w-[36px] text-right">
                                  {percent}%
                                </span>
                                <Input
                                  type="number"
                                  value={kr.current_value}
                                  onChange={(e) =>
                                    updateKeyResult(kr.id, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-[72px] h-7 text-xs bg-[#0D1B2A] border border-border rounded-xl"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </GlassCard>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ============================================ */
/*              New OKR Dialog                  */
/* ============================================ */
function NewOkrDialog({
  employees,
  quarter,
  year,
  onSuccess,
}: {
  employees: Employee[]
  quarter: string
  year: number
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [keyResults, setKeyResults] = useState([
    { title: "", target_value: "", unit: "" },
  ])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  function addKR() {
    setKeyResults([...keyResults, { title: "", target_value: "", unit: "" }])
  }

  function updateKR(i: number, field: string, value: string) {
    setKeyResults(
      keyResults.map((kr, idx) => (idx === i ? { ...kr, [field]: value } : kr))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !employeeId) return
    setLoading(true)

    const { data: okr, error } = await supabase
      .from("fs_okrs")
      .insert({
        title,
        description: description || null,
        employee_id: employeeId,
        quarter,
        year,
      })
      .select()
      .single()

    if (error || !okr) {
      toast.error("Failed to create OKR")
      setLoading(false)
      return
    }

    const validKRs = keyResults.filter((kr) => kr.title && kr.target_value)
    if (validKRs.length > 0) {
      await supabase.from("fs_key_results").insert(
        validKRs.map((kr) => ({
          okr_id: okr.id,
          title: kr.title,
          target_value: parseFloat(kr.target_value),
          unit: kr.unit || null,
        }))
      )
    }

    toast.success("OKR created!")
    setOpen(false)
    setTitle("")
    setDescription("")
    setEmployeeId("")
    setKeyResults([{ title: "", target_value: "", unit: "" }])
    onSuccess()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#00BCD4] hover:bg-[#00ACC1] text-white">
          <TbPlus className="mr-2 h-4 w-4" />
          New OKR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0F172A] text-white">
              <TbTarget className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <DialogTitle>Create OKR</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{quarter} {year}</p>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Objective</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to achieve?"
              required
              className="bg-[#0D1B2A] border border-border rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="More details..."
              rows={2}
              className="bg-[#0D1B2A] border border-border rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Assign To</Label>
            <Select value={employeeId} onValueChange={(v) => v !== null && setEmployeeId(v)}>
              <SelectTrigger className="bg-[#0D1B2A] border border-border rounded-xl">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground">Key Results</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addKR} className="text-foreground hover:text-foreground h-7 text-xs">
                <TbPlus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {keyResults.map((kr, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={kr.title}
                  onChange={(e) => updateKR(i, "title", e.target.value)}
                  placeholder="Key result"
                  className="flex-1 bg-[#0D1B2A] border border-border rounded-xl"
                />
                <Input
                  type="number"
                  value={kr.target_value}
                  onChange={(e) => updateKR(i, "target_value", e.target.value)}
                  placeholder="Target"
                  className="w-20 bg-[#0D1B2A] border border-border rounded-xl"
                />
                <Input
                  value={kr.unit}
                  onChange={(e) => updateKR(i, "unit", e.target.value)}
                  placeholder="Unit"
                  className="w-20 bg-[#0D1B2A] border border-border rounded-xl"
                />
              </div>
            ))}
          </div>
          <Button
            type="submit"
            className="w-full bg-[#00BCD4] hover:bg-[#00ACC1] text-white"
            disabled={loading}
          >
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            <TbSparkles className="mr-2 h-4 w-4" />
            Create OKR
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
