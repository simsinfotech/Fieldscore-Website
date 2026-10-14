"use client"

import { useEffect, useState } from "react"
import { useAttendance } from "@/hooks/use-attendance"
import { useIdleState } from "@/app/(dashboard)/activity-heartbeat-provider"
import { TbActivityHeartbeat, TbClock, TbEye } from "react-icons/tb"

export function ActivityStatusStrip() {
  const { openSession, activeMinutes, loading } = useAttendance()
  const { isIdle, idleSince } = useIdleState()
  const [, setTick] = useState(0)

  // Tick every second when idle so the away timer and "last active"
  // label update in real time.
  useEffect(() => {
    if (!isIdle || !openSession) return
    const id = setInterval(() => setTick((t) => t + 1), 1_000)
    return () => clearInterval(id)
  }, [isIdle, !!openSession])

  if (loading) return null
  if (activeMinutes === 0 && !openSession) return null

  const hours = Math.floor(activeMinutes / 60)
  const mins = activeMinutes % 60
  const activeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  // Away time — recomputed every render (every second when idle)
  let awayLabel = "--"
  if (openSession) {
    const sessionStart = new Date(openSession.started_at).getTime()
    const now = Date.now()
    const totalMinutes = Math.floor((now - sessionStart) / 60_000)
    const idleMinutes = Math.max(0, totalMinutes - activeMinutes)
    const idleH = Math.floor(idleMinutes / 60)
    const idleM = idleMinutes % 60
    awayLabel = idleH > 0 ? `${idleH}h ${idleM}m` : `${idleM}m`
  }

  // Status: Active / Idle / Offline
  const hasSession = !!openSession
  const statusText = !hasSession ? "Offline" : isIdle ? "Idle" : "Active"
  const dotColor = !hasSession
    ? "bg-[#4A6080]"
    : isIdle
      ? "bg-amber-400"
      : "bg-[#34D399]"

  // "Last active" label
  let lastActiveLabel = "Last seen just now"
  if (isIdle && idleSince) {
    const secsAgo = Math.floor((Date.now() - idleSince) / 1_000)
    if (secsAgo < 60) {
      lastActiveLabel = `Last active ${secsAgo}s ago`
    } else {
      const minsAgo = Math.floor(secsAgo / 60)
      lastActiveLabel =
        minsAgo === 1 ? "Last active 1m ago" : `Last active ${minsAgo}m ago`
    }
  }

  return (
    <div className="flex items-center justify-center px-2">
      <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-4 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl sm:rounded-full bg-[#0D1B2A] border border-border shadow-soft text-xs sm:text-sm">
        {/* Status dot */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {hasSession && !isIdle && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`} />
          </span>
          <span className="font-medium text-foreground">{statusText}</span>
        </div>

        <span className="hidden sm:inline text-border">|</span>

        {/* Active time */}
        <div className="flex items-center gap-1.5 text-foreground">
          <TbActivityHeartbeat className="h-3.5 w-3.5" />
          <span className="tabular-nums">{activeLabel}</span>
        </div>

        <span className="hidden sm:inline text-border">|</span>

        {/* Idle time */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <TbClock className="h-3.5 w-3.5" />
          <span className="tabular-nums">{awayLabel}</span>
        </div>

        {openSession && (
          <>
            <span className="hidden sm:inline text-border">|</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TbEye className="h-3.5 w-3.5" />
              <span className="text-xs">{lastActiveLabel}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
