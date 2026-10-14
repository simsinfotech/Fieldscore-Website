"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { UserProvider } from "@/hooks/use-user"
import { AttendanceProvider } from "@/hooks/use-attendance"
import { ActivityHeartbeatProvider } from "./activity-heartbeat-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const GUARD = "__dashboard_guard__"

    if (!window.history.state?.[GUARD]) {
      window.history.replaceState({ ...window.history.state, [GUARD]: true }, "")
      window.history.pushState({ [GUARD]: true }, "", window.location.href)
    }

    function handlePopState() {
      window.history.pushState({ [GUARD]: true }, "", window.location.href)

      if (window.location.pathname !== "/my-dashboard") {
        window.location.href = "/my-dashboard"
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return (
    <UserProvider>
      <AttendanceProvider>
      <ActivityHeartbeatProvider>
      <div className="min-h-screen bg-[#060B18]">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>

        {/* Main area */}
        <div
          className={cn(
            "transition-all duration-300",
            collapsed ? "lg:ml-[68px]" : "lg:ml-[260px]"
          )}
        >
          <Topbar />
          <main className="relative z-0 px-3 py-4 sm:p-4 lg:p-6">{children}</main>
        </div>
      </div>
      </ActivityHeartbeatProvider>
      </AttendanceProvider>
    </UserProvider>
  )
}
