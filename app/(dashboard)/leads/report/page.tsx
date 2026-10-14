"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { TbArrowLeft, TbLoader2, TbReportAnalytics } from "react-icons/tb"

interface Bucket {
  total: number
  reached: number
  interested: number
  won: number
  lost: number
  notInterested: number
}
interface Report {
  scope: string
  overall: Bucket
  bySetter: (Bucket & { id: string; name: string })[]
  byProject: (Bucket & { label: string })[]
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

export default function LeadReportPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/leads/report")
      .then((r) => (r.ok ? r.json() : null))
      .then(setReport)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => window.history.back()}>
          <TbArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F172A] text-white border border-border">
            <TbReportAnalytics className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lead Report</h1>
            <p className="text-sm text-muted-foreground">Outcomes &amp; conversion rates</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><TbLoader2 className="h-6 w-6 animate-spin" /></div>
      ) : !report || report.overall.total === 0 ? (
        <GlassCard><p className="text-sm text-muted-foreground text-center py-10">No lead data yet.</p></GlassCard>
      ) : (
        <>
          {/* Headline scorecard */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total" value={report.overall.total} />
            <Stat label="Contact rate" value={`${pct(report.overall.reached, report.overall.total)}%`} />
            <Stat label="Interested" value={report.overall.interested} tone="purple" />
            <Stat label="Won" value={`${report.overall.won} · ${pct(report.overall.won, report.overall.total)}%`} tone="emerald" />
            <Stat label="Lost" value={report.overall.lost} tone="red" />
            <Stat label="Not interested" value={report.overall.notInterested} tone="gray" />
          </div>

          {/* Per setter */}
          {report.bySetter.length > 0 && (
            <GlassCard className="space-y-3">
              <p className="text-sm font-semibold">By setter</p>
              <BreakdownTable
                nameHeader="Setter"
                rows={report.bySetter.map((s) => ({ ...s, key: s.id }))}
              />
            </GlassCard>
          )}

          {/* Per project (admins/managers) */}
          {report.byProject.length > 0 && (
            <GlassCard className="space-y-3">
              <p className="text-sm font-semibold">By project (sheet)</p>
              <BreakdownTable
                nameHeader="Project"
                rows={report.byProject.map((p) => ({ ...p, key: p.label, name: p.label }))}
              />
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone = "blue" }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    blue: "text-foreground", purple: "text-foreground", emerald: "text-foreground",
    red: "text-foreground", gray: "text-muted-foreground",
  }
  return (
    <GlassCard className="p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold mt-1 tabular-nums ${tones[tone]}`}>{value}</p>
    </GlassCard>
  )
}

function BreakdownTable({
  nameHeader, rows,
}: {
  nameHeader: string
  rows: (Bucket & { key: string; name: string })[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 px-2">{nameHeader}</th>
            <th className="py-2 px-2 text-right">Total</th>
            <th className="py-2 px-2 text-right">Contact %</th>
            <th className="py-2 px-2 text-right">Interested</th>
            <th className="py-2 px-2 text-right">Won</th>
            <th className="py-2 px-2 text-right">Win %</th>
            <th className="py-2 px-2 text-right">Lost</th>
            <th className="py-2 px-2 text-right">Not int.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b">
              <td className="py-2 px-2 font-medium">{r.name}</td>
              <td className="py-2 px-2 text-right tabular-nums">{r.total}</td>
              <td className="py-2 px-2 text-right tabular-nums">{pct(r.reached, r.total)}%</td>
              <td className="py-2 px-2 text-right tabular-nums text-foreground">{r.interested}</td>
              <td className="py-2 px-2 text-right tabular-nums text-foreground font-semibold bg-[#00BCD4]/15">{r.won}</td>
              <td className="py-2 px-2 text-right tabular-nums text-foreground font-semibold bg-[#00BCD4]/15">{pct(r.won, r.total)}%</td>
              <td className="py-2 px-2 text-right tabular-nums text-foreground">{r.lost}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{r.notInterested}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
