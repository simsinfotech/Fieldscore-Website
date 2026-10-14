"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useUser } from "@/hooks/use-user"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TbFileUpload,
  TbUpload,
  TbCheck,
  TbX,
  TbAlertTriangle,
  TbCopy,
  TbArrowRight,
  TbRefresh,
  TbFileSpreadsheet,
  TbCloudUpload,
} from "react-icons/tb"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { LeadBatch } from "@/types"

type Step = "upload" | "mapping" | "done"

interface UploadResult {
  batch: LeadBatch
  columnMap: Record<string, string>
  fileColumns: string[]
  preview: PreviewRow[]
  summary: { total: number; valid: number; duplicates: number; errors: number }
}

interface PreviewRow {
  row_number: number
  raw_data: Record<string, unknown>
  parsed_data: Record<string, unknown> | null
  errors: { field: string; message: string }[]
  is_valid: boolean
  is_duplicate: boolean
}

const LEAD_FIELDS = [
  { value: "skip", label: "Skip (ignore)" },
  { value: "full_name", label: "Full Name" },
  { value: "phone", label: "Phone Number" },
  { value: "email", label: "Email" },
  { value: "project", label: "Project" },
  { value: "budget", label: "Budget" },
  { value: "city", label: "City" },
  { value: "source", label: "Source" },
  { value: "notes", label: "Notes" },
]

export default function UploadLeadsPage() {
  const { isAdmin } = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("upload")
  const [uploading, setUploading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [remapping, setRemapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Upload result state
  const [result, setResult] = useState<UploadResult | null>(null)
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})

  // Commit result
  const [commitResult, setCommitResult] = useState<{
    inserted: number
    reEnquiries: number
  } | null>(null)

  // Recent batches
  const [batches, setBatches] = useState<LeadBatch[]>([])

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/leads/batches")
      if (res.ok) {
        const data = await res.json()
        setBatches(data.batches)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/leads/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Upload failed")
        setUploading(false)
        return
      }

      setResult(data)
      setColumnMap(data.columnMap)
      setStep("mapping")
    } catch (err) {
      setError("Failed to upload file")
    }

    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function handleRemap() {
    if (!result) return
    setRemapping(true)
    setError(null)

    try {
      const res = await fetch("/api/leads/remap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: result.batch.id,
          columnMap,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Remap failed")
        setRemapping(false)
        return
      }

      setResult({
        ...result,
        batch: data.batch,
        preview: data.preview,
        summary: data.summary,
        columnMap,
      })
    } catch {
      setError("Failed to remap columns")
    }

    setRemapping(false)
  }

  async function handleCommit() {
    if (!result) return
    setCommitting(true)
    setError(null)

    try {
      const res = await fetch("/api/leads/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: result.batch.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Commit failed")
        setCommitting(false)
        return
      }

      setCommitResult(data)
      setStep("done")
      fetchBatches()
    } catch {
      setError("Failed to commit leads")
    }

    setCommitting(false)
  }

  function reset() {
    setStep("upload")
    setResult(null)
    setColumnMap({})
    setCommitResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F172A] text-white border border-border">
          <TbFileUpload className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upload Leads</h1>
          <p className="text-sm text-muted-foreground">Import leads from Excel or CSV files</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1">
        <StepBadge step={1} label="Upload" active={step === "upload"} done={step !== "upload"} />
        <TbArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <StepBadge step={2} label="Map" active={step === "mapping"} done={step === "done"} />
        <TbArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <StepBadge step={3} label="Done" active={step === "done"} done={false} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-destructive/15 px-4 py-3 text-sm text-destructive">
          <TbAlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <GlassCard>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            className="hidden"
          />

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border border-dashed p-6 sm:p-12 transition-colors cursor-pointer",
              dragOver
                ? "border-border bg-[#00BCD4]"
                : "border-border hover:border-border hover:bg-secondary"
            )}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00BCD4] border border-border mb-4">
              {uploading ? (
                <TbCloudUpload className="h-7 w-7 text-[#0F172A] animate-bounce" />
              ) : (
                <TbUpload className="h-7 w-7 text-[#0F172A]" />
              )}
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {uploading ? "Uploading & processing..." : "Drop your file here"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse. Supports .xlsx, .xls, .csv
            </p>
          </div>
        </GlassCard>
      )}

      {/* ── Step 2: Mapping & Preview ── */}
      {step === "mapping" && result && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Total Rows" value={result.summary.total} color="blue" />
            <MiniStat label="Valid" value={result.summary.valid} color="emerald" />
            <MiniStat label="Duplicates" value={result.summary.duplicates} color="amber" />
            <MiniStat label="Errors" value={result.summary.errors} color="red" />
          </div>

          {/* Column mapping */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Column Mapping</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemap}
                disabled={remapping}
                className="rounded-full"
              >
                <TbRefresh className={cn("h-4 w-4 mr-2", remapping && "animate-spin")} />
                {remapping ? "Re-validating..." : "Re-validate"}
              </Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {result.fileColumns.map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground min-w-0 flex-1 truncate" title={col}>
                    {col}
                  </span>
                  <TbArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Select
                    value={columnMap[col] || "skip"}
                    onValueChange={(v) => {
                      if (v !== null) setColumnMap((prev) => ({ ...prev, [col]: v }))
                    }}
                  >
                    <SelectTrigger className="w-[130px] sm:w-[160px] rounded-xl text-xs sm:text-sm shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Preview — card layout on mobile, table on desktop */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="text-base sm:text-lg font-semibold">Preview (first 20 rows)</h2>
            </div>

            {/* Mobile: card layout */}
            <div className="sm:hidden divide-y divide-border">
              {result.preview.map((row) => (
                <div
                  key={row.row_number}
                  className={cn(
                    "px-4 py-3 space-y-1 rounded-xl",
                    row.is_valid && "bg-[#DBEAFE]",
                    row.is_duplicate && "bg-[#F1F5F9]",
                    !row.is_valid && !row.is_duplicate && row.errors.length > 0 && "bg-destructive/10 text-destructive"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {(row.parsed_data as any)?.full_name || "—"}
                    </span>
                    {row.is_valid ? (
                      <span className="inline-flex items-center gap-1 text-xs text-foreground">
                        <TbCheck className="h-3.5 w-3.5" /> Valid
                      </span>
                    ) : row.is_duplicate ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <TbCopy className="h-3.5 w-3.5" /> Dupe
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive">
                        <TbX className="h-3.5 w-3.5" /> Error
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(row.parsed_data as any)?.phone_e164 || "—"}
                  </p>
                  {(row.parsed_data as any)?.project && (
                    <p className="text-xs text-muted-foreground">{(row.parsed_data as any).project}</p>
                  )}
                  {row.errors.length > 0 && (
                    <p className="text-xs text-destructive">{row.errors.map((e) => e.message).join("; ")}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs w-12">#</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Project</TableHead>
                    <TableHead className="text-xs">Budget</TableHead>
                    <TableHead className="text-xs">Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.preview.map((row) => (
                    <TableRow
                      key={row.row_number}
                      className={cn(
                        "border-border",
                        row.is_valid && "bg-[#DBEAFE]",
                        row.is_duplicate && "bg-[#F1F5F9]",
                        !row.is_valid && !row.is_duplicate && row.errors.length > 0 && "bg-destructive/10 text-destructive"
                      )}
                    >
                      <TableCell className="text-xs text-muted-foreground">{row.row_number}</TableCell>
                      <TableCell>
                        {row.is_valid ? (
                          <span className="inline-flex items-center gap-1 text-xs text-foreground">
                            <TbCheck className="h-3.5 w-3.5" /> Valid
                          </span>
                        ) : row.is_duplicate ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <TbCopy className="h-3.5 w-3.5" /> Dupe
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive">
                            <TbX className="h-3.5 w-3.5" /> Error
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(row.parsed_data as any)?.full_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(row.parsed_data as any)?.phone_e164 || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(row.parsed_data as any)?.email || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(row.parsed_data as any)?.project || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(row.parsed_data as any)?.budget_raw || "-"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {row.errors.map((e) => e.message).join("; ") || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={reset} className="rounded-full">
              Cancel
            </Button>
            <Button
              onClick={handleCommit}
              disabled={committing || result.summary.valid === 0}
              className="rounded-full bg-[#00BCD4] text-white border border-border hover:bg-[#00ACC1]"
            >
              {committing ? "Committing..." : `Commit ${result.summary.valid} leads`}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 3: Done ── */}
      {step === "done" && commitResult && (
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00BCD4] border border-border mb-4">
            <TbCheck className="h-8 w-8 text-[#0F172A]" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Upload Complete</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {commitResult.inserted} new leads imported
            {commitResult.reEnquiries > 0 && `, ${commitResult.reEnquiries} re-enquiries recorded`}
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Button variant="outline" onClick={reset} className="rounded-full">
              Upload Another
            </Button>
            <a
              href="/leads"
              className="inline-flex items-center justify-center rounded-full bg-[#0F172A] px-4 py-2 text-sm font-medium text-white border border-border hover:bg-[#0F172A] transition-all"
            >
              View Leads
            </a>
          </div>
        </GlassCard>
      )}

      {/* Recent uploads */}
      {batches.length > 0 && (
        <GlassCard className="p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-base sm:text-lg font-semibold">Recent Uploads</h2>
          </div>

          {/* Mobile: card layout */}
          <div className="sm:hidden divide-y divide-border">
            {batches.map((b) => (
              <div key={b.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <TbFileSpreadsheet className="h-4 w-4 text-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{b.file_name}</span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border shrink-0 ml-2",
                      b.status === "committed" && "bg-[#DBEAFE] text-foreground border-border",
                      b.status === "validated" && "bg-[#0D1B2A] text-foreground border-border",
                      b.status === "pending" && "bg-[#EDE9FE] text-muted-foreground border-border",
                      b.status === "failed" && "bg-destructive/15 text-destructive border-border"
                    )}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">{b.total_rows} total</span>
                  <span className="text-foreground font-semibold">{b.valid_rows} valid</span>
                  <span className="text-muted-foreground">{b.dupe_rows} dupes</span>
                  <span className="text-foreground">{b.error_rows} errors</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(b.created_at), "MMM d, yyyy HH:mm")}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs">File</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Total</TableHead>
                  <TableHead className="text-xs">Valid</TableHead>
                  <TableHead className="text-xs">Dupes</TableHead>
                  <TableHead className="text-xs">Errors</TableHead>
                  <TableHead className="text-xs">Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id} className="border-border">
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <TbFileSpreadsheet className="h-4 w-4 text-foreground" />
                        {b.file_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
                          b.status === "committed" && "bg-[#DBEAFE] text-foreground border-border",
                          b.status === "validated" && "bg-[#0D1B2A] text-foreground border-border",
                          b.status === "pending" && "bg-[#EDE9FE] text-muted-foreground border-border",
                          b.status === "failed" && "bg-destructive/15 text-destructive border-border"
                        )}
                      >
                        {b.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{b.total_rows}</TableCell>
                    <TableCell className="text-sm text-foreground font-semibold">{b.valid_rows}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.dupe_rows}</TableCell>
                    <TableCell className="text-sm text-foreground">{b.error_rows}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(b.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}
    </div>
  )
}

function StepBadge({
  step,
  label,
  active,
  done,
}: {
  step: number
  label: string
  active: boolean
  done: boolean
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors border border-border",
      active && "bg-[#00BCD4] text-white font-medium",
      done && "bg-[#0F172A] text-white",
      !active && !done && "bg-[#0D1B2A] text-muted-foreground"
    )}>
      <span className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold border border-border",
        active && "bg-[#0F172A] text-white",
        done && "bg-[#00BCD4] text-white",
        !active && !done && "bg-[#0D1B2A] text-foreground"
      )}>
        {done ? <TbCheck className="h-3 w-3" /> : step}
      </span>
      {label}
    </div>
  )
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: "blue" | "emerald" | "amber" | "red"
}) {
  const colors = {
    blue: "text-foreground border-border bg-[#0D1B2A]",
    emerald: "text-[#0F172A] border-border bg-[#DBEAFE]",
    amber: "text-[#0F172A] border-border bg-[#EDE9FE]",
    red: "text-destructive border-border bg-destructive/10",
  }

  return (
    <div className={cn("rounded-2xl border p-4 text-center shadow-soft", colors[color])}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  )
}
