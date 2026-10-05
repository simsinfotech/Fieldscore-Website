"use client";

import { useState } from "react";
import {
  Search,
  MapPin,
  Building2,
  IndianRupee,
  ExternalLink,
  Filter,
  LayoutGrid,
  List,
  ChevronDown,
  Home,
  Shield,
  Eye,
} from "lucide-react";
import { properties, formatCurrency } from "@/lib/mock-data";

const STATUS_STYLES = {
  available: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Available" },
  limited: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Limited Units" },
  sold_out: { bg: "bg-red-500/15", text: "text-red-400", label: "Sold Out" },
};

export default function PropertiesPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProperties = properties.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.developer.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Properties</h1>
          <p className="text-brand-dim text-sm mt-1">{properties.length} properties in your inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-brand-surface border border-brand-border rounded-xl p-0.5">
            <button onClick={() => setView("grid")} className={`p-2 rounded-lg transition-colors ${view === "grid" ? "bg-brand-card text-brand-text shadow-soft" : "text-brand-dim"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView("list")} className={`p-2 rounded-lg transition-colors ${view === "list" ? "bg-brand-card text-brand-text shadow-soft" : "text-brand-dim"}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search properties..."
          className="input-field !pl-10"
        />
      </div>

      {view === "grid" ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProperties.map((property) => {
            const style = STATUS_STYLES[property.status];
            const availability = (property.units_available / property.total_units) * 100;
            return (
              <div key={property.id} className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden hover:border-cyan-500/20 transition-all group shadow-soft hover:shadow-card">
                {/* Image placeholder */}
                <div className="h-48 bg-gradient-to-br from-brand-surface to-brand-card relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Building2 className="w-16 h-16 text-brand-border" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className={`badge ${style.bg} ${style.text}`}>{style.label}</span>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="w-8 h-8 bg-brand-surface/90 rounded-xl flex items-center justify-center text-brand-text hover:bg-brand-surface shadow-soft">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-lg font-bold text-brand-text mb-1">{property.name}</h3>
                  <p className="text-sm text-brand-dim mb-1">{property.developer}</p>
                  <p className="text-xs text-brand-dim flex items-center gap-1 mb-4">
                    <MapPin className="w-3 h-3" /> {property.location}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-brand-surface rounded-xl p-2.5">
                      <p className="text-xs text-brand-dim mb-0.5">Price Range</p>
                      <p className="text-sm font-semibold text-cyan-400">
                        {formatCurrency(property.price_min)} - {formatCurrency(property.price_max)}
                      </p>
                    </div>
                    <div className="bg-brand-surface rounded-xl p-2.5">
                      <p className="text-xs text-brand-dim mb-0.5">Configuration</p>
                      <p className="text-sm font-semibold text-brand-text">{property.config}</p>
                    </div>
                  </div>

                  {/* RERA */}
                  <div className="flex items-center gap-1.5 text-xs text-brand-dim mb-4">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    <span className="truncate">RERA: {property.rera_id.slice(0, 25)}...</span>
                  </div>

                  {/* Availability bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-brand-dim">{property.units_available} of {property.total_units} units available</span>
                      <span className="text-xs font-medium text-cyan-400">{availability.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-brand-surface rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" style={{ width: `${availability}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-soft">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Developer</th>
                <th>Location</th>
                <th>Config</th>
                <th>Price Range</th>
                <th>Units</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.map((property) => {
                const style = STATUS_STYLES[property.status];
                return (
                  <tr key={property.id} className="cursor-pointer">
                    <td><span className="font-semibold text-sm text-brand-text">{property.name}</span></td>
                    <td><span className="text-sm text-brand-dim">{property.developer}</span></td>
                    <td><span className="text-sm text-brand-dim">{property.location}</span></td>
                    <td><span className="text-sm">{property.config}</span></td>
                    <td><span className="text-sm text-cyan-400">{formatCurrency(property.price_min)} - {formatCurrency(property.price_max)}</span></td>
                    <td><span className="text-sm">{property.units_available}/{property.total_units}</span></td>
                    <td><span className={`badge text-[10px] ${style.bg} ${style.text}`}>{style.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
