"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { EmployeeRole } from "@/types"

interface RoleSelectorProps {
  value: EmployeeRole
  onChange: (role: EmployeeRole) => void
  disabled?: boolean
}

const ROLES: { value: EmployeeRole; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Full access" },
  { value: "sales_admin", label: "Sales Admin", description: "Sales + team mgmt" },
  { value: "manager", label: "Manager", description: "Sees subtree" },
  { value: "setter", label: "Setter", description: "Assigned leads" },
  { value: "viewer", label: "Viewer", description: "Read-only" },
]

export function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as EmployeeRole)}
      disabled={disabled}
    >
      <SelectTrigger className="bg-secondary border-border">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground ml-2 text-xs">
              {r.description}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function RoleBadge({ role }: { role: EmployeeRole }) {
  const colors: Record<EmployeeRole, string> = {
    admin:
      "bg-[#0F172A] text-white",
    sales_admin:
      "bg-[#0F172A] text-white",
    manager:
      "bg-[#0F172A] text-white",
    setter:
      "bg-[#00BCD4] text-white",
    viewer: "bg-[#F1F5F9] text-foreground border border-border",
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[role]}`}
    >
      {role}
    </span>
  )
}
