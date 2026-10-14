"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Hook that uses the Screen Wake Lock API to prevent the device screen from
 * turning off. Designed for the attendance check-in flow so that users' phones
 * stay awake while they are clocked in.
 *
 * - Gracefully degrades to a no-op on unsupported browsers.
 * - Re-acquires the lock when the tab becomes visible again (browsers
 *   automatically release wake locks when a tab is hidden).
 */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const [isActive, setIsActive] = useState(false)
  const desiredRef = useRef(false)

  const acquire = useCallback(async () => {
    desiredRef.current = true

    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return
    if (document.visibilityState !== "visible") return

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen")
      setIsActive(true)

      wakeLockRef.current.addEventListener("release", () => {
        setIsActive(false)
        wakeLockRef.current = null
      })
    } catch {
      // Wake lock request can fail (e.g. low battery mode). Silently ignore.
    }
  }, [])

  const release = useCallback(async () => {
    desiredRef.current = false

    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch {
        // Already released
      }
      wakeLockRef.current = null
      setIsActive(false)
    }
  }, [])

  // Re-acquire on visibility change when desired
  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        desiredRef.current &&
        !wakeLockRef.current
      ) {
        acquire()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [acquire])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [])

  return { isActive, acquire, release }
}
