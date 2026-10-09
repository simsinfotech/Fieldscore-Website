"use client";

import { useState } from "react";
import {
  Search,
  Plus,
  Star,
  Phone,
  Mail,
  MoreVertical,
  ChevronDown,
  Eye,
  Edit,
  Trash2,
  X,
  User,
  Building2,
  IndianRupee,
  MessageSquare,
} from "lucide-react";
import { leads, statusColors, statusLabels, formatCurrency, type Lead, type LeadStatus } from "@/lib/mock-data";

const TABS = ["All Leads", "My Leads", "Unassigned", "Starred"];
const STATUS_FILTERS: { label: string; value: LeadStatus | "all" }[] = [
  { label: "All Status", value: "all" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Qualified", value: "qualified" },
  { label: "Site Visit", value: "site_visit" },
  { label: "Negotiation", value: "negotiation" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
];

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState("All Leads");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const filteredLeads = leads.filter((lead) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!lead.full_name.toLowerCase().includes(q) && !lead.phone.includes(q) && !lead.project.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all" && lead.status !== statusFilter) return false;
    if (activeTab === "Unassigned" && lead.assigned_to !== "Unassigned") return false;
    if (activeTab === "Starred" && !lead.starred) return false;
    if (activeTab === "My Leads" && lead.assigned_to !== "Arjun Patel") return false;
    return true;
  });

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Leads</h1>
          <p className="text-brand-dim text-sm mt-1">{leads.length} total leads in your CRM</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 !py-2.5 rounded-xl text-sm">
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-brand-surface rounded-xl p-1 border border-brand-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab ? "bg-brand-card text-brand-text shadow-soft" : "text-brand-dim hover:text-brand-text"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or project..."
            className="input-field !pl-10"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
            className="input-field appearance-none !pr-10 cursor-pointer min-w-[160px]"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim pointer-events-none" />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Lead</th>
                <th>Project</th>
                <th>Status</th>
                <th>Category</th>
                <th>Budget</th>
                <th>Assigned To</th>
                <th>Last Activity</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="cursor-pointer" onClick={() => setSelectedLead(lead)}>
                  <td>
                    <button onClick={(e) => e.stopPropagation()} className="text-brand-dim hover:text-amber-500 transition-colors">
                      <Star className={`w-4 h-4 ${lead.starred ? "text-amber-500 fill-amber-400" : ""}`} />
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center text-xs font-bold text-cyan-600 shrink-0">
                        {lead.full_name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-brand-text">{lead.full_name}</p>
                        <p className="text-xs text-brand-dim">{lead.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className="text-sm">{lead.project}</span></td>
                  <td><span className={`badge text-[10px] ${statusColors[lead.status]}`}>{statusLabels[lead.status]}</span></td>
                  <td>
                    <span className={`badge text-[10px] ${
                      lead.category === "hot" ? "bg-red-50 text-red-600" :
                      lead.category === "warm" ? "bg-amber-50 text-amber-500" :
                      "bg-blue-50 text-blue-600"
                    }`}>
                      {lead.category}
                    </span>
                  </td>
                  <td><span className="text-sm text-brand-dim">{formatCurrency(lead.budget_min)} - {formatCurrency(lead.budget_max)}</span></td>
                  <td><span className={`text-sm ${lead.assigned_to === "Unassigned" ? "text-amber-500" : "text-brand-dim"}`}>{lead.assigned_to}</span></td>
                  <td><span className="text-xs text-brand-dim">{lead.last_activity}</span></td>
                  <td>
                    <button onClick={(e) => e.stopPropagation()} className="p-1 text-brand-dim hover:text-brand-text rounded transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-brand-dim">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No leads found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Lead Detail Slide-over */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedLead(null)} />
          <div className="relative w-full max-w-lg bg-brand-card border-l border-brand-border overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-brand-card border-b border-brand-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-brand-text">Lead Details</h2>
              <button onClick={() => setSelectedLead(null)} className="p-1 text-brand-dim hover:text-brand-text rounded-xl hover:bg-brand-card-hover transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Profile */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg font-bold text-white">
                  {selectedLead.full_name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-text">{selectedLead.full_name}</h3>
                  <p className="text-sm text-brand-dim">{selectedLead.source} &middot; {selectedLead.created_at}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <button className="flex-1 btn-secondary flex items-center justify-center gap-2 !py-2.5 rounded-xl text-sm">
                  <Phone className="w-4 h-4" /> Call
                </button>
                <button className="flex-1 btn-secondary flex items-center justify-center gap-2 !py-2.5 rounded-xl text-sm">
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button className="flex-1 btn-secondary flex items-center justify-center gap-2 !py-2.5 rounded-xl text-sm">
                  <MessageSquare className="w-4 h-4" /> WhatsApp
                </button>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-brand-border/50">
                  <span className="text-sm text-brand-dim flex items-center gap-2"><User className="w-4 h-4" /> Status</span>
                  <span className={`badge ${statusColors[selectedLead.status]}`}>{statusLabels[selectedLead.status]}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-brand-border/50">
                  <span className="text-sm text-brand-dim flex items-center gap-2"><Building2 className="w-4 h-4" /> Project</span>
                  <span className="text-sm font-medium text-brand-text">{selectedLead.project}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-brand-border/50">
                  <span className="text-sm text-brand-dim flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Budget</span>
                  <span className="text-sm font-medium text-brand-text">{formatCurrency(selectedLead.budget_min)} - {formatCurrency(selectedLead.budget_max)}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-brand-border/50">
                  <span className="text-sm text-brand-dim">Assigned To</span>
                  <span className="text-sm font-medium text-brand-text">{selectedLead.assigned_to}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-brand-border/50">
                  <span className="text-sm text-brand-dim">Email</span>
                  <span className="text-sm text-cyan-600">{selectedLead.email}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-brand-border/50">
                  <span className="text-sm text-brand-dim">Phone</span>
                  <span className="text-sm text-brand-text">{selectedLead.phone}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-sm font-bold text-brand-text mb-2">Notes</h4>
                <p className="text-sm text-brand-dim bg-brand-surface rounded-xl p-3">{selectedLead.notes}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 btn-primary flex items-center justify-center gap-2 !py-2.5 rounded-xl text-sm">
                  <Edit className="w-4 h-4" /> Edit Lead
                </button>
                <button className="btn-secondary flex items-center justify-center gap-2 !py-2.5 rounded-xl text-sm text-red-600 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-brand-card border border-brand-border rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-elevated">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-brand-text">Add New Lead</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-brand-dim hover:text-brand-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowAddModal(false); }}>
              <div>
                <label className="block text-sm font-medium text-brand-dim mb-1.5">Full Name</label>
                <input type="text" placeholder="Enter full name" className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Phone</label>
                  <input type="tel" placeholder="+91 XXXXX XXXXX" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Email</label>
                  <input type="email" placeholder="email@example.com" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dim mb-1.5">Project</label>
                <select className="input-field">
                  <option>Select project</option>
                  <option>Prestige Lakeside</option>
                  <option>Brigade Gateway</option>
                  <option>Sobha Dream Acres</option>
                  <option>Phoenix One</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dim mb-1.5">Source</label>
                <select className="input-field">
                  <option>Select source</option>
                  <option>Website</option>
                  <option>Referral</option>
                  <option>MagicBricks</option>
                  <option>99acres</option>
                  <option>Facebook Ads</option>
                  <option>Google Ads</option>
                  <option>Walk-in</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Min Budget</label>
                  <input type="number" placeholder="e.g. 5000000" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Max Budget</label>
                  <input type="number" placeholder="e.g. 10000000" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dim mb-1.5">Notes</label>
                <textarea placeholder="Add any notes..." className="input-field min-h-[80px] resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 btn-secondary !py-2.5 rounded-xl text-sm">Cancel</button>
                <button type="submit" className="flex-1 btn-primary !py-2.5 rounded-xl text-sm">Add Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
