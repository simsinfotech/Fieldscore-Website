"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUser } from "@/hooks/use-user"
import {
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
  TbChevronLeft,
  TbAddressBook,
  TbFileUpload,
  TbCloudDownload,
  TbArrowsShuffle,
  TbClipboardCheck,
  TbBell,
  TbLayoutKanban,
  TbChartBar,
  TbPhone,
  TbPhoneCall,
} from "react-icons/tb"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  items: NavItem[]
}

type NavCtx = { isAdmin: boolean; role?: string }
type NavDef = NavItem & { show: (c: NavCtx) => boolean }

const ALL = () => true
const adminOnly = (c: NavCtx) => c.isAdmin
const salesAdminOrAdmin = (c: NavCtx) => c.isAdmin || c.role === "sales_admin"
const salesRoles = (c: NavCtx) => c.isAdmin || c.role === "sales_admin" || c.role === "manager" || c.role === "setter"

const ALL_NAV: NavDef[] = [
  { label: "Overview", href: "/overview", icon: TbLayoutDashboard, show: adminOnly },
  { label: "My Dashboard", href: "/my-dashboard", icon: TbUserCircle, show: ALL },
  { label: "My Work", href: "/my-work", icon: TbClipboardCheck, show: ALL },
  { label: "Notifications", href: "/notifications", icon: TbBell, show: ALL },
  { label: "Team", href: "/team", icon: TbUsers, show: salesAdminOrAdmin },
  { label: "Attendance", href: "/attendance", icon: TbClock, show: ALL },
  { label: "Calls", href: "/calls", icon: TbPhone, show: salesAdminOrAdmin },
  { label: "Dialer", href: "/calls/dialer", icon: TbPhoneCall, show: salesRoles },
  { label: "Leave", href: "/leave", icon: TbCalendarOff, show: ALL },
  { label: "Work", href: "/work", icon: TbLayoutKanban, show: ALL },
  { label: "EOD Reports", href: "/eod-reports", icon: TbFileText, show: ALL },
  { label: "Leads", href: "/leads", icon: TbAddressBook, show: salesRoles },
  { label: "Upload Leads", href: "/leads/upload", icon: TbFileUpload, show: salesAdminOrAdmin },
  { label: "Sheet Sources", href: "/leads/sheets", icon: TbCloudDownload, show: salesAdminOrAdmin },
  { label: "Assignments", href: "/leads/assignments", icon: TbArrowsShuffle, show: salesAdminOrAdmin },
  { label: "Campaigns", href: "/marketing", icon: TbChartBar, show: ALL },
  { label: "OKRs", href: "/okrs", icon: TbTarget, show: ALL },
  { label: "Feedback", href: "/feedback", icon: TbMessage, show: ALL },
  { label: "Announcements", href: "/announcements", icon: TbSpeakerphone, show: ALL },
  { label: "Settings", href: "/settings", icon: TbSettings, show: ALL },
]

function buildNav(ctx: NavCtx): NavItem[] {
  return ALL_NAV.filter((i) => i.show(ctx)).map(({ label, href, icon }) => ({ label, href, icon }))
}

function groupNavItems(nav: NavItem[]): NavSection[] {
  const map = new Map<string, NavItem[]>()
  const sectionOrder: string[] = []

  const getSectionName = (label: string): string => {
    if (["Overview", "My Dashboard", "My Work", "Notifications", "Team"].includes(label)) return "Main"
    if (["Attendance", "Calls", "Dialer", "Leave", "Work", "EOD Reports"].includes(label)) return "Work"
    if (["Leads", "Upload Leads", "Sheet Sources", "Assignments", "Campaigns"].includes(label)) return "Sales"
    if (["OKRs", "Feedback"].includes(label)) return "Performance"
    if (label === "Announcements") return "Communication"
    if (label === "Settings") return "System"
    return "Other"
  }

  for (const item of nav) {
    const section = getSectionName(item.label)
    if (!map.has(section)) {
      map.set(section, [])
      sectionOrder.push(section)
    }
    map.get(section)!.push(item)
  }

  return sectionOrder.map((title) => ({ title, items: map.get(title)! }))
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { isAdmin, employee } = useUser()
  const nav = buildNav({ isAdmin, role: employee?.role })
  const sections = groupNavItems(nav)

  const initials = employee?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-[#0A1628] border-r border-[#1A2B45] transition-all duration-300 flex flex-col",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-[72px] px-4 border-b border-[#1A2B45]">
        {!collapsed && (
          <Link href={isAdmin ? "/overview" : "/my-dashboard"} className="flex items-center gap-2.5 group min-w-0">
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden shrink-0 rounded-xl">
              <Image src="/IMG_9578.PNG" alt="FieldScore" width={40} height={40} className="w-10 h-10 object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <Image src="/image.png" alt="FieldScore" width={110} height={24} className="h-5 w-auto" />
              <span className="text-[11px] tracking-wide leading-tight mt-0.5 text-[#8094B0]">
                {isAdmin ? "Admin panel" : "Employee portal"}
              </span>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href={isAdmin ? "/overview" : "/my-dashboard"} className="mx-auto" title="FieldScore">
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-xl">
              <Image src="/IMG_9578.PNG" alt="FieldScore" width={40} height={40} className="w-10 h-10 object-contain" />
            </div>
          </Link>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 shrink-0 rounded-full text-[#8094B0] hover:text-white hover:bg-[#1A2B45]"
          >
            <TbChevronLeft className="h-4 w-4 transition-transform" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center py-2 border-b border-[#1A2B45]">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 shrink-0 rounded-full text-[#8094B0] hover:text-white hover:bg-[#1A2B45]"
            title="Expand sidebar"
          >
            <TbChevronLeft className="h-4 w-4 transition-transform rotate-180" />
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 py-3">
        <nav className="px-3">
          {sections.map((section, sectionIdx) => (
            <div key={section.title} className={cn(sectionIdx > 0 && "mt-3")}>
              {!collapsed && (
                <div className="flex items-center gap-2 px-3 pt-2 pb-2">
                  <span className="text-[11px] font-medium tracking-wide text-[#4A6080]">
                    {section.title}
                  </span>
                  <div className="flex-1 h-px bg-[#1A2B45]" />
                </div>
              )}
              {collapsed && sectionIdx > 0 && (
                <div className="mx-3 my-2 h-px bg-[#1A2B45]" />
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "sidebar-link",
                        isActive && "active"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0 transition-colors" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User info card at bottom */}
      {!collapsed && employee && (
        <div className="p-3 border-t border-[#1A2B45]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#060B18]">
            {employee.avatar_url ? (
              <img
                src={employee.avatar_url}
                alt={employee.full_name}
                className="w-9 h-9 object-cover shrink-0 rounded-full ring-1 ring-[#1A2B45]"
              />
            ) : (
              <div className="w-9 h-9 flex items-center justify-center text-xs font-semibold text-[#060B18] shrink-0 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#00E5FF]">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#F1F5F9] truncate">
                {employee.full_name}
              </p>
              <p className="text-[11px] text-[#8094B0] truncate">
                {employee.designation ?? "Employee"}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
