"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "./use-user"
import type { Attendance, AttendanceSession, TodayActivity } from "@/types"
import { format } from "date-fns"

interface UseAttendanceReturn {
  todayRecord: Attendance | null
  isCheckedIn: boolean
  isCheckedOut: boolean
  loading: boolean
  checkIn: (lat: number, lng: number, address: string) => Promise<AttendanceSession>
  checkOut: (lat: number, lng: number, address: string) => Promise<AttendanceSession>
  openSession: AttendanceSession | null
  activeMinutes: number
  sessions: AttendanceSession[]
  minuteBuckets: string[]
  refreshActivity: () => Promise<void>
}

const AttendanceContext = createContext<UseAttendanceReturn | null>(null)

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null)
  const [openSession, setOpenSession] = useState<AttendanceSession | null>(null)
  const [activeMinutes, setActiveMinutes] = useState(0)
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [minuteBuckets, setMinuteBuckets] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const { employee } = useUser()
  const supabase = useMemo(() => createClient(), [])

  const today = format(new Date(), "yyyy-MM-dd")

  const fetchToday = useCallback(async () => {
    if (!employee) return

    const { data: attendance } = await supabase
      .from("fs_attendance")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("date", today)
      .maybeSingle()

    setTodayRecord(attendance)

    try {
      const res = await fetch("/api/attendance/me/today")
      if (res.ok) {
        const activity: TodayActivity = await res.json()
        setOpenSession(activity.openSession)
        setActiveMinutes(activity.activeMinutes)
        setSessions(activity.sessions)
        setMinuteBuckets(activity.minuteBuckets)
      }
    } catch {
      // Activity fetch is non-critical
    }

    setLoading(false)
  }, [employee?.id, today, supabase])

  useEffect(() => {
    if (!employee) return
    fetchToday()

    // Poll activity data every 30s so strip/heatmap stay fresh
    const interval = setInterval(fetchToday, 30_000)
    return () => clearInterval(interval)
  }, [employee?.id, fetchToday])

  const checkIn = useCallback(
    async (lat: number, lng: number, address: string) => {
      if (!employee) throw new Error("Not logged in")

      const res = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, address }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Check-in failed")
      }

      const { session } = await res.json()
      setOpenSession(session)
      await fetchToday()
      return session
    },
    [employee?.id, fetchToday]
  )

  const checkOut = useCallback(
    async (lat: number, lng: number, address: string) => {
      if (!employee) throw new Error("Not logged in")

      const res = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, address }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Check-out failed")
      }

      const { session } = await res.json()
      setOpenSession(null)
      await fetchToday()
      return session
    },
    [employee?.id, fetchToday]
  )

  const isCheckedIn = !!todayRecord?.check_in && !todayRecord?.check_out
  const isCheckedOut = !!todayRecord?.check_out

  const value = useMemo<UseAttendanceReturn>(
    () => ({
      todayRecord,
      isCheckedIn,
      isCheckedOut,
      loading,
      checkIn,
      checkOut,
      openSession,
      activeMinutes,
      sessions,
      minuteBuckets,
      refreshActivity: fetchToday,
    }),
    [
      todayRecord,
      isCheckedIn,
      isCheckedOut,
      loading,
      checkIn,
      checkOut,
      openSession,
      activeMinutes,
      sessions,
      minuteBuckets,
      fetchToday,
    ]
  )

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  )
}

export function useAttendance(): UseAttendanceReturn {
  const ctx = useContext(AttendanceContext)
  if (!ctx) {
    throw new Error("useAttendance must be used within AttendanceProvider")
  }
  return ctx
}
