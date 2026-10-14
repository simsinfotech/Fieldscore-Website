"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useUser } from "./use-user"
import {
  HEARTBEAT_INTERVAL_MS,
  IDLE_THRESHOLD_MS,
} from "@/lib/attendance/constants"

export interface IdleState {
  /** True when the user has not interacted for longer than IDLE_THRESHOLD_MS */
  isIdle: boolean
  /** Timestamp (ms) when the user crossed the idle threshold, or null when active */
  idleSince: number | null
}

/** Check if the Chrome extension is handling heartbeats. */
function isExtensionActive(): boolean {
  return !!(globalThis as Record<string, unknown>).__EXTENSION_ACTIVE
}

export function useActivityHeartbeat(): IdleState {
  const { employee } = useUser()
  const lastInteraction = useRef(Date.now())
  const wasIdle = useRef(false)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isIdle, setIsIdle] = useState(false)
  const [idleSince, setIdleSince] = useState<number | null>(null)

  const updateInteraction = useCallback(() => {
    lastInteraction.current = Date.now()
  }, [])

  useEffect(() => {
    if (!employee) return

    // ── Interaction tracking ──
    // DOM events cover activity while the tab is visible.
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"] as const
    for (const evt of events) {
      window.addEventListener(evt, updateInteraction, { passive: true })
    }

    // ── Idle detection (drives UI status) ──
    // State only updates on transitions (active→idle or idle→active),
    // so this does not cause per-second re-renders while the user stays
    // in the same state.
    idleCheckRef.current = setInterval(() => {
      const idle = Date.now() - lastInteraction.current > IDLE_THRESHOLD_MS
      if (idle !== wasIdle.current) {
        wasIdle.current = idle
        setIsIdle(idle)
        setIdleSince(idle ? lastInteraction.current + IDLE_THRESHOLD_MS : null)
      }
    }, 1_000)

    // ── Heartbeat (drives server-side activity_minutes) ──
    // When the Chrome extension is installed, it handles heartbeats via
    // the chrome.idle API (system-wide mouse/keyboard detection). The
    // in-tab heartbeat is a fallback for employees without the extension.
    heartbeatRef.current = setInterval(() => {
      // Extension is handling heartbeats — skip to avoid double-counting.
      // (The server dedupes via ON CONFLICT anyway, but this saves requests.)
      if (isExtensionActive()) return

      // Only send heartbeats when the tab is visible and user is active.
      if (document.visibilityState !== "visible") return

      const elapsed = Date.now() - lastInteraction.current
      if (elapsed > IDLE_THRESHOLD_MS) return

      fetch("/api/attendance/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {
        // Silently ignore heartbeat failures
      })
    }, HEARTBEAT_INTERVAL_MS)

    // NOTE: We intentionally do NOT soft-close sessions on pagehide /
    // beforeunload. Attendance sessions must persist until the user
    // manually checks out or the end-of-day auto-close fires. Closing
    // the tab / switching apps should not end the check-in.

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, updateInteraction)
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (idleCheckRef.current) clearInterval(idleCheckRef.current)
    }
  }, [employee?.id, updateInteraction])

  return { isIdle, idleSince }
}
