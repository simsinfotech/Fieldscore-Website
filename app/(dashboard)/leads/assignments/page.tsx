"use client"

import { useEffect, useState, useCallback } from "react"
import { useUser } from "@/hooks/use-user"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TbArrowsShuffle,
  TbPlus,
  TbLoader2,
  TbTrash,
  TbPlayerPause,
  TbPlayerPlay,
} from "react-icons/tb"
import { toast } from "sonner"
import type { AssignmentRule } from "@/types"

interface RuleWithPool extends AssignmentRule {
  pool_root?: { id: string; full_name: string } | null
}

export default function AssignmentsPage() {
  const { employee, isAdmin } = useUser()
  const [rules, setRules] = useState<RuleWithPool[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/leads/assignment-rules")
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules)
      }
    } catch (err) {
      console.error("Failed to fetch rules:", err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!employee || !isAdmin) return
    fetchRules()
  }, [employee?.id, isAdmin, fetchRules])

  async function toggleRule(ruleId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/leads/assignment-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      })
      if (res.ok) {
        toast.success(isActive ? "Rule paused" : "Rule activated")
        fetchRules()
      }
    } catch {
      toast.error("Failed to update rule")
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("Delete this assignment rule?")) return
    try {
      const res = await fetch(`/api/leads/assignment-rules/${ruleId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Rule deleted")
        fetchRules()
      }
    } catch {
      toast.error("Failed to delete rule")
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground">
          Only admins can manage assignment rules.
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
            <TbArrowsShuffle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Assignment Rules
            </h1>
            <p className="text-sm text-muted-foreground">
              Auto-distribute leads to setters via round-robin
            </p>
          </div>
        </div>
        <CreateRuleDialog onSuccess={fetchRules} />
      </div>

      {/* Rules List */}
      {loading ? (
        <GlassCard className="flex items-center justify-center py-16">
          <TbLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </GlassCard>
      ) : rules.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00BCD4] border border-border mb-4">
            <TbArrowsShuffle className="h-7 w-7 text-[#0F172A]" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No assignment rules yet
          </h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Create a round-robin rule to automatically distribute leads to
            setters.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-3xl border border-border bg-[#0D1B2A] p-5 space-y-3 shadow-soft transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        rule.is_active
                          ? "bg-[#00BCD4]"
                          : "bg-[#EDE9FE]"
                      }`}
                    />
                    <h3 className="font-semibold text-sm">{rule.label}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    Strategy: {rule.strategy.replace("_", " ")}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={`text-[10px] rounded-full border border-border ${
                    rule.is_active
                      ? "bg-[#DBEAFE] text-foreground"
                      : "bg-[#EDE9FE] text-muted-foreground"
                  }`}
                >
                  {rule.is_active ? "Active" : "Paused"}
                </Badge>
              </div>

              {rule.pool_root && (
                <p className="text-xs text-muted-foreground">
                  Pool: Subtree of{" "}
                  <strong>{rule.pool_root.full_name}</strong>
                </p>
              )}

              {rule.source_filter && rule.source_filter.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {rule.source_filter.map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="text-[10px] rounded-full bg-secondary text-foreground border border-border"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleRule(rule.id, rule.is_active)}
                  className="text-xs h-8 rounded-xl"
                >
                  {rule.is_active ? (
                    <TbPlayerPause className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <TbPlayerPlay className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {rule.is_active ? "Pause" : "Resume"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteRule(rule.id)}
                  className="text-xs h-8 rounded-xl text-destructive hover:bg-destructive/15 hover:text-destructive ml-auto"
                >
                  <TbTrash className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateRuleDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [label, setLabel] = useState("")
  const [strategy, setStrategy] = useState("round_robin")
  const [sourceFilter, setSourceFilter] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label) return
    setLoading(true)

    const filters = sourceFilter
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      const res = await fetch("/api/leads/assignment-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          strategy,
          source_filter: filters,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create rule")
      } else {
        toast.success("Assignment rule created!")
        setOpen(false)
        setLabel("")
        setSourceFilter("")
        onSuccess()
      }
    } catch {
      toast.error("Something went wrong")
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0D1B2A] hover:bg-[#1A2B45] text-white border border-[#1A2B45]">
          <TbPlus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TbArrowsShuffle className="h-5 w-5 text-foreground" />
            Create Assignment Rule
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Rule Name</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Round Robin — All Sources"
              required
              className="bg-[#0D1B2A] border-border rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select value={strategy} onValueChange={(v) => v && setStrategy(v)}>
              <SelectTrigger className="bg-[#0D1B2A] border-border rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round Robin</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Source Filter (optional)</Label>
            <Input
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              placeholder="google_sheets, excel (comma-separated)"
              className="bg-[#0D1B2A] border-border rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to match all sources.
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading || !label}
            className="w-full bg-[#0F172A] hover:bg-[#0F172A] text-white border border-border rounded-xl"
          >
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Rule
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
