"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Target,
  Layers,
  CheckSquare,
  Clock,
  BarChart3,
  Building2,
  Phone,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Menu,
  X,
} from "lucide-react";
import { notifications } from "@/lib/mock-data";

const SIDEBAR_LINKS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/dashboard/leads", icon: Target },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: Layers },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Attendance", href: "/dashboard/attendance", icon: Clock },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Team", href: "/dashboard/team", icon: Users },
  { label: "Properties", href: "/dashboard/properties", icon: Building2 },
  { label: "Calls", href: "/dashboard/calls", icon: Phone },
];

const BOTTOM_LINKS = [
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center px-4 py-5 border-b border-brand-border">
        <Image src="/IMG_9578.PNG" alt="FieldScore icon" width={44} height={44} className="w-11 h-11 rounded-xl shrink-0" />
        {!collapsed && <Image src="/image.png" alt="FieldScore" width={120} height={28} className="h-5 w-auto" />}
      </div>

      {/* Main Links */}
      <div className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {SIDEBAR_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className={`sidebar-link ${isActive(link.href) ? "active" : "text-brand-dim"} ${collapsed ? "justify-center !px-2" : ""}`}
            title={collapsed ? link.label : undefined}
          >
            <link.icon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>{link.label}</span>}
          </Link>
        ))}
      </div>

      {/* Bottom */}
      <div className="py-3 px-3 space-y-0.5 border-t border-brand-border">
        {BOTTOM_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className={`sidebar-link ${isActive(link.href) ? "active" : "text-brand-dim"} ${collapsed ? "justify-center !px-2" : ""} relative`}
          >
            <link.icon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>{link.label}</span>}
            {link.label === "Notifications" && unreadCount > 0 && (
              <span className={`absolute ${collapsed ? "top-0 right-0" : "top-1/2 -translate-y-1/2 right-3"} w-5 h-5 flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-bold rounded-full`}>
                {unreadCount}
              </span>
            )}
          </Link>
        ))}

        {/* User */}
        <div className={`flex items-center gap-3 px-3 py-3 mt-2 rounded-xl bg-brand-bg ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            AP
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-text truncate">Arjun Patel</p>
              <p className="text-xs text-brand-dim truncate">Sales Manager</p>
            </div>
          )}
          {!collapsed && (
            <Link href="/login" className="text-brand-muted hover:text-red-400 transition-colors" title="Sign Out">
              <LogOut className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-brand-surface border-r border-brand-border transition-all duration-300 relative ${collapsed ? "w-[68px]" : "w-[250px]"}`}>
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-brand-card border border-brand-border rounded-full flex items-center justify-center text-brand-muted hover:text-brand-text hover:shadow-soft transition-all z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-[270px] bg-brand-surface border-r border-brand-border shadow-elevated">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-brand-border flex items-center justify-between px-4 lg:px-6 bg-brand-card shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-brand-dim hover:text-brand-text">
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
              <input
                type="text"
                placeholder="Search leads, tasks, properties..."
                className="input-field !pl-10 !w-72"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/notifications" className="relative p-2.5 text-brand-dim hover:text-brand-text hover:bg-brand-card-hover rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[9px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </Link>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white lg:hidden">
              AP
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
