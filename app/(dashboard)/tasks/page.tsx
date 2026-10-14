import { redirect } from "next/navigation"

// The standalone Tasks board was merged into the unified Work board. This
// route stays as a permanent redirect so old bookmarks and existing
// "task_assigned" notification links (which point at /tasks) still work.
export default function TasksPage() {
  redirect("/work")
}
