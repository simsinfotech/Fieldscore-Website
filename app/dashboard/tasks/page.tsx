"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  ChevronDown,
  Calendar,
  User,
  Flag,
  X,
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  List,
} from "lucide-react";
import { tasks, priorityColors, taskStatusColors, taskStatusLabels, type TaskStatus, type Priority } from "@/lib/mock-data";

const STATUS_COLUMNS: { status: TaskStatus; icon: React.ElementType; color: string }[] = [
  { status: "todo", icon: CheckSquare, color: "text-slate-400" },
  { status: "in_progress", icon: Clock, color: "text-blue-600" },
  { status: "review", icon: AlertTriangle, color: "text-violet-600" },
  { status: "done", icon: CheckCircle2, color: "text-emerald-600" },
  { status: "blocked", icon: XCircle, color: "text-red-600" },
];

export default function TasksPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTasks = tasks.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.lead_name?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Tasks</h1>
          <p className="text-brand-dim text-sm mt-1">{tasks.length} total tasks &middot; {tasks.filter(t => t.status === "done").length} completed</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-brand-surface border border-brand-border rounded-xl p-0.5">
            <button
              onClick={() => setView("board")}
              className={`p-2 rounded-lg transition-colors ${view === "board" ? "bg-brand-card text-brand-text shadow-soft" : "text-brand-dim"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 rounded-lg transition-colors ${view === "list" ? "bg-brand-card text-brand-text shadow-soft" : "text-brand-dim"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 !py-2.5 rounded-xl text-sm">
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks..."
          className="input-field !pl-10"
        />
      </div>

      {/* Board View */}
      {view === "board" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
          {STATUS_COLUMNS.map((col) => {
            const columnTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="bg-brand-surface rounded-2xl p-3 border border-brand-border/50 min-w-[240px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <col.icon className={`w-4 h-4 ${col.color}`} />
                    <span className="text-sm font-bold text-brand-text">{taskStatusLabels[col.status]}</span>
                  </div>
                  <span className="text-xs text-brand-dim bg-brand-card px-2 py-0.5 rounded-full shadow-sm">{columnTasks.length}</span>
                </div>
                <div className="space-y-2.5">
                  {columnTasks.map((task) => (
                    <div key={task.id} className="bg-brand-card border border-brand-border rounded-2xl p-4 hover:border-cyan-500/20 transition-colors cursor-pointer shadow-soft">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-brand-text leading-snug">{task.title}</p>
                        <span className={`badge text-[10px] shrink-0 ${priorityColors[task.priority]}`}>{task.priority}</span>
                      </div>
                      {task.lead_name && (
                        <p className="text-xs text-brand-dim mb-2 flex items-center gap-1">
                          <User className="w-3 h-3" /> {task.lead_name}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[11px] text-brand-dim flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(task.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[9px] font-bold text-white">
                          {task.assigned_to.split(" ").map(n => n[0]).join("")}
                        </div>
                      </div>
                    </div>
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="text-center py-6 text-brand-dim text-xs">No tasks</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-soft">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Lead</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="cursor-pointer">
                  <td>
                    <p className="font-semibold text-sm text-brand-text">{task.title}</p>
                    <p className="text-xs text-brand-dim mt-0.5 line-clamp-1">{task.description}</p>
                  </td>
                  <td><span className={`badge text-[10px] ${taskStatusColors[task.status]}`}>{taskStatusLabels[task.status]}</span></td>
                  <td><span className={`badge text-[10px] ${priorityColors[task.priority]}`}>{task.priority}</span></td>
                  <td><span className="text-sm text-brand-dim">{task.assigned_to}</span></td>
                  <td><span className="text-sm text-brand-dim">{new Date(task.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></td>
                  <td><span className="text-sm text-brand-dim">{task.lead_name || "--"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-brand-card border border-brand-border rounded-2xl w-full max-w-md p-6 shadow-elevated">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-brand-text">New Task</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-brand-dim hover:text-brand-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowAddModal(false); }}>
              <div>
                <label className="block text-sm font-medium text-brand-dim mb-1.5">Title</label>
                <input type="text" placeholder="Task title" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dim mb-1.5">Description</label>
                <textarea placeholder="Task description..." className="input-field min-h-[80px] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Priority</label>
                  <select className="input-field">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dim mb-1.5">Due Date</label>
                  <input type="date" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dim mb-1.5">Assign To</label>
                <select className="input-field">
                  <option>Arjun Patel</option>
                  <option>Meera Singh</option>
                  <option>Deepak Joshi</option>
                  <option>Nisha Gupta</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 btn-secondary !py-2.5 rounded-xl text-sm">Cancel</button>
                <button type="submit" className="flex-1 btn-primary !py-2.5 rounded-xl text-sm">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
