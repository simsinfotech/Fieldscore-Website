"use client";

import { useState } from "react";
import {
  Bell,
  Target,
  MapPin,
  Phone,
  TrendingUp,
  CheckSquare,
  Settings,
  Check,
  CheckCheck,
  Trash2,
} from "lucide-react";
import { notifications, type Notification } from "@/lib/mock-data";

const TYPE_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  lead: { icon: Target, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  visit: { icon: MapPin, color: "text-amber-400", bg: "bg-amber-500/10" },
  call: { icon: Phone, color: "text-blue-400", bg: "bg-blue-500/10" },
  deal: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  task: { icon: CheckSquare, color: "text-violet-400", bg: "bg-violet-500/10" },
  system: { icon: Settings, color: "text-slate-400", bg: "bg-brand-surface" },
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(notifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifs.filter((n) => !n.read).length;
  const filtered = filter === "unread" ? notifs.filter((n) => !n.read) : notifs;

  const markAllRead = () => {
    setNotifs(notifs.map((n) => ({ ...n, read: true })));
  };

  const toggleRead = (id: string) => {
    setNotifs(notifs.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Notifications</h1>
          <p className="text-brand-dim text-sm mt-1">{unreadCount} unread notifications</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 !py-2.5 rounded-xl text-sm">
            <CheckCheck className="w-4 h-4" /> Mark All as Read
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            filter === "all" ? "bg-brand-card text-brand-text border border-brand-border shadow-soft" : "text-brand-dim hover:text-brand-text"
          }`}
        >
          All ({notifs.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            filter === "unread" ? "bg-brand-card text-brand-text border border-brand-border shadow-soft" : "text-brand-dim hover:text-brand-text"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-soft">
        {filtered.length > 0 ? (
          <div className="divide-y divide-brand-border/50">
            {filtered.map((notif) => {
              const style = TYPE_STYLES[notif.type];
              const Icon = style.icon;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-4 px-5 py-4 hover:bg-brand-card-hover transition-colors cursor-pointer ${
                    !notif.read ? "bg-cyan-500/5" : ""
                  }`}
                  onClick={() => toggleRead(notif.id)}
                >
                  {!notif.read && <div className="w-2 h-2 rounded-full bg-cyan-500 mt-4 shrink-0" />}
                  {notif.read && <div className="w-2 h-2 shrink-0 mt-4" />}
                  <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${style.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notif.read ? "font-bold text-brand-text" : "font-semibold text-brand-text"}`}>{notif.title}</p>
                    <p className="text-sm text-brand-dim mt-0.5">{notif.message}</p>
                    <p className="text-xs text-brand-muted mt-1">{notif.timestamp}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 mx-auto text-brand-border mb-3" />
            <p className="text-brand-dim font-medium">No unread notifications</p>
            <p className="text-sm text-brand-muted mt-1">You&apos;re all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}
