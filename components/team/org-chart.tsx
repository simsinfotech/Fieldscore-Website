"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { RoleBadge } from "./role-selector"
import { TbChevronDown, TbChevronRight } from "react-icons/tb"
import type { EmployeeRole } from "@/types"

interface OrgNode {
  id: string
  full_name: string
  designation: string
  department?: string
  avatar_url?: string
  role: EmployeeRole
  reports_to?: string | null
  children: OrgNode[]
}

interface OrgChartProps {
  employees: {
    id: string
    full_name: string
    designation: string
    department?: string
    avatar_url?: string
    role: EmployeeRole
    reports_to?: string | null
  }[]
}

function buildTree(employees: OrgChartProps["employees"]): OrgNode[] {
  const map = new Map<string, OrgNode>()
  const roots: OrgNode[] = []

  // Create nodes
  for (const emp of employees) {
    map.set(emp.id, { ...emp, children: [] })
  }

  // Build tree
  for (const node of map.values()) {
    if (node.reports_to && map.has(node.reports_to)) {
      map.get(node.reports_to)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by name
  function sortChildren(nodes: OrgNode[]) {
    nodes.sort((a, b) => a.full_name.localeCompare(b.full_name))
    nodes.forEach((n) => sortChildren(n.children))
  }
  sortChildren(roots)

  return roots
}

function TreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0

  const initials = node.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={cn(depth > 0 && "ml-6 border-l border-border pl-4")}>
      <div className="flex items-center gap-3 py-2 group">
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground"
          >
            {expanded ? (
              <TbChevronDown className="h-4 w-4" />
            ) : (
              <TbChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Avatar */}
        {node.avatar_url ? (
          <img
            src={node.avatar_url}
            alt={node.full_name}
            className="h-8 w-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {node.full_name}
            </span>
            <RoleBadge role={node.role} />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {node.designation}
            {node.department && ` - ${node.department}`}
          </p>
        </div>
      </div>

      {expanded &&
        node.children.map((child) => (
          <TreeNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  )
}

function MemberRow({ emp }: { emp: OrgChartProps["employees"][number] }) {
  const initials = emp.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  return (
    <div className="flex items-center gap-3 py-2">
      {emp.avatar_url ? (
        <img src={emp.avatar_url} alt={emp.full_name} className="h-8 w-8 rounded-full object-cover shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-semibold shrink-0">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{emp.full_name}</span>
          <RoleBadge role={emp.role} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{emp.designation}</p>
      </div>
    </div>
  )
}

function DepartmentView({ employees }: OrgChartProps) {
  const groups = new Map<string, OrgChartProps["employees"]>()
  for (const emp of employees) {
    const key = emp.department?.trim() || "Unassigned"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(emp)
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (a[0] === "Unassigned") return 1
    if (b[0] === "Unassigned") return -1
    return a[0].localeCompare(b[0])
  })

  return (
    <div className="space-y-5">
      {ordered.map(([dept, members]) => (
        <div key={dept}>
          <div className="flex items-center gap-2 mb-1 pb-1 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground">{dept}</span>
            <span className="text-[10px] text-muted-foreground/60">{members.length}</span>
          </div>
          {members
            .slice()
            .sort((a, b) => a.full_name.localeCompare(b.full_name))
            .map((m) => (
              <MemberRow key={m.id} emp={m} />
            ))}
        </div>
      ))}
    </div>
  )
}

export function OrgChart({ employees }: OrgChartProps) {
  const [view, setView] = useState<"hierarchy" | "department">("hierarchy")
  const tree = buildTree(employees)

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No employees found. Set up reporting relationships to see the org chart.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary p-1">
        {(["hierarchy", "department"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
              view === v ? "bg-[#00BCD4] text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "hierarchy" ? "Hierarchy" : "By Department"}
          </button>
        ))}
      </div>

      {view === "hierarchy" ? (
        tree.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No reporting relationships set. Assign &quot;Reports To&quot; to build the tree.
          </div>
        ) : (
          <div className="space-y-1">
            {tree.map((root) => (
              <TreeNode key={root.id} node={root} />
            ))}
          </div>
        )
      ) : (
        <DepartmentView employees={employees} />
      )}
    </div>
  )
}
