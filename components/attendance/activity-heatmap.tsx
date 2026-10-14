"use client"

import { useMemo } from "react"
import { useAttendance } from "@/hooks/use-attendance"
import { GlassCard } from "@/components/shared/glass-card"
import { TbFlame } from "react-icons/tb"

const WORK_START = 9  // 9 AM
const WORK_END = 20   // 8 PM
const HOURS = Array.from({ length: WORK_END - WORK_START + 1 }, (_, i) => WORK_START + i)

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-[#1A2B45]"
  if (count <= 15) return "bg-[#00BCD4]/15"
  if (count <= 30) return "bg-[#00BCD4]/30"
  if (count <= 45) return "bg-[#00BCD4]"
  return "bg-[#00BCD4]"
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return "12 PM"
  return `${hour - 12} PM`
}

/**
 * Pure heatmap strip driven by an array of minute-bucket ISO strings.
 * Reused by the personal dashboard and the team activity rows.
 */
export function ActivityHeatmapStrip({ buckets, compact = false }: { buckets: string[]; compact?: boolean }) {
  const hourCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const h of HOURS) counts[h] = 0
    for (const bucket of buckets) {
      const hour = new Date(bucket).getHours()
      if (hour >= WORK_START && hour <= WORK_END) {
        counts[hour] = (counts[hour] || 0) + 1
      }
    }
    return counts
  }, [buckets])

  return (
    <div className="flex gap-1">
      {HOURS.map((hour) => {
        const count = hourCounts[hour] || 0
        return (
          <div key={hour} className="flex-1 min-w-0">
            <div
              className={`${compact ? "h-5" : "h-8"} rounded-md ${getIntensityClass(count)} transition-colors duration-300`}
              title={`${formatHour(hour)}: ${count} min active`}
            />
            {hour % 2 === 0 && (
              <p className="text-[9px] text-muted-foreground/50 text-center mt-1 tabular-nums">
                {hour > 12 ? hour - 12 : hour}{hour >= 12 ? "p" : "a"}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function HeatmapLegend() {
  return (
    <div className="flex items-center justify-end gap-2 mt-3">
      <span className="text-[10px] text-muted-foreground/50">Less</span>
      <div className="flex gap-0.5">
        <div className="w-3 h-3 rounded-md bg-[#1A2B45]" />
        <div className="w-3 h-3 rounded-md bg-[#00BCD4]/15" />
        <div className="w-3 h-3 rounded-md bg-[#00BCD4]/30" />
        <div className="w-3 h-3 rounded-md bg-[#00BCD4]" />
        <div className="w-3 h-3 rounded-md bg-[#00BCD4]" />
      </div>
      <span className="text-[10px] text-muted-foreground/50">More</span>
    </div>
  )
}

/**
 * Card-wrapped heatmap for the personal dashboard (reads its own buckets
 * from the attendance context).
 */
export function ActivityHeatmap() {
  const { minuteBuckets, loading } = useAttendance()

  if (loading) return null
  if (minuteBuckets.length === 0) return null

  return (
    <GlassCard className="group transition-all duration-300 hover:translate-y-[-2px] overflow-hidden relative">

      <div className="relative">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F172A] text-white shadow-soft flex items-center justify-center">
            <TbFlame className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Activity Heatmap</p>
            <p className="text-[11px] text-muted-foreground/70">
              Hourly activity breakdown
            </p>
          </div>
        </div>

        <ActivityHeatmapStrip buckets={minuteBuckets} />
        <HeatmapLegend />
      </div>
    </GlassCard>
  )
}
