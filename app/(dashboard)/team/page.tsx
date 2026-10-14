"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  TbUsers,
  TbMail,
  TbPhone,
  TbCalendar,
  TbBriefcase,
  TbSearch,
  TbUserX,
  TbPlus,
  TbLoader2,
  TbUserPlus,
  TbEye,
  TbEyeOff,
  TbPencil,
  TbUserMinus,
  TbUserCheck,
  TbToggleLeft,
  TbKey,
  TbHierarchy2,
  TbLink,
  TbCopy,
  TbRefresh,
  TbCircleCheck,
} from "react-icons/tb"
import { toast } from "sonner"
import { format } from "date-fns"
import { RoleBadge, RoleSelector } from "@/components/team/role-selector"
import { OrgChart } from "@/components/team/org-chart"
import type { Employee, EmployeeRole, ScopeLevel } from "@/types"

export default function TeamPage() {
  const { employee, isAdmin } = useUser()
  const orgId = useOrg()
  const supabase = createClient()
  const [members, setMembers] = useState<Employee[]>([])
  const [search, setSearch] = useState("")
  const [department, setDepartment] = useState("all")
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    if (!employee) return
    fetchMembers()
  }, [employee?.id, orgId, showInactive])

  // Subscribe to realtime changes on fs_employees so the admin panel
  // updates automatically when employees change (e.g. profile photo
  // upload) without requiring a manual refresh.
  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`team-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fs_employees",
          filter: `org_id=eq.${orgId}`,
        },
        (payload: {
          eventType: "INSERT" | "UPDATE" | "DELETE"
          new: Partial<Employee> | null
          old: Partial<Employee> | null
        }) => {
          const newRow = payload.new as Employee | null
          const oldRow = payload.old as Employee | null

          setMembers((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== oldRow?.id)
            }

            if (!newRow) return prev

            // Respect the showInactive filter
            if (!showInactive && newRow.is_active === false) {
              return prev.filter((m) => m.id !== newRow.id)
            }

            const existing = prev.findIndex((m) => m.id === newRow.id)
            if (existing === -1) {
              const next = [...prev, newRow]
              next.sort((a, b) => a.full_name.localeCompare(b.full_name))
              return next
            }

            const next = [...prev]
            next[existing] = { ...next[existing], ...newRow }
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, showInactive, supabase])

  async function fetchMembers() {
    let query = supabase
      .from("fs_employees")
      .select("*")
      .eq("org_id", orgId)
      .order("full_name")

    if (!showInactive) {
      query = query.eq("is_active", true)
    }

    const { data } = await query
    if (data) setMembers(data)
  }

  const departments = useMemo(() => {
    const depts = new Set<string>()
    members.forEach((m) => {
      if (m.department) depts.add(m.department)
    })
    return Array.from(depts).sort()
  }, [members])

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        !search ||
        m.full_name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        m.designation.toLowerCase().includes(search.toLowerCase())
      const matchDept =
        department === "all" || m.department === department
      return matchSearch && matchDept
    })
  }, [members, search, department])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00BCD4] text-white border border-border shrink-0">
            <TbUsers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
            <p className="text-sm text-muted-foreground">
              Employee directory
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`inline-flex items-center gap-2 px-3 h-9 rounded-xl text-sm font-medium border transition-colors ${
                showInactive
                  ? "bg-[#00BCD4] border-border text-white"
                  : "bg-secondary border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <TbToggleLeft className="h-4 w-4" />
              {showInactive ? "Showing Inactive" : "Show Inactive"}
            </button>
          )}
          {isAdmin && <InviteLinkDialog />}
          {isAdmin && (
            <AddEmployeeDialog orgId={orgId} onSuccess={fetchMembers} members={members} />
          )}
          <Badge
            variant="secondary"
            className="h-8 px-3 text-sm font-medium bg-[#00BCD4] text-white border border-border"
          >
            {filtered.length} member{filtered.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <TbSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl bg-secondary border-border focus:border-border focus:ring-ring"
          />
        </div>
        <Select
          value={department}
          onValueChange={(v) => v !== null && setDepartment(v)}
        >
          <SelectTrigger className="w-full sm:w-[200px] rounded-xl bg-secondary border-border">
            <TbBriefcase className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs: Team Grid / Org Chart */}
      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">
            <TbUsers className="h-4 w-4 mr-1.5" />
            Team Grid
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="chart">
              <TbHierarchy2 className="h-4 w-4 mr-1.5" />
              Org Chart
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="chart" className="mt-4">
          <div className="rounded-3xl border border-border bg-secondary p-6">
            <OrgChart employees={members.map(m => ({
              id: m.id,
              full_name: m.full_name,
              designation: m.designation,
              department: m.department,
              avatar_url: m.avatar_url,
              role: m.role ?? (m.is_admin ? 'admin' : 'viewer'),
              reports_to: m.reports_to,
            }))} />
          </div>
        </TabsContent>

        <TabsContent value="grid" className="mt-4">
      {/* Employee Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
            <TbUserX className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-muted-foreground">
            No team members found
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {search || department !== "all"
              ? "Try adjusting your search or filter criteria"
              : "Team members will appear here once added"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const initials = m.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)

            return (
              <div
                key={m.id}
                className={`group relative rounded-3xl border border-border shadow-soft p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 ${
                  m.is_active
                    ? "bg-[#0D1B2A]"
                    : "bg-secondary opacity-75"
                }`}
              >
                {/* Status indicator & admin actions */}
                <div className="absolute top-4 right-4">
                  {isAdmin && m.id !== employee?.id ? (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.is_active ? (
                        <>
                          <EditEmployeeDialog employee={m} onSuccess={fetchMembers} members={members} />
                          <DeactivateEmployeeButton employee={m} onSuccess={fetchMembers} />
                        </>
                      ) : (
                        <ReactivateEmployeeButton employee={m} onSuccess={fetchMembers} />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${m.is_active ? "bg-[#34D399]" : "bg-[#0A1628] border border-border"}`} />
                      <span className={`text-[11px] font-medium ${m.is_active ? "text-foreground" : "text-muted-foreground"}`}>
                        {m.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="relative mb-3">
                    <div className="h-[72px] w-[72px] rounded-full bg-[#1A2B45] p-[2.5px]">
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt={m.full_name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
                          <span className="text-lg font-semibold text-foreground">
                            {initials}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                      <RoleBadge role={m.role ?? (m.is_admin ? 'admin' : 'viewer')} />
                    </div>
                  </div>

                  <h3 className="font-semibold text-[15px] mt-1">
                    {m.full_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {m.designation}
                  </p>
                </div>

                {/* Department Badge */}
                {m.department && (
                  <div className="flex justify-center mb-4">
                    <Badge
                      variant="secondary"
                      className="bg-secondary text-foreground border border-border text-xs font-normal"
                    >
                      <TbBriefcase className="h-3 w-3 mr-1.5" />
                      {m.department}
                    </Badge>
                  </div>
                )}

                {/* Info rows */}
                <div className="space-y-2.5 pt-3 border-t border-[#1A2B45]">
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <TbCalendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      Joined {format(new Date(m.date_of_joining), "MMM yyyy")}
                    </span>
                  </div>

                  <a
                    href={`mailto:${m.email}`}
                    className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group/email"
                  >
                    <TbMail className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover/email:text-foreground" />
                    <span className="truncate">{m.email}</span>
                  </a>

                  {m.phone && (
                    <a
                      href={`tel:${m.phone}`}
                      className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group/phone"
                    >
                      <TbPhone className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover/phone:text-foreground" />
                      <span>{m.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ReactivateEmployeeButton({
  employee: emp,
  onSuccess,
}: {
  employee: Employee
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleReactivate() {
    setLoading(true)
    const { error } = await supabase
      .from("fs_employees")
      .update({ is_active: true })
      .eq("id", emp.id)

    if (error) {
      toast.error("Failed to reactivate employee")
    } else {
      toast.success(`${emp.full_name} has been reactivated`)
      setOpen(false)
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1.5 rounded-lg hover:bg-[#1A2B45] text-[#8094B0] hover:text-[#F1F5F9] transition-colors">
          <TbUserCheck className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <TbUserCheck className="h-5 w-5" />
            Reactivate Employee
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to reactivate <strong>{emp.full_name}</strong>?
          They will be able to log in and appear in the team list again.
        </p>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleReactivate}
            disabled={loading}
            className="bg-[#00BCD4] hover:bg-[#00ACC1] text-white"
          >
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reactivate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InviteLinkDialog() {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open || token) return
    fetch("/api/org/invite")
      .then((r) => r.json())
      .then((d) => setToken(d.token))
      .catch(() => {})
  }, [open, token])

  const link = token && typeof window !== "undefined"
    ? `${window.location.origin}/join?token=${token}`
    : ""

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function rotate() {
    setLoading(true)
    try {
      const res = await fetch("/api/org/invite", { method: "POST" })
      const d = await res.json()
      if (res.ok) {
        setToken(d.token)
        toast.success("Invite link regenerated — old links no longer work")
      } else {
        toast.error(d.error || "Failed to regenerate")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <TbLink className="h-4 w-4" />
          Invite Link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TbLink className="h-5 w-5 text-foreground" />
            Workspace invite link
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this link with a new team member. They&apos;ll create their own
            account (email &amp; password) and join this workspace. You can then set
            their role &amp; department here.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={link || "Loading…"} className="rounded-xl bg-secondary border-border text-xs" />
            <Button onClick={copy} disabled={!link} className="shrink-0">
              {copied ? <TbCircleCheck className="h-4 w-4" /> : <TbCopy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Anyone with this link can join. Regenerate to revoke it.
            </p>
            <Button variant="ghost" size="sm" onClick={rotate} disabled={loading} className="gap-1.5 shrink-0">
              {loading ? <TbLoader2 className="h-3.5 w-3.5 animate-spin" /> : <TbRefresh className="h-3.5 w-3.5" />}
              Regenerate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AddEmployeeDialog({
  orgId,
  onSuccess,
  members,
}: {
  orgId: string
  onSuccess: () => void
  members: Employee[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [designation, setDesignation] = useState("")
  const [department, setDepartment] = useState("")
  const [phone, setPhone] = useState("")
  const [isAdminRole, setIsAdminRole] = useState(false)
  const [role, setRole] = useState<EmployeeRole>("viewer")
  const [reportsTo, setReportsTo] = useState("")

  function resetForm() {
    setFullName("")
    setEmail("")
    setPassword("")
    setDesignation("")
    setDepartment("")
    setPhone("")
    setIsAdminRole(false)
    setShowPassword(false)
    setRole("viewer")
    setReportsTo("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName || !email || !password || !designation) return
    setLoading(true)

    try {
      const res = await fetch("/api/employees/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          designation,
          department: department || undefined,
          phone: phone || undefined,
          org_id: orgId,
          is_admin: isAdminRole,
          role,
          reports_to: reportsTo || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to create employee")
      } else {
        toast.success(`${fullName} has been added to the team!`)
        setOpen(false)
        resetForm()
        onSuccess()
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-[#00BCD4] hover:bg-[#00ACC1] text-white">
          <TbPlus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TbUserPlus className="h-5 w-5 text-foreground" />
            Add New Employee
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
              className="rounded-xl bg-secondary border-border focus:border-border"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@company.com"
                required
                className="rounded-xl bg-secondary border-border focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="rounded-xl bg-secondary border-border focus:border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                className="rounded-xl bg-secondary border-border focus:border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <TbEyeOff className="h-4 w-4" />
                ) : (
                  <TbEye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Designation</Label>
              <Input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Software Engineer"
                required
                className="rounded-xl bg-secondary border-border focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
                className="rounded-xl bg-secondary border-border focus:border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role</Label>
              <RoleSelector
                value={role}
                onChange={(r) => {
                  setRole(r)
                  setIsAdminRole(r === "admin")
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reports To</Label>
              <Select value={reportsTo || "none"} onValueChange={(v) => setReportsTo(v === "none" ? "" : (v ?? ""))}>
                <SelectTrigger className="rounded-xl bg-secondary border-border">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {members.filter(m => m.is_active).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#00BCD4] hover:bg-[#00ACC1] text-white"
            disabled={loading}
          >
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Employee
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditEmployeeDialog({
  employee: emp,
  onSuccess,
  members,
}: {
  employee: Employee
  onSuccess: () => void
  members: Employee[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState(emp.full_name)
  const [email, setEmail] = useState(emp.email)
  const [designation, setDesignation] = useState(emp.designation)
  const [department, setDepartment] = useState(emp.department ?? "")
  const [phone, setPhone] = useState(emp.phone ?? "")
  const [isAdminRole, setIsAdminRole] = useState(emp.is_admin)
  const [role, setRole] = useState<EmployeeRole>(emp.role ?? (emp.is_admin ? "admin" : "viewer"))
  const [reportsTo, setReportsTo] = useState(emp.reports_to ?? "")
  const [scope, setScope] = useState<ScopeLevel>(emp.scope ?? "own")
  const [departmentId, setDepartmentId] = useState(emp.department_id ?? "")
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([])
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resetting, setResetting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!open || depts.length) return
    ;(async () => {
      const { data } = await supabase
        .from("departments").select("id, name").eq("org_id", emp.org_id).order("name")
      setDepts((data ?? []) as { id: string; name: string }[])
    })()
  }, [open])

  function resetForm() {
    setFullName(emp.full_name)
    setEmail(emp.email)
    setDesignation(emp.designation)
    setDepartment(emp.department ?? "")
    setPhone(emp.phone ?? "")
    setIsAdminRole(emp.is_admin)
    setRole(emp.role ?? (emp.is_admin ? "admin" : "viewer"))
    setReportsTo(emp.reports_to ?? "")
    setScope(emp.scope ?? "own")
    setDepartmentId(emp.department_id ?? "")
    setShowResetPassword(false)
    setNewPassword("")
    setShowNewPassword(false)
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    setResetting(true)
    try {
      const res = await fetch("/api/employees/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: emp.id,
          password: newPassword,
          // Pass the current email from the form as a hint in case the
          // stored auth_id is missing/invalid (lets the server locate the
          // correct auth user by email).
          email_hint: email,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to reset password")
      } else {
        toast.success(`Password reset for ${emp.full_name}`)
        setNewPassword("")
        setShowResetPassword(false)
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setResetting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName || !designation || !email) return
    setLoading(true)

    // If email changed, update both auth and employee record via admin API
    if (email.trim().toLowerCase() !== emp.email.toLowerCase()) {
      const emailRes = await fetch("/api/employees/update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: emp.id, email: email.trim() }),
      })
      const emailData = await emailRes.json()
      if (!emailRes.ok) {
        toast.error(emailData.error || "Failed to update email")
        setLoading(false)
        return
      }
    }

    const { error } = await supabase
      .from("fs_employees")
      .update({
        full_name: fullName,
        designation,
        department: department || null,
        phone: phone || null,
        is_admin: isAdminRole,
        role,
        reports_to: reportsTo || null,
        scope,
        department_id: departmentId || null,
      })
      .eq("id", emp.id)

    if (error) {
      toast.error("Failed to update employee")
    } else {
      toast.success(`${fullName} updated successfully`)
      setOpen(false)
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <button className="p-1.5 rounded-lg hover:bg-[#1A2B45] text-[#8094B0] hover:text-[#F1F5F9] transition-colors">
          <TbPencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TbPencil className="h-5 w-5 text-foreground" />
            Edit Employee
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="rounded-xl bg-secondary border-border focus:border-border"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl bg-secondary border-border focus:border-border"
              />
              {email.trim().toLowerCase() !== emp.email.toLowerCase() && (
                <p className="text-xs text-muted-foreground">
                  Changing the email will also update this user&apos;s login email.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl bg-secondary border-border focus:border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Designation</Label>
              <Input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                required
                className="rounded-xl bg-secondary border-border focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="rounded-xl bg-secondary border-border focus:border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role</Label>
              <RoleSelector
                value={role}
                onChange={(r) => {
                  setRole(r)
                  setIsAdminRole(r === "admin")
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reports To</Label>
              <Select value={reportsTo || "none"} onValueChange={(v) => setReportsTo(v === "none" ? "" : (v ?? ""))}>
                <SelectTrigger className="rounded-xl bg-secondary border-border">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {members.filter(m => m.is_active && m.id !== emp.id).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Access Scope</Label>
              <Select value={scope} onValueChange={(v) => v && setScope(v as ScopeLevel)}>
                <SelectTrigger className="rounded-xl bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">Own only</SelectItem>
                  <SelectItem value="team">Team (subtree)</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="org">Whole org</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Department</Label>
              <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v && v !== "none" ? v : "")}>
                <SelectTrigger className="rounded-xl bg-secondary border-border">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {depts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reset Password Section */}
          <div className="rounded-xl border border-border bg-secondary p-3 space-y-3">
            {!showResetPassword ? (
              <button
                type="button"
                onClick={() => setShowResetPassword(true)}
                className="flex items-center gap-2 text-sm text-foreground hover:text-foreground font-medium"
              >
                <TbKey className="h-4 w-4" />
                Reset Password
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <TbKey className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-medium text-foreground">Set New Password</span>
                </div>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pr-10 rounded-xl bg-[#0D1B2A] border-border focus:border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <TbEyeOff className="h-4 w-4" /> : <TbEye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={resetting}
                    className="flex-1 bg-[#1A2B45] hover:bg-[#1A2B45] text-white"
                  >
                    {resetting && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowResetPassword(false)
                      setNewPassword("")
                    }}
                    disabled={resetting}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The employee will need to use this new password to log in.
                </p>
              </>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#00BCD4] hover:bg-[#00ACC1] text-white"
            disabled={loading}
          >
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeactivateEmployeeButton({
  employee: emp,
  onSuccess,
}: {
  employee: Employee
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleDeactivate() {
    setLoading(true)
    const { error } = await supabase
      .from("fs_employees")
      .update({ is_active: false })
      .eq("id", emp.id)

    if (error) {
      toast.error("Failed to deactivate employee")
    } else {
      toast.success(`${emp.full_name} has been deactivated`)
      setOpen(false)
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1.5 rounded-lg hover:bg-[#1A2B45] text-[#8094B0] hover:text-[#F1F5F9] transition-colors">
          <TbUserMinus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <TbUserMinus className="h-5 w-5" />
            Deactivate Employee
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to deactivate <strong>{emp.full_name}</strong>?
          They will no longer be able to log in or appear in the team list.
        </p>
        <div className="flex gap-2 justify-end mt-4">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeactivate}
            disabled={loading}
            className="bg-destructive/15 hover:bg-destructive/15 text-destructive"
          >
            {loading && <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Deactivate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
