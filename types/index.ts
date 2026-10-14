export type EmployeeRole = "admin" | "sales_admin" | "manager" | "setter" | "viewer"

export type ScopeLevel = "own" | "team" | "department" | "org"

export interface Department {
  id: string
  org_id: string
  key: string
  name: string
  head_id?: string | null
  created_at: string
}

export type WorkType = "task" | "content" | "ticket" | "campaign" | "bug" | "request"

export type WorkStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "approved"
  | "done"
  | "blocked"
  | "cancelled"

export type RecurrenceType = "none" | "daily" | "weekly"

export interface WorkTimeEntry {
  id: string
  work_item_id: string
  employee_id: string
  org_id: string
  started_at: string
  ended_at?: string | null
  duration_minutes?: number | null
  created_at: string
}

export interface WorkAttachment {
  id: string
  work_item_id: string
  org_id: string
  uploaded_by: string
  kind: "file" | "link"
  file_name: string
  storage_path?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  url?: string | null
  created_at: string
  uploader?: Pick<Employee, "id" | "full_name">
}

export interface WorkItem {
  id: string
  reference: string
  org_id: string
  department_id?: string | null
  type: WorkType
  title: string
  description?: string
  status: WorkStatus
  priority: number
  body?: unknown
  assigned_to?: string | null
  created_by: string
  watchers: string[]
  due_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  estimate_hours?: number | null
  parent_id?: string | null
  linked_lead_id?: string | null
  requires_approval: boolean
  approval_id?: string | null
  recurrence: RecurrenceType
  recurrence_source_id?: string | null
  labels: string[]
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
  assignee?: Employee
  creator?: Employee
  department?: Department
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled"

export interface ApprovalStep {
  id: string
  approval_id: string
  step_number: number
  approver_id?: string | null
  approver_role?: string | null
  decision?: "approved" | "rejected" | null
  comment?: string | null
  decided_at?: string | null
  approver?: Employee
}

export interface Approval {
  id: string
  org_id: string
  subject_type: string
  subject_id?: string | null
  requested_by: string
  status: ApprovalStatus
  current_step: number
  created_at: string
  resolved_at?: string | null
  steps?: ApprovalStep[]
  requester?: Employee
}

export interface Employee {
  id: string
  auth_id: string
  org_id: string
  full_name: string
  email: string
  phone?: string
  designation: string
  department?: string
  date_of_joining: string
  is_admin: boolean
  is_active: boolean
  avatar_url?: string
  reports_to?: string | null
  role: EmployeeRole
  department_id?: string | null
  scope?: ScopeLevel
  created_at: string
}

export interface Organization {
  id: string
  name: string
  code: string
}

export interface Attendance {
  id: string
  employee_id: string
  date: string
  check_in: string
  check_out?: string
  check_in_lat?: number
  check_in_lng?: number
  check_in_address?: string
  check_out_lat?: number
  check_out_lng?: number
  check_out_address?: string
  status: "present" | "late" | "half_day" | "absent"
  work_hours?: number
  notes?: string
  created_at: string
  employee?: Employee
}

export interface LeaveBalance {
  id: string
  employee_id: string
  year: number
  casual_total: number
  casual_used: number
  sick_total: number
  sick_used: number
  earned_total: number
  earned_used: number
}

export interface LeaveRequest {
  id: string
  reference: string
  employee_id: string
  leave_type: "casual" | "sick" | "earned"
  start_date: string
  end_date: string
  reason: string
  status: "pending" | "approved" | "rejected"
  reviewed_by?: string
  review_notes?: string
  created_at: string
  employee?: Employee
}

export interface Task {
  id: string
  employee_id: string
  title: string
  description?: string
  status: "todo" | "in_progress" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  due_date?: string
  assigned_by?: string
  created_at: string
  employee?: Employee
}

export interface EodReport {
  id: string
  reference: string
  employee_id: string
  date: string
  tasks_completed: { title: string; status?: string }[]
  metrics?: Record<string, number>
  task_progress?: { work_item_id?: string; reference: string; title: string; type?: string; status: string }[]
  department?: string | null
  blockers?: string
  tomorrow_plan?: string
  review_status?: "pending" | "reviewed"
  reviewed_by?: string | null
  manager_comment?: string | null
  reviewed_at?: string | null
  created_at: string
  employee?: Employee
}

export interface Okr {
  id: string
  employee_id: string
  title: string
  description?: string
  quarter: string
  year: number
  progress: number
  status: "on_track" | "at_risk" | "behind" | "completed"
  created_at: string
  key_results?: KeyResult[]
  employee?: Employee
}

export interface KeyResult {
  id: string
  okr_id: string
  title: string
  target_value: number
  current_value: number
  unit?: string
}

export interface Feedback {
  id: string
  from_employee_id: string
  to_employee_id: string
  rating: number
  strengths: string
  improvements: string
  is_anonymous: boolean
  created_at: string
  from_employee?: Employee
  to_employee?: Employee
}

export interface Appraisal {
  id: string
  employee_id: string
  cycle: string
  self_rating?: number
  self_comments?: string
  manager_rating?: number
  manager_comments?: string
  status: "pending_self" | "pending_manager" | "completed"
  created_at: string
  employee?: Employee
}

export interface Payroll {
  id: string
  employee_id: string
  month: number
  year: number
  basic_salary: number
  hra: number
  allowances: number
  deductions: number
  net_salary: number
  status: "draft" | "pending" | "paid"
  razorpay_order_id?: string
  razorpay_payment_id?: string
  paid_at?: string
  created_at: string
  employee?: Employee
}

export interface Notification {
  id: string
  recipient_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  link?: string
  created_at: string
}

export interface Announcement {
  id: string
  org_id: string
  title: string
  content: string
  priority: "low" | "normal" | "high" | "urgent"
  is_pinned: boolean
  created_by: string
  created_at: string
  author?: Employee
}

// -- Activity Tracking --

export type SessionEndReason =
  | "manual"
  | "auto_eod"
  | "idle_timeout"
  | "page_close"
  | "admin_override"

export interface AttendanceSession {
  id: string
  employee_id: string
  org_id: string
  started_at: string
  ended_at?: string
  end_reason?: SessionEndReason
  start_lat?: number
  start_lng?: number
  start_address?: string
  end_lat?: number
  end_lng?: number
  end_address?: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface ActivityMinute {
  employee_id: string
  bucket: string
  session_id?: string
  created_at: string
}

export interface AttendanceDaily {
  id: string
  employee_id: string
  date: string
  active_minutes: number
  work_hours: number
  first_check_in?: string
  last_check_out?: string
  session_count: number
  utilisation: number
  status: "present" | "late" | "half_day" | "absent"
  computed_at: string
}

export interface TodayActivity {
  sessions: AttendanceSession[]
  openSession: AttendanceSession | null
  activeMinutes: number
  minuteBuckets: string[]
}

// -- Call Tracking --

export interface CallDevice {
  id: string
  employee_id: string
  org_id: string
  device_id: string
  device_name?: string | null
  os_version?: string | null
  app_version?: string | null
  last_heartbeat_at?: string | null
  is_active: boolean
  created_at: string
}

export type CallDirection = "inbound" | "outbound" | "missed"
export type CallIngestSource = "own_app" | "callyzer"

export interface CallLog {
  id: string
  org_id: string
  employee_id: string
  device_id: string
  client_number: string
  direction: CallDirection
  duration_seconds: number
  call_started_at: string
  ingest_source: CallIngestSource
  lead_id?: string | null
  created_at: string
}

export interface CallDaily {
  id: string
  org_id: string
  employee_id: string
  date: string
  total_calls: number
  inbound_calls: number
  outbound_calls: number
  missed_calls: number
  total_duration_seconds: number
  avg_duration_seconds: number
  first_call_at?: string | null
  last_call_at?: string | null
  calling_window_minutes: number
  unique_numbers: number
  connected_calls: number
  computed_at: string
}

// -- Leads --

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "site_visit"
  | "negotiation"
  | "won"
  | "lost"
  | "junk"

export type LeadSource =
  | "excel"
  | "website"
  | "referral"
  | "walkin"
  | "social"
  | "other"
  | "google_sheets"
  | "google_ads"
  | "meta_ads"
  | "linkedin"

export type LeadBatchStatus = "pending" | "validated" | "committed" | "failed"

export interface Lead {
  id: string
  org_id: string
  batch_id?: string
  full_name: string
  phone_e164: string
  phone_raw?: string
  email?: string
  project?: string
  budget_min?: number
  budget_max?: number
  budget_raw?: string
  city?: string
  source: LeadSource
  status: LeadStatus
  notes?: string
  assigned_to?: string
  assignment_state: "unassigned" | "pending_approval" | "assigned"
  pending_manager_id?: string | null
  source_label?: string | null
  source_sheet_id?: string | null
  category?: "hot" | "warm" | "cold" | null
  home_size?: string
  potential_commission?: number
  re_enquiry_count: number
  last_enquiry_at: string
  created_at: string
  updated_at: string
  assigned_employee?: Employee
}

export interface LeadActivity {
  id: string
  lead_id: string
  actor_id?: string | null
  type: "note" | "call" | "status_change" | "whatsapp"
  body?: string | null
  created_at: string
  actor?: { full_name?: string }
}

export interface LeadBatch {
  id: string
  org_id: string
  uploaded_by: string
  file_name: string
  file_hash: string
  storage_path?: string
  status: LeadBatchStatus
  total_rows: number
  valid_rows: number
  dupe_rows: number
  error_rows: number
  column_map: Record<string, string>
  created_at: string
  updated_at: string
  uploader?: Employee
}

export interface LeadBatchRow {
  id: string
  batch_id: string
  row_number: number
  raw_data: Record<string, unknown>
  parsed_data?: {
    full_name?: string
    phone_e164?: string
    email?: string
    project?: string
    budget_min?: number
    budget_max?: number
    budget_raw?: string
    city?: string
    source?: string
  }
  errors: { field: string; message: string }[]
  is_valid: boolean
  is_duplicate: boolean
  existing_lead_id?: string
  created_at: string
}

// -- Sheet Sync --

export interface LeadSourceSheet {
  id: string
  org_id: string
  label: string
  spreadsheet_id: string
  sheet_name: string
  header_row: number
  column_map: Record<string, string>
  is_active: boolean
  poll_interval_m: number
  last_synced_at?: string
  last_sync_row: number
  last_sync_error?: string
  is_syncing: boolean
  sync_started_at?: string
  webhook_secret?: string
  created_by: string
  created_at: string
  updated_at: string
}

export type SheetRowSyncStatus = "pending" | "synced" | "error" | "skipped"

export interface SheetRowSync {
  id: string
  source_id: string
  row_number: number
  row_hash: string
  status: SheetRowSyncStatus
  lead_id?: string
  raw_data?: Record<string, unknown>
  parsed_data?: Record<string, unknown>
  errors: { field: string; message: string }[]
  created_at: string
  updated_at: string
}

// -- Assignment Rules --

export type AssignmentStrategy = "round_robin" | "manual"

export interface AssignmentRule {
  id: string
  org_id: string
  label: string
  strategy: AssignmentStrategy
  pool_root_id?: string
  last_assigned_idx: number
  is_active: boolean
  source_filter: string[]
  created_at: string
  updated_at: string
}
