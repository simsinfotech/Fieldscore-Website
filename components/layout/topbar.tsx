"use client"

import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationBell } from "./notification-bell"
import { MobileSidebar } from "./mobile-sidebar"
import { TbArrowLeft, TbLogout, TbSettings } from "react-icons/tb"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function Topbar() {
  const { employee, isAdmin } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const isHome = pathname === "/my-dashboard" || pathname === "/overview"

  const greeting = useMemo(() => getGreeting(), [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const initials = employee?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <header className="sticky top-0 z-30 bg-[#060B18]/80 backdrop-blur-xl border-b border-[#1A2B45] relative">
      <div className="h-16 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <MobileSidebar />
          {!isHome && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 rounded-full text-[#8094B0] hover:text-white hover:bg-[#1A2B45]"
              onClick={() => router.push(isAdmin ? "/overview" : "/my-dashboard")}
            >
              <TbArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="hidden sm:block">
            <h2 className="text-sm text-[#8094B0]">
              {greeting},{" "}
              <span className="text-[#F1F5F9] font-medium">{employee?.full_name ?? "User"}</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-[#1A2B45]">
                <div className="rounded-full p-[2px] bg-gradient-to-r from-[#00BCD4] to-[#00E5FF]">
                  <Avatar className="h-8 w-8 border-2 border-[#060B18]">
                    {employee?.avatar_url && (
                      <AvatarImage src={employee.avatar_url} alt={employee.full_name} />
                    )}
                    <AvatarFallback className="bg-[#0D1B2A] text-[#00E5FF] text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#0D1B2A] border-[#1A2B45]">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-[#F1F5F9]">{employee?.full_name}</p>
                <p className="text-[11px] text-[#8094B0]">{employee?.designation}</p>
              </div>
              <DropdownMenuSeparator className="bg-[#1A2B45]" />
              <DropdownMenuItem onClick={() => router.push("/settings")} className="text-[#CBD5E1] hover:text-white focus:bg-[#1A2B45] focus:text-white">
                <TbSettings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1A2B45]" />
              <DropdownMenuItem onClick={handleSignOut} className="text-[#CBD5E1] hover:text-white focus:bg-[#1A2B45] focus:text-white">
                <TbLogout className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
