"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useOrg } from "@/hooks/use-org"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  TbWallet,
  TbTrendingUp,
  TbUsers,
  TbCircleCheck,
  TbPlus,
  TbLoader2,
  TbCreditCard,
  TbArrowUpRight,
  TbArrowDownRight,
  TbCurrencyRupee,
  TbCalendar,
  TbBuilding,
  TbDownload,
  TbEye,
  TbChevronRight,
  TbReceipt,
  TbCash,
  TbPigMoney,
  TbDiscount,
  TbClock,
} from "react-icons/tb"
import { toast } from "sonner"
import type { Payroll, Employee } from "@/types"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export default function PayrollPage() {
  const { employee, isAdmin, isLoading: isUserLoading } = useUser()
  const orgId = useOrg()
  const supabase = useMemo(() => createClient(), [])

  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [loading, setLoading] = useState(false)
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const fetchData = useCallback(async () => {
    if (!employee) return
    setLoading(true)
    let query = supabase
      .from("fs_payroll")
      .select("*, employee:fs_employees(*)")
      .eq("month", parseInt(selectedMonth))
      .eq("year", parseInt(selectedYear))
      .order("created_at", { ascending: false })

    if (!isAdmin) {
      query = query.eq("employee_id", employee.id)
    }

    const { data } = await query
    if (data) {
      const filtered = isAdmin
        ? data.filter((p: any) => p.employee?.org_id === orgId)
        : data
      setPayrolls(filtered as unknown as Payroll[])
    }

    if (isAdmin) {
      const { data: emps } = await supabase
        .from("fs_employees")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
      if (emps) setEmployees(emps)
    }
    setLoading(false)
  }, [employee?.id, isAdmin, orgId, selectedMonth, selectedYear, supabase])

  useEffect(() => {
    if (!employee) return
    fetchData()
  }, [employee?.id, fetchData])

  const totalNet = payrolls.reduce((sum, p) => sum + Number(p.net_salary), 0)
  const totalBasic = payrolls.reduce((sum, p) => sum + Number(p.basic_salary), 0)
  const totalDeductions = payrolls.reduce((sum, p) => sum + Number(p.deductions), 0)
  const paidCount = payrolls.filter((p) => p.status === "paid").length
  const pendingCount = payrolls.filter((p) => p.status === "pending").length

  function handleViewPayslip(p: Payroll) {
    setSelectedPayroll(p)
    setViewOpen(true)
  }

  if (isUserLoading || !employee) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-secondary border-t-[#0F172A] animate-spin" />
            <TbWallet className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Loading payroll...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shadow-soft">
              <TbWallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Manage employee compensation" : "Your salary & payslips"}
              </p>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <RunPayrollDialog
              employees={employees}
              month={parseInt(selectedMonth)}
              year={parseInt(selectedYear)}
              onSuccess={fetchData}
            />
            <Button
              variant="secondary"
              className="bg-secondary border border-border hover:brightness-95 transition-all"
              onClick={() => toast.info("Razorpay integration required for live payments")}
            >
              <TbCreditCard className="mr-2 h-4 w-4" />
              Process Payments
            </Button>
          </div>
        )}
      </div>

      {/* Month/Year Selector - Pill style */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
          <TbCalendar className="h-4 w-4 text-foreground" />
          <Select value={selectedMonth} onValueChange={(v) => v !== null && setSelectedMonth(v)}>
            <SelectTrigger className="border-0 bg-transparent p-0 h-auto w-auto min-w-[100px] shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">|</span>
          <Select value={selectedYear} onValueChange={(v) => v !== null && setSelectedYear(v)}>
            <SelectTrigger className="border-0 bg-transparent p-0 h-auto w-auto min-w-[60px] shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Admin Stats Dashboard */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Payroll"
            value={`₹${totalNet.toLocaleString("en-IN")}`}
            subtitle={`${payrolls.length} employees`}
            icon={<TbWallet className="h-5 w-5" />}
            gradient="bg-[#00BCD4] text-white"
            shadowColor=""
          />
          <StatCard
            title="Total Earnings"
            value={`₹${totalBasic.toLocaleString("en-IN")}`}
            subtitle="Basic + HRA + Allowances"
            icon={<TbTrendingUp className="h-5 w-5" />}
            gradient="bg-[#DBEAFE] text-[#0F172A]"
            shadowColor=""
            trend="up"
          />
          <StatCard
            title="Deductions"
            value={`₹${totalDeductions.toLocaleString("en-IN")}`}
            subtitle="Tax + PF + Other"
            icon={<TbDiscount className="h-5 w-5" />}
            gradient="bg-[#0F172A] text-white"
            shadowColor=""
            trend="down"
          />
          <StatCard
            title="Payment Status"
            value={`${paidCount}/${payrolls.length}`}
            subtitle={pendingCount > 0 ? `${pendingCount} pending` : "All processed"}
            icon={<TbCircleCheck className="h-5 w-5" />}
            gradient="bg-[#EDE9FE] text-[#0F172A]"
            shadowColor=""
          />
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <TbLoader2 className="h-8 w-8 text-foreground animate-spin" />
        </div>
      )}

      {/* Admin: Employee Payroll Cards */}
      {isAdmin && !loading && payrolls.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Employee Breakdown</h2>
            <span className="text-xs text-muted-foreground">
              {MONTHS[parseInt(selectedMonth) - 1]} {selectedYear}
            </span>
          </div>
          <div className="grid gap-3">
            {payrolls.map((p, index) => (
              <div
                key={p.id}
                className="group relative overflow-hidden rounded-3xl bg-[#0D1B2A] border border-border shadow-soft transition-all duration-300 cursor-pointer"
                onClick={() => handleViewPayslip(p)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative p-4 sm:p-5 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#0F172A] flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">
                      {(p.employee?.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{p.employee?.full_name}</p>
                      <PayrollStatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.employee?.designation}</p>
                  </div>

                  {/* Salary breakdown mini */}
                  <div className="hidden sm:flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Basic</p>
                      <p className="font-medium">₹{Number(p.basic_salary).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Deductions</p>
                      <p className="font-medium text-foreground">-₹{Number(p.deductions).toLocaleString("en-IN")}</p>
                    </div>
                  </div>

                  {/* Net salary */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="text-lg font-semibold text-foreground">
                      ₹{Number(p.net_salary).toLocaleString("en-IN")}
                    </p>
                  </div>

                  {/* Arrow */}
                  <TbChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin: Empty state */}
      {isAdmin && !loading && payrolls.length === 0 && (
        <EmptyState
          title="No payroll records"
          description={`No payroll has been created for ${MONTHS[parseInt(selectedMonth) - 1]} ${selectedYear}`}
          action={
            <RunPayrollDialog
              employees={employees}
              month={parseInt(selectedMonth)}
              year={parseInt(selectedYear)}
              onSuccess={fetchData}
            />
          }
        />
      )}

      {/* Employee: Payslip View */}
      {!isAdmin && !loading && payrolls.length > 0 && (
        <div className="space-y-6">
          {payrolls.map((p) => (
            <PayslipCard key={p.id} payroll={p} />
          ))}
        </div>
      )}

      {/* Employee: Empty state */}
      {!isAdmin && !loading && payrolls.length === 0 && (
        <EmptyState
          title="No payslip available"
          description={`Your payslip for ${MONTHS[parseInt(selectedMonth) - 1]} ${selectedYear} hasn't been generated yet`}
        />
      )}

      {/* Payslip Detail Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TbReceipt className="h-5 w-5 text-foreground" />
              Payslip Details
            </DialogTitle>
          </DialogHeader>
          {selectedPayroll && <PayslipDetail payroll={selectedPayroll} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ───────── Stat Card ───────── */
function StatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  shadowColor,
  trend,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  gradient: string
  shadowColor: string
  trend?: "up" | "down"
}) {
  return (
    <div className="relative group overflow-hidden rounded-3xl bg-[#0D1B2A] border border-border shadow-soft p-5 transition-all duration-300">
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-2xl ${gradient} flex items-center justify-center`}>
            {icon}
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {trend === "up" ? <TbArrowUpRight className="h-3 w-3" /> : <TbArrowDownRight className="h-3 w-3" />}
            </div>
          )}
        </div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

/* ───────── Payslip Card (Employee View) ───────── */
function PayslipCard({ payroll: p }: { payroll: Payroll }) {
  const basicAmount = Number(p.basic_salary)
  const hraAmount = Number(p.hra)
  const allowAmount = Number(p.allowances)
  const deductAmount = Number(p.deductions)
  const netAmount = Number(p.net_salary)
  const gross = basicAmount + hraAmount + allowAmount

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0D1B2A] border border-border shadow-soft">
      {/* Decorative header */}
      <div className="relative h-32 bg-[#00BCD4] overflow-hidden">
        <div className="relative p-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TbReceipt className="h-5 w-5 text-[#0F172A]" />
              <h3 className="font-semibold text-lg text-[#0F172A]">Payslip</h3>
            </div>
            <p className="text-[#0F172A] text-sm mt-1">
              {MONTHS[p.month - 1]} {p.year}
            </p>
          </div>
          <PayrollStatusBadge status={p.status} large />
        </div>
      </div>

      {/* Net salary hero */}
      <div className="px-6 -mt-4 relative">
        <div className="rounded-2xl bg-[#0D1B2A] border border-border shadow-soft p-5 text-center backdrop-blur-sm">
          <p className="text-xs text-muted-foreground mb-1">Net Salary</p>
          <p className="text-4xl font-semibold text-foreground">
            ₹{netAmount.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Earnings & Deductions */}
      <div className="p-6 space-y-5">
        {/* Earnings section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#00BCD4]" />
            <h4 className="text-sm font-medium text-foreground">Earnings</h4>
            <span className="ml-auto text-sm font-semibold text-foreground">
              ₹{gross.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="space-y-2.5 pl-4">
            <SalaryRow icon={<TbCash className="h-3.5 w-3.5" />} label="Basic Salary" amount={basicAmount} />
            <SalaryRow icon={<TbBuilding className="h-3.5 w-3.5" />} label="HRA" amount={hraAmount} />
            <SalaryRow icon={<TbPigMoney className="h-3.5 w-3.5" />} label="Allowances" amount={allowAmount} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Deductions section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#0F172A]" />
            <h4 className="text-sm font-medium text-foreground">Deductions</h4>
            <span className="ml-auto text-sm font-semibold text-foreground">
              -₹{deductAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="pl-4">
            <SalaryRow icon={<TbDiscount className="h-3.5 w-3.5" />} label="Total Deductions" amount={deductAmount} isDeduction />
          </div>
        </div>

        {/* Visual bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Earnings vs Deductions</span>
            <span>{gross > 0 ? Math.round((deductAmount / gross) * 100) : 0}% deducted</span>
          </div>
          <div className="h-2 rounded-full bg-[#F1F5F9] border border-border overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00BCD4] transition-all duration-700"
              style={{ width: `${gross > 0 ? Math.round(((gross - deductAmount) / gross) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── Salary Row ───────── */
function SalaryRow({
  icon,
  label,
  amount,
  isDeduction,
}: {
  icon: React.ReactNode
  label: string
  amount: number
  isDeduction?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={`text-sm font-medium ${isDeduction ? "text-foreground" : "text-foreground"}`}>
        {isDeduction ? "-" : ""}₹{amount.toLocaleString("en-IN")}
      </span>
    </div>
  )
}

/* ───────── Payslip Detail (Dialog) ───────── */
function PayslipDetail({ payroll: p }: { payroll: Payroll }) {
  const gross = Number(p.basic_salary) + Number(p.hra) + Number(p.allowances)

  return (
    <div className="space-y-5">
      {/* Employee info */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 border border-border">
        <div className="w-10 h-10 rounded-full bg-[#0F172A] flex items-center justify-center">
          <span className="text-sm font-semibold text-white">
            {(p.employee?.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </span>
        </div>
        <div>
          <p className="font-medium">{p.employee?.full_name}</p>
          <p className="text-xs text-muted-foreground">{p.employee?.designation} &middot; {p.employee?.department}</p>
        </div>
        <div className="ml-auto">
          <PayrollStatusBadge status={p.status} />
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        <DetailRow label="Basic Salary" amount={Number(p.basic_salary)} />
        <DetailRow label="HRA" amount={Number(p.hra)} />
        <DetailRow label="Allowances" amount={Number(p.allowances)} />
        <div className="border-t border-border pt-2">
          <DetailRow label="Gross Salary" amount={gross} bold />
        </div>
        <DetailRow label="Deductions" amount={Number(p.deductions)} negative />
        <div className="border-t border-border pt-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Net Salary</span>
            <span className="text-xl font-semibold text-foreground">
              ₹{Number(p.net_salary).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* Period info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TbClock className="h-3 w-3" />
        <span>Pay period: {MONTHS[p.month - 1]} 1 — {MONTHS[p.month - 1]} {new Date(p.year, p.month, 0).getDate()}, {p.year}</span>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  amount,
  bold,
  negative,
}: {
  label: string
  amount: number
  bold?: boolean
  negative?: boolean
}) {
  return (
    <div className="flex justify-between py-1">
      <span className={`text-sm ${bold ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-semibold" : ""} ${negative ? "text-foreground" : ""}`}>
        {negative ? "-" : ""}₹{amount.toLocaleString("en-IN")}
      </span>
    </div>
  )
}

/* ───────── Status Badge ───────── */
function PayrollStatusBadge({ status, large }: { status: string; large?: boolean }) {
  const styles: Record<string, string> = {
    draft: "bg-[#F1F5F9] text-muted-foreground border-border",
    pending: "bg-[#EDE9FE] text-[#0F172A] border-border",
    paid: "bg-[#DBEAFE] text-[#0F172A] border-border",
  }

  const icons: Record<string, React.ReactNode> = {
    draft: <TbClock className="h-3 w-3" />,
    pending: <TbLoader2 className="h-3 w-3" />,
    paid: <TbCircleCheck className="h-3 w-3" />,
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] || styles.draft} ${large ? "px-3 py-1" : ""}`}>
      {icons[status]}
      {status}
    </span>
  )
}

/* ───────── Empty State ───────── */
function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shadow-soft">
          <TbWallet className="h-8 w-8 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#00BCD4] border border-border flex items-center justify-center">
          <TbCurrencyRupee className="h-3 w-3 text-[#0F172A]" />
        </div>
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ───────── Run Payroll Dialog ───────── */
function RunPayrollDialog({
  employees,
  month,
  year,
  onSuccess,
}: {
  employees: Employee[]
  month: number
  year: number
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState("")
  const [basic, setBasic] = useState("")
  const [hra, setHra] = useState("")
  const [allowances, setAllowances] = useState("")
  const [deductions, setDeductions] = useState("")
  const [saving, setSaving] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const gross = (parseFloat(basic) || 0) + (parseFloat(hra) || 0) + (parseFloat(allowances) || 0)
  const net = gross - (parseFloat(deductions) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId || !basic) return
    setSaving(true)

    const { error } = await supabase.from("fs_payroll").insert({
      employee_id: employeeId,
      month,
      year,
      basic_salary: parseFloat(basic),
      hra: parseFloat(hra) || 0,
      allowances: parseFloat(allowances) || 0,
      deductions: parseFloat(deductions) || 0,
      net_salary: net,
      status: "draft",
    })

    if (error) {
      if (error.code === "23505") {
        toast.error("Payroll already exists for this employee and month")
      } else {
        toast.error("Failed to create payroll")
      }
    } else {
      toast.success("Payroll record created!")
      setOpen(false)
      resetForm()
      onSuccess()
    }
    setSaving(false)
  }

  function resetForm() {
    setEmployeeId("")
    setBasic("")
    setHra("")
    setAllowances("")
    setDeductions("")
  }

  const selectedEmp = employees.find((e) => e.id === employeeId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#00BCD4] hover:brightness-105 text-white border border-[#1A2B45]">
          <TbPlus className="mr-2 h-4 w-4" />
          Add Payroll
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shadow-soft">
              <TbPlus className="h-4 w-4 text-white" />
            </div>
            Add Payroll — {MONTHS[month - 1]} {year}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Employee selector */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Employee</Label>
            <Select value={employeeId} onValueChange={(v) => v !== null && setEmployeeId(v)}>
              <SelectTrigger className="bg-[#0D1B2A] border border-border rounded-xl">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name} — {e.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Salary inputs */}
          <div className="grid grid-cols-2 gap-3">
            <SalaryInput label="Basic Salary" value={basic} onChange={setBasic} required icon="₹" />
            <SalaryInput label="HRA" value={hra} onChange={setHra} icon="₹" />
            <SalaryInput label="Allowances" value={allowances} onChange={setAllowances} icon="₹" />
            <SalaryInput label="Deductions" value={deductions} onChange={setDeductions} icon="₹" isDeduction />
          </div>

          {/* Live calculation */}
          <div className="rounded-2xl bg-secondary/60 border border-border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross</span>
              <span className="text-foreground">₹{gross.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deductions</span>
              <span className="text-foreground">-₹{(parseFloat(deductions) || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-medium">Net Salary</span>
              <span className="text-xl font-semibold text-foreground">
                ₹{net.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#00BCD4] hover:brightness-105 text-white border border-border h-11 text-sm font-medium"
            disabled={saving || !employeeId || !basic}
          >
            {saving ? (
              <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TbCircleCheck className="mr-2 h-4 w-4" />
            )}
            Create Payroll Record
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ───────── Salary Input ───────── */
function SalaryInput({
  label,
  value,
  onChange,
  required,
  icon,
  isDeduction,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  icon?: string
  isDeduction?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground">
            {icon}
          </span>
        )}
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="pl-7 bg-[#0D1B2A] border border-border rounded-xl focus:border-border"
          placeholder="0"
        />
      </div>
    </div>
  )
}
