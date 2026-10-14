"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useAttendance } from "@/hooks/use-attendance"
import { useWakeLock } from "@/hooks/use-wake-lock"
import { TbMapPin, TbClock, TbLogin, TbLogout, TbLoader2, TbWifi, TbBuilding } from "react-icons/tb"
import { toast } from "sonner"
import { OFFICE_TIMINGS } from "@/lib/config"

export function CheckinCard() {
  const [time, setTime] = useState<Date | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const { getLocation, loading: geoLoading } = useGeolocation()
  const { todayRecord, isCheckedIn, isCheckedOut, loading, checkIn, checkOut } =
    useAttendance()
  const { acquire: acquireWakeLock, release: releaseWakeLock } = useWakeLock()

  // Acquire wake lock when already checked in on mount, release on check-out
  useEffect(() => {
    if (isCheckedIn && !isCheckedOut) {
      acquireWakeLock()
    } else {
      releaseWakeLock()
    }
  }, [isCheckedIn, isCheckedOut, acquireWakeLock, releaseWakeLock])

  useEffect(() => {
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function handleCheckIn() {
    setActionLoading(true)
    try {
      const { lat, lng, address } = await getLocation()
      await checkIn(lat, lng, address)
      toast.success("Checked in successfully!")
    } catch (err: any) {
      toast.error(err.message || "Check-in failed")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCheckOut() {
    setActionLoading(true)
    try {
      const { lat, lng, address } = await getLocation()
      await checkOut(lat, lng, address)
      toast.success("Checked out successfully!")
    } catch (err: any) {
      toast.error(err.message || "Check-out failed")
    } finally {
      setActionLoading(false)
    }
  }

  const isLoading = actionLoading || geoLoading

  // Calculate working duration
  const getWorkingDuration = () => {
    if (!todayRecord?.check_in) return null
    const checkInTime = new Date(todayRecord.check_in)
    const now = isCheckedOut && todayRecord.check_out ? new Date(todayRecord.check_out) : new Date()
    const diffMs = now.getTime() - checkInTime.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="relative">
      <GlassCard variant="strong" className="relative overflow-hidden rounded-3xl border border-border shadow-soft">

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />

        <div className="relative space-y-8 py-4">
          {/* Live clock section */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1B2A] border border-border shadow-soft mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34D399]" />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">Live</span>
            </div>

            <p className="text-6xl sm:text-7xl font-semibold tracking-tight tabular-nums text-foreground">
              {time ? format(time, "HH:mm") : "--:--"}
              <span className="text-3xl sm:text-4xl text-muted-foreground/50">
                :{time ? format(time, "ss") : "--"}
              </span>
            </p>
            <p className="text-muted-foreground mt-2 text-sm tracking-wide">
              {time ? format(time, "EEEE, MMMM d, yyyy") : "\u00A0"}
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[#00BCD4]/10 text-xs text-[#00E5FF] font-medium border border-[#00BCD4]/20">
              <TbBuilding className="h-3 w-3" />
              Office Hours: {OFFICE_TIMINGS.label}
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex justify-center">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0D1B2A] border border-border shadow-soft">
                <TbLoader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading status...</span>
              </div>
            ) : isCheckedOut ? (
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 rounded-full bg-[#7C4DFF]/10 border border-[#7C4DFF]/20">
                <div className="w-2 h-2 rounded-full bg-[#7C4DFF]" />
                <span className="text-xs sm:text-sm font-medium text-[#CBD5E1]">
                  Day Complete — {todayRecord?.work_hours?.toFixed(1)}h worked
                </span>
              </div>
            ) : isCheckedIn ? (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 rounded-full bg-[#00BCD4]/10 border border-[#00BCD4]/20">
                <TbWifi className="h-3.5 w-3.5 text-[#00E5FF]" />
                <span className="text-xs sm:text-sm font-medium text-[#CBD5E1]">
                  Working since {format(new Date(todayRecord!.check_in), "hh:mm a")}
                </span>
                {getWorkingDuration() && (
                  <>
                    <span className="hidden sm:inline text-[#1A2B45]">|</span>
                    <TbClock className="h-3.5 w-3.5 text-[#8094B0]" />
                    <span className="text-xs sm:text-sm text-[#8094B0] tabular-nums">{getWorkingDuration()}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5 rounded-full bg-[#0A1628] border border-[#1A2B45]">
                <div className="w-2 h-2 rounded-full bg-[#4A6080]" />
                <span className="text-xs sm:text-sm text-[#8094B0]">Not checked in yet</span>
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            {!isCheckedOut && (
              <div className="relative group">
                <Button
                  size="lg"
                  onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                  disabled={isLoading || loading}
                  className={`relative w-full max-w-[16rem] sm:w-56 h-14 text-base font-semibold rounded-full shadow-soft transition-all duration-300 ${
                    isCheckedIn
                      ? "bg-[#1A2B45] hover:bg-[#1A2B45] text-white"
                      : "bg-[#00BCD4] hover:bg-[#2563EB] text-white"
                  }`}
                >
                  {isLoading ? (
                    <TbLoader2 className="mr-2.5 h-5 w-5 animate-spin" />
                  ) : isCheckedIn ? (
                    <TbLogout className="mr-2.5 h-5 w-5" />
                  ) : (
                    <TbLogin className="mr-2.5 h-5 w-5" />
                  )}
                  {isCheckedIn ? "Check Out" : "Check In"}
                </Button>
              </div>
            )}
          </div>

          {/* Location info */}
          {todayRecord?.check_in_address && (
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0D1B2A] border border-border shadow-soft max-w-md">
                <TbMapPin className="h-3.5 w-3.5 shrink-0 text-foreground" />
                <span className="text-xs text-muted-foreground truncate">{todayRecord.check_in_address}</span>
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
