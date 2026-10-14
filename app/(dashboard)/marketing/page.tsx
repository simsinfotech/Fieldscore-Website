"use client"

import { useEffect, useState } from "react"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { TbChartBar, TbLoader2 } from "react-icons/tb"
import { format } from "date-fns"

interface SummaryRow {
  source: string
  leads: number
  contacted: number
  won: number
  connectRate: number
  winRate: number
}
interface DayRow {
  source: string
  day: string
  leads: number
  contacted: number
  won: number
  lost: number
  junk: number
}

export default function MarketingPage() {
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [rows, setRows] = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/campaign-performance")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary || [])
        setRows(d.rows || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const totals = summary.reduce(
    (acc, s) => ({ leads: acc.leads + s.leads, contacted: acc.contacted + s.contacted, won: acc.won + s.won }),
    { leads: 0, contacted: 0, won: 0 }
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Campaign Performance" description="Lead volume and connect rates by source — no contact details" />

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><TbLoader2 className="h-6 w-6 animate-spin" /></div>
      ) : summary.length === 0 ? (
        <GlassCard><p className="text-sm text-muted-foreground text-center py-10">No lead data yet.</p></GlassCard>
      ) : (
        <>
          {/* Headline totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total leads" value={totals.leads} />
            <Stat label="Contacted" value={totals.contacted} />
            <Stat label="Connect rate" value={`${totals.leads ? Math.round((totals.contacted / totals.leads) * 100) : 0}%`} />
            <Stat label="Won" value={totals.won} />
          </div>

          {/* Per-source summary */}
          <GlassCard className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-2xl bg-[#0F172A] text-white border border-border"><TbChartBar className="h-4 w-4" /></div>
              <p className="text-sm font-semibold">By source</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 px-2">Source</th>
                    <th className="py-2 px-2 text-right">Leads</th>
                    <th className="py-2 px-2 text-right">Contacted</th>
                    <th className="py-2 px-2 text-right">Connect %</th>
                    <th className="py-2 px-2 text-right">Won</th>
                    <th className="py-2 px-2 text-right">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sort((a, b) => b.leads - a.leads).map((s) => (
                    <tr key={s.source} className="border-b">
                      <td className="py-2 px-2"><Badge variant="outline" className="capitalize rounded-full">{s.source.replace("_", " ")}</Badge></td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.leads}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.contacted}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.connectRate}%</td>
                      <td className="py-2 px-2 text-right tabular-nums text-foreground font-semibold">{s.won}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-foreground font-semibold bg-[#00BCD4]/15">{s.winRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Daily breakdown */}
          <GlassCard className="space-y-3">
            <p className="text-sm font-semibold">Daily breakdown</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 px-2">Day</th>
                    <th className="py-2 px-2">Source</th>
                    <th className="py-2 px-2 text-right">Leads</th>
                    <th className="py-2 px-2 text-right">Contacted</th>
                    <th className="py-2 px-2 text-right">Won</th>
                    <th className="py-2 px-2 text-right">Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.day}-${r.source}-${i}`} className="border-b">
                      <td className="py-2 px-2 tabular-nums">{format(new Date(r.day), "MMM d")}</td>
                      <td className="py-2 px-2 capitalize">{r.source.replace("_", " ")}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.leads}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.contacted}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.won}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.lost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <GlassCard className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
    </GlassCard>
  )
}
