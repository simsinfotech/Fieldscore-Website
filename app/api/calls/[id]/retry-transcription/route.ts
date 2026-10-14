import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { transcribeAndSummarize } from "@/lib/calls/transcribe"
import { extractFromTranscript } from "@/lib/ai/extract"
import { createAITasks } from "@/lib/ai/task-creator"
import { analyzeCoaching } from "@/lib/ai/coaching"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

// Allow up to 60s for the full AI pipeline
export const maxDuration = 60

/**
 * POST /api/calls/[id]/retry-transcription
 * Manually re-trigger the AI transcription pipeline for a specific call.
 * Admin only. Cleans up previous partial data and re-runs everything.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const logs: string[] = []

  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!caller.isAdmin && caller.role !== "admin" && caller.role !== "sales_admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const { id: callId } = await params
    const admin = getSupabaseAdmin()

    // Verify call exists and belongs to org
    const { data: callRow, error } = await admin
      .from("call_logs")
      .select("id, recording_url, org_id, lead_id, employee_id")
      .eq("id", callId)
      .eq("org_id", caller.orgId)
      .single()

    if (error || !callRow) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 })
    }

    if (!callRow.recording_url) {
      return NextResponse.json({ error: "No recording available for this call" }, { status: 400 })
    }

    // Clean up previous partial run
    await admin.from("call_transcripts").delete().eq("call_id", callId)
    await admin.from("ai_analyses").delete().eq("call_id", callId)
    await admin.from("call_logs").update({ transcript_id: null }).eq("id", callId)
    logs.push("Cleaned up old data")

    // Step 1: Run main transcription pipeline (transcript + summary + lead activity + push)
    await transcribeAndSummarize(callId)
    logs.push("transcribeAndSummarize done")

    // Check if transcript was created
    const { data: transcript } = await admin
      .from("call_transcripts")
      .select("id, raw_text")
      .eq("call_id", callId)
      .maybeSingle()

    if (!transcript) {
      logs.push("No transcript created — pipeline may have failed early")
      return NextResponse.json({ status: "partial", logs, results: { transcript: false, ai_analysis: false, task_created: false } })
    }
    logs.push("Transcript created: " + transcript.id)

    // Check if AI analysis was created by the pipeline
    const { data: existingAnalysis } = await admin
      .from("ai_analyses")
      .select("id")
      .eq("call_id", callId)
      .maybeSingle()

    if (existingAnalysis) {
      logs.push("AI analysis created by pipeline: " + existingAnalysis.id)
    } else {
      // Step 2: Manually run extraction if pipeline didn't do it
      logs.push("No AI analysis from pipeline — running extraction manually")
      try {
        const extraction = await extractFromTranscript(callId, transcript.raw_text, callRow.org_id)
        if (extraction) {
          logs.push("Extraction succeeded: intent=" + (extraction.signals?.intent ?? "n/a") + ", next_action=" + (extraction.next_action?.type ?? "NONE"))

          // Step 3: Create tasks if lead exists
          if (callRow.lead_id) {
            const taskId = await createAITasks(callId, callRow.lead_id, callRow.org_id, callRow.employee_id, extraction)
            logs.push(taskId ? "Task created: " + taskId : "No task created (dedup or no action)")
          } else {
            logs.push("No lead_id — skipping task creation")
          }
        } else {
          logs.push("Extraction returned null — check DEEPSEEK_API_KEY and API response")
          logs.push("DEEPSEEK_API_KEY set: " + (!!process.env.DEEPSEEK_API_KEY))
        }
      } catch (extErr: any) {
        logs.push("Extraction error: " + (extErr?.message || String(extErr)))
      }
    }

    // Final verification
    const { data: finalAnalysis } = await admin
      .from("ai_analyses")
      .select("id")
      .eq("call_id", callId)
      .maybeSingle()

    const { data: tasks } = await admin
      .from("work_items")
      .select("id, title")
      .contains("labels", ["ai-generated"])
      .order("created_at", { ascending: false })
      .limit(1)

    return NextResponse.json({
      status: "ok",
      message: "Pipeline completed",
      logs,
      results: {
        transcript: true,
        ai_analysis: !!finalAnalysis,
        task_created: tasks && tasks.length > 0,
      },
    })
  } catch (err: any) {
    console.error("retry-transcription error:", err)
    logs.push("Fatal error: " + (err?.message || String(err)))
    return NextResponse.json(
      { error: err?.message || "Transcription failed", logs },
      { status: 500 },
    )
  }
}
