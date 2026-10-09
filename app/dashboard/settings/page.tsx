"use client";

import { useState } from "react";
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Link2,
  HelpCircle,
  LogOut,
  ChevronRight,
  Camera,
  Mail,
  Phone,
  Building2,
  MapPin,
  Moon,
  Sun,
  Smartphone,
  Key,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "help", label: "Help & Support", icon: HelpCircle },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const [darkMode, setDarkMode] = useState(true);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Settings</h1>
        <p className="text-brand-dim text-sm mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-2 shadow-soft">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeSection === section.id ? "bg-cyan-50 text-cyan-600" : "text-brand-dim hover:text-brand-text hover:bg-brand-card-hover"
                }`}
              >
                <section.icon className="w-4 h-4" />
                {section.label}
              </button>
            ))}
            <div className="border-t border-brand-border/50 mt-2 pt-2">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeSection === "profile" && (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-bold text-brand-text mb-6">Profile Information</h2>

              {/* Avatar */}
              <div className="flex items-center gap-5 mb-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                    AP
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-card border border-brand-border flex items-center justify-center text-brand-dim hover:text-brand-text transition-colors shadow-soft">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <p className="font-bold text-brand-text">Arjun Patel</p>
                  <p className="text-sm text-brand-dim">Sales Manager</p>
                </div>
              </div>

              <form className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-brand-dim mb-1.5">First Name</label>
                    <input type="text" defaultValue="Arjun" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-dim mb-1.5">Last Name</label>
                    <input type="text" defaultValue="Patel" className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim" />
                    <input type="email" defaultValue="arjun@fieldscore.io" className="input-field !pl-11" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim" />
                    <input type="tel" defaultValue="+91 98765 43210" className="input-field !pl-11" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Organization</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim" />
                    <input type="text" defaultValue="Prestige Realtors Pvt. Ltd." className="input-field !pl-11" disabled />
                  </div>
                </div>
                <div className="pt-2">
                  <button type="button" className="btn-primary flex items-center gap-2 !py-2.5 rounded-xl text-sm">
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeSection === "notifications" && (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-bold text-brand-text mb-6">Notification Preferences</h2>
              <div className="space-y-5">
                {[
                  { label: "New Lead Assignments", desc: "When a new lead is assigned to you", enabled: true },
                  { label: "Site Visit Reminders", desc: "Reminders for upcoming site visits", enabled: true },
                  { label: "Missed Calls", desc: "Alerts when you miss a call from a lead", enabled: true },
                  { label: "Deal Updates", desc: "When deals move through pipeline stages", enabled: false },
                  { label: "Task Deadlines", desc: "Reminders for upcoming and overdue tasks", enabled: true },
                  { label: "Weekly Reports", desc: "Weekly performance summary emails", enabled: false },
                  { label: "Team Activity", desc: "Updates on team member activities", enabled: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-brand-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-brand-text">{item.label}</p>
                      <p className="text-xs text-brand-dim mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        item.enabled ? "bg-gradient-to-r from-cyan-500 to-blue-600" : "bg-brand-surface border border-brand-border"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          item.enabled ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "security" && (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-bold text-brand-text mb-6">Security Settings</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-brand-text mb-4">Change Password</h3>
                  <div className="space-y-3 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-brand-dim mb-1.5">Current Password</label>
                      <input type="password" placeholder="Enter current password" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-dim mb-1.5">New Password</label>
                      <input type="password" placeholder="Enter new password" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-dim mb-1.5">Confirm New Password</label>
                      <input type="password" placeholder="Confirm new password" className="input-field" />
                    </div>
                    <button className="btn-primary flex items-center gap-2 !py-2.5 rounded-xl text-sm mt-2">
                      <Key className="w-4 h-4" /> Update Password
                    </button>
                  </div>
                </div>
                <div className="border-t border-brand-border/50 pt-6">
                  <h3 className="text-sm font-bold text-brand-text mb-3">Two-Factor Authentication</h3>
                  <p className="text-sm text-brand-dim mb-4">Add an extra layer of security to your account</p>
                  <button className="btn-secondary !py-2.5 rounded-xl text-sm">Enable 2FA</button>
                </div>
                <div className="border-t border-brand-border/50 pt-6">
                  <h3 className="text-sm font-bold text-brand-text mb-3">Active Sessions</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-brand-surface rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-brand-dim" />
                        <div>
                          <p className="text-sm font-semibold text-brand-text">iPhone 15 Pro</p>
                          <p className="text-xs text-brand-dim">Bangalore, India &middot; Current session</p>
                        </div>
                      </div>
                      <span className="text-xs text-emerald-600">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "appearance" && (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-bold text-brand-text mb-6">Appearance</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-brand-text mb-3">Theme</h3>
                  <div className="grid grid-cols-2 gap-3 max-w-sm">
                    <button
                      onClick={() => setDarkMode(true)}
                      className={`p-4 rounded-2xl border-2 transition-colors ${
                        darkMode ? "border-cyan-500 bg-cyan-50" : "border-brand-border"
                      }`}
                    >
                      <Moon className={`w-6 h-6 mx-auto mb-2 ${darkMode ? "text-cyan-600" : "text-brand-dim"}`} />
                      <p className="text-sm font-medium text-center text-brand-text">Dark</p>
                    </button>
                    <button
                      onClick={() => setDarkMode(false)}
                      className={`p-4 rounded-2xl border-2 transition-colors ${
                        !darkMode ? "border-cyan-500 bg-cyan-50" : "border-brand-border"
                      }`}
                    >
                      <Sun className={`w-6 h-6 mx-auto mb-2 ${!darkMode ? "text-cyan-600" : "text-brand-dim"}`} />
                      <p className="text-sm font-medium text-center text-brand-text">Light</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "integrations" && (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-bold text-brand-text mb-6">Integrations</h2>
              <div className="space-y-4">
                {[
                  { name: "Exotel", desc: "VoIP calling and call recording", connected: true, color: "bg-blue-500" },
                  { name: "EstateHive", desc: "Property listing synchronization", connected: true, color: "bg-emerald-500" },
                  { name: "WhatsApp Business", desc: "Direct messaging with leads", connected: false, color: "bg-emerald-600" },
                  { name: "Google Calendar", desc: "Sync site visits and tasks", connected: false, color: "bg-red-500" },
                  { name: "Mailchimp", desc: "Email marketing campaigns", connected: false, color: "bg-yellow-500" },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-4 bg-brand-surface rounded-2xl border border-brand-border/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${integration.color} flex items-center justify-center text-white text-sm font-bold`}>
                        {integration.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-text">{integration.name}</p>
                        <p className="text-xs text-brand-dim">{integration.desc}</p>
                      </div>
                    </div>
                    <button className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      integration.connected
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-500/20"
                        : "bg-brand-card border border-brand-border text-brand-dim hover:text-brand-text"
                    }`}>
                      {integration.connected ? "Connected" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "help" && (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-soft">
              <h2 className="text-lg font-bold text-brand-text mb-6">Help & Support</h2>
              <div className="space-y-4">
                {[
                  { title: "Documentation", desc: "Browse our comprehensive guides and tutorials", icon: Globe },
                  { title: "Contact Support", desc: "Get in touch with our support team", icon: Mail },
                  { title: "Feature Requests", desc: "Suggest new features and improvements", icon: Palette },
                  { title: "Refer a Friend", desc: "Invite colleagues and earn rewards", icon: User },
                ].map((item) => (
                  <button key={item.title} className="w-full flex items-center justify-between p-4 bg-brand-surface rounded-2xl border border-brand-border/50 hover:border-brand-border transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-card flex items-center justify-center shadow-sm">
                        <item.icon className="w-5 h-5 text-brand-dim" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-brand-text">{item.title}</p>
                        <p className="text-xs text-brand-dim">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-brand-dim" />
                  </button>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-brand-border/50">
                <p className="text-xs text-brand-muted text-center">FieldScore v1.8.0 &middot; Built with care in Bangalore</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
