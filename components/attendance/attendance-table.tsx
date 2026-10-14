"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import type { Attendance } from "@/types"

interface AttendanceTableProps {
  records: Attendance[]
  showEmployee?: boolean
}

export function AttendanceTable({ records, showEmployee }: AttendanceTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showEmployee && <TableHead>Employee</TableHead>}
          <TableHead>Date</TableHead>
          <TableHead>Check In</TableHead>
          <TableHead>Check Out</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Location</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={showEmployee ? 7 : 6}
              className="text-center text-muted-foreground py-8"
            >
              No attendance records found
            </TableCell>
          </TableRow>
        ) : (
          records.map((r) => (
            <TableRow key={r.id}>
              {showEmployee && (
                <TableCell className="font-medium">
                  {r.employee?.full_name ?? "—"}
                </TableCell>
              )}
              <TableCell>{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
              <TableCell>
                {r.check_in ? format(new Date(r.check_in), "hh:mm a") : "—"}
              </TableCell>
              <TableCell>
                {r.check_out ? format(new Date(r.check_out), "hh:mm a") : "—"}
              </TableCell>
              <TableCell>
                {r.work_hours
                  ? `${Math.floor(r.work_hours)}h ${Math.round((r.work_hours % 1) * 60)}m`
                  : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
              <TableCell className="hidden md:table-cell max-w-[200px] truncate text-xs text-muted-foreground">
                {r.check_in_address ?? "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    present: "bg-[#DBEAFE] text-foreground rounded-full",
    late: "bg-[#EDE9FE] text-foreground rounded-full",
    half_day: "bg-[#EDE9FE] text-foreground rounded-full",
    absent: "bg-destructive/15 text-destructive rounded-full",
  }
  return (
    <Badge className={styles[status] ?? "rounded-full border border-border"}>
      {status.replace("_", " ")}
    </Badge>
  )
}
