"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  TbMenu2,
  TbLayoutDashboard,
  TbUserCircle,
  TbUsers,
  TbClock,
  TbCalendarOff,
  TbFileText,
  TbTarget,
  TbMessage,
  TbSpeakerphone,
  TbSettings,
  TbAddressBook,
  TbFileUpload,
  TbCloudDownload,
  TbArrowsShuffle,
  TbClipboardCheck,
  TbBell,
  TbLayoutKanban,
  TbChartBar,
  TbLogout,
} from "react-icons/tb"

type NavCtx = { isAdmin: boolean; role?: string }
const ALL = () => true
const adminOnly = (c: NavCtx) => c.isAdmin
const salesRoles = (c: NavCtx) => c.isAdmin || c.role === "manager" || c.role === "setter"

const ALL_NAV = [
  { label: "Overview", href: "/overview", icon: TbLayoutDashboard, show: adminOnly },
  { label: "My Dashboard", href: "/my-dashboard", icon: TbUserCircle, show: ALL },
  { label: "My Work", href: "/my-work", icon: TbClipboardCheck, show: ALL },
  { label: "Notifications", href: "/notifications", icon: TbBell, show: ALL },
  { label: "Team", href: "/team", icon: TbUsers, show: adminOnly },
  { label: "Attendance", href: "/attendance", icon: TbClock, show: ALL },
  { label: "Leave", href: "/leave", icon: TbCalendarOff, show: ALL },
  { label: "Work", href: "/work", icon: TbLayoutKanban, show: ALL },
  { label: "EOD Reports", href: "/eod-reports", icon: TbFileText, show: ALL },
  { label: "Leads", href: "/leads", icon: TbAddressBook, show: salesRoles },
  { label: "Upload Leads", href: "/leads/upload", icon: TbFileUpload, show: adminOnly },
  { label: "Sheet Sources", href: "/leads/sheets", icon: TbCloudDownload, show: adminOnly },
  { label: "Assignments", href: "/leads/assignments", icon: TbArrowsShuffle, show: adminOnly },
  { label: "Campaigns", href: "/marketing", icon: TbChartBar, show: ALL },
  { label: "OKRs", href: "/okrs", icon: TbTarget, show: ALL },
  { label: "Feedback", href: "/feedback", icon: TbMessage, show: ALL },
  { label: "Announcements", href: "/announcements", icon: TbSpeakerphone, show: ALL },
  { label: "Settings", href: "/settings", icon: TbSettings, show: ALL },
]

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { isAdmin, employee } = useUser()
  const nav = ALL_NAV.filter((i) => i.show({ isAdmin, role: employee?.role }))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 rounded-full text-[#8094B0] hover:text-white hover:bg-[#1A2B45]">
          <TbMenu2 className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        hideClose
        className="w-[280px] p-0 border-r border-[#1A2B45] bg-[#0A1628] flex flex-col"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* Header - fixed at top */}
        <div className="flex items-center h-16 px-4 border-b border-[#1A2B45] shrink-0">
          <div className="w-9 h-9 flex items-center justify-center mr-3 overflow-hidden rounded-xl shrink-0">
            <Image src="/IMG_9578.PNG" alt="FieldScore" width={36} height={36} className="w-9 h-9 object-contain" />
          </div>
          <div className="flex flex-col">
            <Image src="/image.png" alt="FieldScore" width={100} height={22} className="h-[18px] w-auto" />
            <span className="text-[10px] tracking-wide leading-tight mt-0.5 text-[#8094B0]">
              {isAdmin ? "Admin panel" : "Employee portal"}
            </span>
          </div>
        </div>

        {/* Scrollable navigation */}
        <nav className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-0.5">
          {nav.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "sidebar-link",
                  isActive && "active"
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer - user info, fixed at bottom */}
        {employee && (
          <div className="shrink-0 border-t border-[#1A2B45] p-3">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#060B18]/50">
              <div className="w-8 h-8 rounded-full bg-[#1A2B45] flex items-center justify-center text-[#00E5FF] text-xs font-semibold shrink-0">
                {employee.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F1F5F9] truncate">{employee.name}</p>
                <p className="text-[10px] text-[#8094B0] truncate capitalize">{employee.role || "Employee"}</p>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
