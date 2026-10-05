// ============================================================
// MOCK DATA - Demo data reflecting the FieldScore mobile app
// ============================================================

export const stats = {
  totalLeads: 1247,
  activeLeads: 389,
  wonDeals: 67,
  revenue: 4250000,
  conversionRate: 18.4,
  avgDealSize: 63433,
  teamSize: 24,
  checkedIn: 19,
  totalCalls: 3892,
  siteVisits: 156,
  tasksCompleted: 423,
  tasksOverdue: 12,
};

export type LeadStatus = "new" | "contacted" | "qualified" | "site_visit" | "negotiation" | "won" | "lost";
export type LeadCategory = "hot" | "warm" | "cold";
export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";

export interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  category: LeadCategory;
  source: string;
  project: string;
  budget_min: number;
  budget_max: number;
  assigned_to: string;
  created_at: string;
  last_activity: string;
  notes: string;
  starred: boolean;
}

export interface PipelineStage {
  id: LeadStatus;
  label: string;
  count: number;
  value: number;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  assigned_to: string;
  due_at: string;
  lead_name?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_initial: string;
  checked_in: boolean;
  check_in_time?: string;
  active_minutes: number;
  leads_count: number;
  deals_won: number;
  calls_today: number;
}

export interface AttendanceRecord {
  date: string;
  check_in: string;
  check_out: string;
  active_minutes: number;
  status: "present" | "late" | "absent" | "half-day" | "leave";
  sessions: number;
}

export interface Property {
  id: string;
  name: string;
  developer: string;
  location: string;
  price_min: number;
  price_max: number;
  config: string;
  rera_id: string;
  status: "available" | "limited" | "sold_out";
  image: string;
  units_available: number;
  total_units: number;
}

export interface CallRecord {
  id: string;
  lead_name: string;
  phone: string;
  direction: "inbound" | "outbound" | "missed";
  duration: number;
  timestamp: string;
  recording?: boolean;
  notes?: string;
}

export interface Notification {
  id: string;
  type: "lead" | "visit" | "call" | "deal" | "task" | "system";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// ---- LEADS ----
export const leads: Lead[] = [
  { id: "1", full_name: "Rajesh Kumar", email: "rajesh@email.com", phone: "+91 98765 43210", status: "qualified", category: "hot", source: "Website", project: "Prestige Lakeside", budget_min: 8500000, budget_max: 12000000, assigned_to: "Arjun Patel", created_at: "2026-09-15", last_activity: "2 hours ago", notes: "Interested in 3BHK, east facing. Visited sample flat.", starred: true },
  { id: "2", full_name: "Priya Sharma", email: "priya.s@email.com", phone: "+91 87654 32109", status: "site_visit", category: "hot", source: "Referral", project: "Brigade Gateway", budget_min: 15000000, budget_max: 20000000, assigned_to: "Meera Singh", created_at: "2026-09-20", last_activity: "5 hours ago", notes: "CEO of tech startup. Looking for premium property.", starred: true },
  { id: "3", full_name: "Amit Verma", email: "amit.v@email.com", phone: "+91 76543 21098", status: "new", category: "warm", source: "MagicBricks", project: "Sobha Dream Acres", budget_min: 5000000, budget_max: 7500000, assigned_to: "Unassigned", created_at: "2026-10-01", last_activity: "1 day ago", notes: "First-time buyer, needs financing guidance.", starred: false },
  { id: "4", full_name: "Sneha Reddy", email: "sneha.r@email.com", phone: "+91 65432 10987", status: "negotiation", category: "hot", source: "99acres", project: "Prestige Lakeside", budget_min: 9500000, budget_max: 11000000, assigned_to: "Arjun Patel", created_at: "2026-08-28", last_activity: "3 hours ago", notes: "Negotiating on 4BHK penthouse. Close to deal.", starred: true },
  { id: "5", full_name: "Vikram Singh", email: "vikram@email.com", phone: "+91 54321 09876", status: "contacted", category: "warm", source: "Facebook Ads", project: "Brigade Gateway", budget_min: 12000000, budget_max: 18000000, assigned_to: "Deepak Joshi", created_at: "2026-09-25", last_activity: "6 hours ago", notes: "NRI based in Dubai. Will visit next month.", starred: false },
  { id: "6", full_name: "Ananya Iyer", email: "ananya.i@email.com", phone: "+91 43210 98765", status: "won", category: "hot", source: "Walk-in", project: "Sobha Dream Acres", budget_min: 6200000, budget_max: 6200000, assigned_to: "Meera Singh", created_at: "2026-07-10", last_activity: "1 week ago", notes: "Booked 2BHK. Payment plan finalized.", starred: false },
  { id: "7", full_name: "Karthik Nair", email: "karthik.n@email.com", phone: "+91 32109 87654", status: "lost", category: "cold", source: "Google Ads", project: "Prestige Lakeside", budget_min: 7000000, budget_max: 9000000, assigned_to: "Arjun Patel", created_at: "2026-08-05", last_activity: "2 weeks ago", notes: "Went with competitor. Budget mismatch.", starred: false },
  { id: "8", full_name: "Divya Menon", email: "divya.m@email.com", phone: "+91 21098 76543", status: "qualified", category: "warm", source: "Instagram", project: "Phoenix One", budget_min: 20000000, budget_max: 35000000, assigned_to: "Deepak Joshi", created_at: "2026-09-18", last_activity: "4 hours ago", notes: "Looking for luxury villa. Very specific requirements.", starred: true },
  { id: "9", full_name: "Suresh Pillai", email: "suresh.p@email.com", phone: "+91 10987 65432", status: "new", category: "cold", source: "Housing.com", project: "Sobha Dream Acres", budget_min: 4500000, budget_max: 5500000, assigned_to: "Unassigned", created_at: "2026-10-03", last_activity: "2 days ago", notes: "Enquiry from website. No response yet.", starred: false },
  { id: "10", full_name: "Lakshmi Rao", email: "lakshmi.r@email.com", phone: "+91 09876 54321", status: "contacted", category: "warm", source: "Referral", project: "Brigade Gateway", budget_min: 10000000, budget_max: 14000000, assigned_to: "Meera Singh", created_at: "2026-09-22", last_activity: "1 day ago", notes: "Referred by Ananya. Interested in 3BHK premium.", starred: false },
];

// ---- PIPELINE ----
export const pipeline: PipelineStage[] = [
  { id: "new", label: "New", count: 142, value: 85200000, color: "#00E5FF" },
  { id: "contacted", label: "Contacted", count: 98, value: 112700000, color: "#3B82F6" },
  { id: "qualified", label: "Qualified", count: 67, value: 95400000, color: "#0D9488" },
  { id: "site_visit", label: "Site Visit", count: 45, value: 78900000, color: "#F59E0B" },
  { id: "negotiation", label: "Negotiation", count: 28, value: 62300000, color: "#A855F7" },
  { id: "won", label: "Won", count: 67, value: 425000000, color: "#22C55E" },
];

// ---- TASKS ----
export const tasks: Task[] = [
  { id: "1", title: "Follow up with Rajesh Kumar", description: "Call regarding 3BHK preference and schedule second site visit", priority: "high", status: "todo", assigned_to: "Arjun Patel", due_at: "2026-10-06", lead_name: "Rajesh Kumar", created_at: "2026-10-04" },
  { id: "2", title: "Send price quotation to Priya Sharma", description: "Prepare and email detailed price sheet for Brigade Gateway premium units", priority: "urgent", status: "in_progress", assigned_to: "Meera Singh", due_at: "2026-10-05", lead_name: "Priya Sharma", created_at: "2026-10-03" },
  { id: "3", title: "Schedule site visit for Vikram Singh", description: "Coordinate with site team for NRI client visit next month", priority: "medium", status: "todo", assigned_to: "Deepak Joshi", due_at: "2026-10-15", lead_name: "Vikram Singh", created_at: "2026-10-01" },
  { id: "4", title: "Prepare closing documents for Sneha Reddy", description: "Coordinate with legal team for agreement preparation", priority: "urgent", status: "in_progress", assigned_to: "Arjun Patel", due_at: "2026-10-05", lead_name: "Sneha Reddy", created_at: "2026-10-02" },
  { id: "5", title: "Update CRM data for Q3 leads", description: "Audit and update all lead records from last quarter", priority: "low", status: "todo", assigned_to: "Deepak Joshi", due_at: "2026-10-10", created_at: "2026-10-01" },
  { id: "6", title: "Review Divya Menon villa requirements", description: "Match luxury villa listings with client specifications", priority: "high", status: "review", assigned_to: "Deepak Joshi", due_at: "2026-10-07", lead_name: "Divya Menon", created_at: "2026-10-03" },
  { id: "7", title: "Send welcome kit to Ananya Iyer", description: "Prepare and courier welcome package for new buyer", priority: "medium", status: "done", assigned_to: "Meera Singh", due_at: "2026-10-04", lead_name: "Ananya Iyer", created_at: "2026-09-30" },
  { id: "8", title: "Team training on new CRM features", description: "Conduct training session for the sales team on latest updates", priority: "medium", status: "blocked", assigned_to: "Arjun Patel", due_at: "2026-10-08", created_at: "2026-10-01" },
];

// ---- TEAM ----
export const teamMembers: TeamMember[] = [
  { id: "1", name: "Arjun Patel", email: "arjun@fieldscore.io", role: "Sales Manager", avatar_initial: "AP", checked_in: true, check_in_time: "09:15 AM", active_minutes: 342, leads_count: 45, deals_won: 12, calls_today: 18 },
  { id: "2", name: "Meera Singh", email: "meera@fieldscore.io", role: "Senior Sales", avatar_initial: "MS", checked_in: true, check_in_time: "09:05 AM", active_minutes: 356, leads_count: 38, deals_won: 15, calls_today: 22 },
  { id: "3", name: "Deepak Joshi", email: "deepak@fieldscore.io", role: "Sales Executive", avatar_initial: "DJ", checked_in: true, check_in_time: "09:28 AM", active_minutes: 310, leads_count: 52, deals_won: 8, calls_today: 14 },
  { id: "4", name: "Nisha Gupta", email: "nisha@fieldscore.io", role: "Sales Executive", avatar_initial: "NG", checked_in: true, check_in_time: "09:10 AM", active_minutes: 348, leads_count: 41, deals_won: 10, calls_today: 16 },
  { id: "5", name: "Rohan Mehta", email: "rohan@fieldscore.io", role: "Junior Sales", avatar_initial: "RM", checked_in: false, active_minutes: 0, leads_count: 28, deals_won: 3, calls_today: 0 },
  { id: "6", name: "Kavitha Rajan", email: "kavitha@fieldscore.io", role: "Sales Executive", avatar_initial: "KR", checked_in: true, check_in_time: "09:32 AM", active_minutes: 298, leads_count: 35, deals_won: 9, calls_today: 11 },
  { id: "7", name: "Sameer Khan", email: "sameer@fieldscore.io", role: "Junior Sales", avatar_initial: "SK", checked_in: true, check_in_time: "09:45 AM", active_minutes: 275, leads_count: 22, deals_won: 4, calls_today: 8 },
  { id: "8", name: "Pooja Nair", email: "pooja@fieldscore.io", role: "Sales Setter", avatar_initial: "PN", checked_in: true, check_in_time: "09:20 AM", active_minutes: 330, leads_count: 60, deals_won: 0, calls_today: 32 },
];

// ---- ATTENDANCE ----
export const attendance: AttendanceRecord[] = [
  { date: "2026-10-05", check_in: "09:15 AM", check_out: "--", active_minutes: 342, status: "present", sessions: 1 },
  { date: "2026-10-04", check_in: "09:08 AM", check_out: "06:45 PM", active_minutes: 540, status: "present", sessions: 2 },
  { date: "2026-10-03", check_in: "09:35 AM", check_out: "06:30 PM", active_minutes: 510, status: "late", sessions: 1 },
  { date: "2026-10-02", check_in: "09:12 AM", check_out: "06:50 PM", active_minutes: 555, status: "present", sessions: 2 },
  { date: "2026-10-01", check_in: "09:05 AM", check_out: "06:40 PM", active_minutes: 548, status: "present", sessions: 1 },
  { date: "2026-09-30", check_in: "09:20 AM", check_out: "01:00 PM", active_minutes: 220, status: "half-day", sessions: 1 },
  { date: "2026-09-29", check_in: "--", check_out: "--", active_minutes: 0, status: "leave", sessions: 0 },
  { date: "2026-09-28", check_in: "--", check_out: "--", active_minutes: 0, status: "absent", sessions: 0 },
  { date: "2026-09-27", check_in: "09:10 AM", check_out: "07:00 PM", active_minutes: 570, status: "present", sessions: 2 },
  { date: "2026-09-26", check_in: "09:00 AM", check_out: "06:35 PM", active_minutes: 535, status: "present", sessions: 1 },
];

// ---- PROPERTIES ----
export const properties: Property[] = [
  { id: "1", name: "Prestige Lakeside", developer: "Prestige Group", location: "Whitefield, Bangalore", price_min: 8500000, price_max: 25000000, config: "2, 3, 4 BHK", rera_id: "PRM/KA/RERA/1251/310/PR/200520/003587", status: "available", image: "/property-1.jpg", units_available: 45, total_units: 200 },
  { id: "2", name: "Brigade Gateway", developer: "Brigade Group", location: "Rajajinagar, Bangalore", price_min: 12000000, price_max: 35000000, config: "3, 4 BHK + Penthouse", rera_id: "PRM/KA/RERA/1251/310/PR/190815/002841", status: "limited", image: "/property-2.jpg", units_available: 12, total_units: 150 },
  { id: "3", name: "Sobha Dream Acres", developer: "Sobha Limited", location: "Panathur, Bangalore", price_min: 4500000, price_max: 8000000, config: "1, 2, 3 BHK", rera_id: "PRM/KA/RERA/1251/310/PR/171015/001243", status: "available", image: "/property-3.jpg", units_available: 89, total_units: 400 },
  { id: "4", name: "Phoenix One", developer: "Phoenix Group", location: "Rajajinagar, Bangalore", price_min: 20000000, price_max: 50000000, config: "4 BHK Villa + Penthouse", rera_id: "PRM/KA/RERA/1251/310/PR/210301/004102", status: "limited", image: "/property-4.jpg", units_available: 8, total_units: 50 },
];

// ---- CALLS ----
export const calls: CallRecord[] = [
  { id: "1", lead_name: "Rajesh Kumar", phone: "+91 98765 43210", direction: "outbound", duration: 245, timestamp: "2026-10-05 11:30 AM", recording: true, notes: "Discussed 3BHK options" },
  { id: "2", lead_name: "Priya Sharma", phone: "+91 87654 32109", direction: "inbound", duration: 180, timestamp: "2026-10-05 10:45 AM", recording: true, notes: "Asked about payment plans" },
  { id: "3", lead_name: "Amit Verma", phone: "+91 76543 21098", direction: "outbound", duration: 0, timestamp: "2026-10-05 10:15 AM", recording: false, notes: "No answer" },
  { id: "4", lead_name: "Sneha Reddy", phone: "+91 65432 10987", direction: "outbound", duration: 420, timestamp: "2026-10-05 09:50 AM", recording: true, notes: "Price negotiation discussion" },
  { id: "5", lead_name: "Vikram Singh", phone: "+91 54321 09876", direction: "missed", duration: 0, timestamp: "2026-10-05 09:30 AM" },
  { id: "6", lead_name: "Divya Menon", phone: "+91 21098 76543", direction: "outbound", duration: 310, timestamp: "2026-10-04 04:30 PM", recording: true, notes: "Villa specifications discussed" },
  { id: "7", lead_name: "Lakshmi Rao", phone: "+91 09876 54321", direction: "inbound", duration: 150, timestamp: "2026-10-04 03:15 PM", recording: false, notes: "General enquiry" },
  { id: "8", lead_name: "Suresh Pillai", phone: "+91 10987 65432", direction: "outbound", duration: 95, timestamp: "2026-10-04 02:00 PM", recording: true },
];

// ---- NOTIFICATIONS ----
export const notifications: Notification[] = [
  { id: "1", type: "lead", title: "New Lead Assigned", message: "Amit Verma has been assigned to you from MagicBricks", timestamp: "2 hours ago", read: false },
  { id: "2", type: "visit", title: "Site Visit Scheduled", message: "Priya Sharma - Brigade Gateway tomorrow at 11:00 AM", timestamp: "3 hours ago", read: false },
  { id: "3", type: "deal", title: "Deal Won!", message: "Ananya Iyer has booked 2BHK at Sobha Dream Acres", timestamp: "1 day ago", read: true },
  { id: "4", type: "task", title: "Task Overdue", message: "Follow up with Rajesh Kumar was due yesterday", timestamp: "1 day ago", read: false },
  { id: "5", type: "call", title: "Missed Call", message: "Vikram Singh tried to reach you at 9:30 AM", timestamp: "5 hours ago", read: true },
  { id: "6", type: "system", title: "Weekly Report Ready", message: "Your performance report for this week is available", timestamp: "2 days ago", read: true },
];

// ---- HELPERS ----
export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toString();
}

export function formatDuration(seconds: number): string {
  if (seconds === 0) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const statusColors: Record<LeadStatus, string> = {
  new: "bg-cyan-500/15 text-cyan-400",
  contacted: "bg-blue-500/15 text-blue-400",
  qualified: "bg-teal-500/15 text-teal-400",
  site_visit: "bg-amber-500/15 text-amber-400",
  negotiation: "bg-violet-500/15 text-violet-400",
  won: "bg-emerald-500/15 text-emerald-400",
  lost: "bg-red-500/15 text-red-400",
};

export const statusLabels: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  site_visit: "Site Visit",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const priorityColors: Record<Priority, string> = {
  low: "bg-blue-500/15 text-blue-400",
  medium: "bg-amber-500/15 text-amber-400",
  high: "bg-orange-500/15 text-orange-400",
  urgent: "bg-red-500/15 text-red-400",
};

export const taskStatusColors: Record<TaskStatus, string> = {
  todo: "bg-slate-500/15 text-slate-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  review: "bg-violet-500/15 text-violet-400",
  done: "bg-emerald-500/15 text-emerald-400",
  blocked: "bg-red-500/15 text-red-400",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};
