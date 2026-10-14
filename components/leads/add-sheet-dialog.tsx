"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  TbPlus,
  TbLoader2,
  TbCloudDownload,
  TbCheck,
  TbArrowRight,
  TbArrowLeft,
  TbCopy,
} from "react-icons/tb"
import { toast } from "sonner"
import { LEAD_FIELDS } from "@/lib/leads/column-mapper"
import type { LeadField } from "@/lib/leads/column-mapper"

interface AddSheetDialogProps {
  onSuccess: () => void
}

type Step = "url" | "share" | "map" | "preview" | "done"

export function AddSheetDialog({ onSuccess }: AddSheetDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("url")
  const [loading, setLoading] = useState(false)

  // Step 1: URL
  const [url, setUrl] = useState("")
  const [label, setLabel] = useState("")

  // Step 2: Share info
  const [serviceAccountEmail, setServiceAccountEmail] = useState("")

  // Step 3: Mapping
  const [spreadsheetId, setSpreadsheetId] = useState("")
  const [title, setTitle] = useState("")
  const [sheets, setSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState("")
  const [headerRow, setHeaderRow] = useState(1)
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, LeadField | "skip">>({})
  const [previewRows, setPreviewRows] = useState<string[][]>([])

  function resetForm() {
    setStep("url")
    setUrl("")
    setLabel("")
    setServiceAccountEmail("")
    setSpreadsheetId("")
    setTitle("")
    setSheets([])
    setSelectedSheet("")
    setHeaderRow(1)
    setHeaders([])
    setColumnMap({})
    setPreviewRows([])
  }

  async function handlePreview() {
    if (!url) return
    setLoading(true)
    try {
      const res = await fetch("/api/leads/sheet-sources/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          sheet_name: selectedSheet || undefined,
          header_row: headerRow,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.serviceAccountEmail) {
          setServiceAccountEmail(data.serviceAccountEmail)
          setStep("share")
        } else {
          toast.error(data.error || "Failed to preview sheet")
        }
        setLoading(false)
        return
      }

      setSpreadsheetId(data.spreadsheetId)
      setTitle(data.title)
      setSheets(data.sheets || [])
      setSelectedSheet(data.sheets?.[0] || "Sheet1")
      setHeaders(data.headers || [])
      setColumnMap(data.columnMap || {})
      setPreviewRows(data.rows || [])
      setServiceAccountEmail(data.serviceAccountEmail || "")
      if (!label) setLabel(data.title || "")
      setStep("map")
    } catch {
      toast.error("Failed to connect to sheet")
    }
    setLoading(false)
  }

  async function handleRetryAfterShare() {
    setStep("url")
    await handlePreview()
  }

  async function handleCreate() {
    setLoading(true)
    try {
      const res = await fetch("/api/leads/sheet-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          label,
          sheet_name: selectedSheet,
          header_row: headerRow,
          column_map: columnMap,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to create source")
      } else {
        toast.success("Sheet source created!")
        setStep("done")
        onSuccess()
      }
    } catch {
      toast.error("Something went wrong")
    }
    setLoading(false)
  }

  function handleCopyEmail() {
    navigator.clipboard.writeText(serviceAccountEmail)
    toast.success("Email copied!")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-[#0D1B2A] text-white border border-[#1A2B45] hover:bg-[#1A2B45]">
          <TbPlus className="mr-2 h-4 w-4" />
          Add Sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TbCloudDownload className="h-5 w-5 text-foreground" />
            Connect Google Sheet
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          {(["url", "share", "map", "preview"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-4 h-px bg-border" />}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  step === s
                    ? "bg-[#00BCD4] text-white font-medium border border-border"
                    : "text-muted-foreground"
                }`}
              >
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-secondary text-[10px] font-medium">
                  {i + 1}
                </span>
                {s === "url"
                  ? "URL"
                  : s === "share"
                    ? "Share"
                    : s === "map"
                      ? "Map"
                      : "Preview"}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Paste URL */}
        {step === "url" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Google Sheets URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="bg-secondary border border-border rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Facebook Lead Ads"
                className="bg-secondary border border-border rounded-xl"
              />
            </div>
            <Button
              onClick={handlePreview}
              disabled={!url || loading}
              className="w-full bg-[#1A2B45] hover:bg-[#1A2B45] text-white"
            >
              {loading ? (
                <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TbArrowRight className="mr-2 h-4 w-4" />
              )}
              Connect & Preview
            </Button>
          </div>
        )}

        {/* Step 2: Share with SA */}
        {step === "share" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-secondary p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Share your spreadsheet with this email:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-[#0D1B2A] rounded-xl px-3 py-2 border border-border truncate">
                  {serviceAccountEmail}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                  className="shrink-0"
                >
                  <TbCopy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Open your Google Sheet, click Share, paste this email, and give it Viewer access.
              </p>
            </div>
            <Button
              onClick={handleRetryAfterShare}
              disabled={loading}
              className="w-full bg-[#1A2B45] hover:bg-[#1A2B45] text-white"
            >
              {loading ? (
                <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TbCheck className="mr-2 h-4 w-4" />
              )}
              I&apos;ve shared it — retry
            </Button>
          </div>
        )}

        {/* Step 3: Map columns */}
        {step === "map" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TbCheck className="h-4 w-4 text-foreground" />
              Connected to <strong className="text-foreground">{title}</strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Sheet</Label>
                <Select value={selectedSheet} onValueChange={(v) => v && setSelectedSheet(v)}>
                  <SelectTrigger className="bg-secondary border border-border rounded-xl h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Label</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="bg-secondary border border-border rounded-xl h-9 text-sm"
                />
              </div>
            </div>

            {/* Column mapping */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Column Mapping</Label>
              <div className="rounded-2xl border border-border divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {headers.map((header) => (
                  <div
                    key={header}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-3 py-2"
                  >
                    <span className="text-sm truncate sm:max-w-[200px]">
                      {header}
                    </span>
                    <Select
                      value={columnMap[header] || "skip"}
                      onValueChange={(v) =>
                        setColumnMap((prev) => ({
                          ...prev,
                          [header]: v as LeadField | "skip",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-[#0D1B2A]">
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
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("url")}
                className="flex-1"
              >
                <TbArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setStep("preview")}
                className="flex-1 bg-[#1A2B45] hover:bg-[#1A2B45] text-white"
              >
                Preview Data
                <TbArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === "preview" && (
          <>
            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                Preview of first {previewRows.length} rows:
              </p>
              <div className="rounded-2xl border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h} className="text-xs whitespace-nowrap">
                          {h}
                          {columnMap[h] && columnMap[h] !== "skip" && (
                            <span className="ml-1 text-muted-foreground">
                              ({columnMap[h]})
                            </span>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((_, j) => (
                          <TableCell
                            key={j}
                            className="text-xs whitespace-nowrap max-w-[200px] truncate"
                          >
                            {row[j] || ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-border shrink-0">
              <Button
                variant="outline"
                onClick={() => setStep("map")}
                className="flex-1"
              >
                <TbArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-[#00BCD4] hover:bg-[#2563EB] text-white"
              >
                {loading ? (
                  <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TbCheck className="mr-2 h-4 w-4" />
                )}
                Activate Source
              </Button>
            </div>
          </>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <div className="text-center py-6 space-y-3">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#00BCD4] border border-border">
              <TbCheck className="h-7 w-7 text-[#F1F5F9]" />
            </div>
            <h3 className="font-semibold">Sheet Connected!</h3>
            <p className="text-sm text-muted-foreground">
              New rows will sync automatically every 5 minutes.
            </p>
            <Button
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
              className="bg-[#1A2B45] hover:bg-[#1A2B45] text-white"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
