import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { notifyCallTranscript } from "@/lib/push/send-push"
import { extractFromTranscript } from "@/lib/ai/extract"
import { applyCrmUpdates } from "@/lib/ai/crm-updater"
import { createAITasks } from "@/lib/ai/task-creator"
import { analyzeCoaching } from "@/lib/ai/coaching"
import { fireTrigger } from "@/lib/workflows/engine"

/**
 * Full pipeline: download recording → Groq Whisper transcription → DeepSeek summary
 * → save to call_transcripts → create lead_activities note → push notification.
 *
 * Designed to be called fire-and-forget from the telephony webhook.
 */
export async function transcribeAndSummarize(callId: string): Promise<void> {
  const admin = getSupabaseAdmin()

  // 1. Fetch the call_logs row
  const { data: callRow, error: callErr } = await admin
    .from("call_logs")
    .select("id, recording_url, lead_id, employee_id, org_id")
    .eq("id", callId)
    .single()

  if (callErr || !callRow) {
    console.error("transcribe: call not found", callId, callErr)
    return
  }

  if (!callRow.recording_url) {
    console.warn("transcribe: no recording_url for call", callId)
    return
  }

  // 2. Download audio — branch on Supabase storage vs provider
  let audioBlob: Blob

  if (callRow.recording_url.startsWith("supabase://")) {
    // Manual upload: download from Supabase storage
    const withoutPrefix = callRow.recording_url.replace("supabase://", "")
    const slashIdx = withoutPrefix.indexOf("/")
    const bucket = withoutPrefix.slice(0, slashIdx)
    const path = withoutPrefix.slice(slashIdx + 1)

    const { data: fileData, error: dlErr } = await admin.storage
      .from(bucket)
      .download(path)

    if (dlErr || !fileData) {
      console.error("transcribe: failed to download from storage", dlErr)
      return
    }

    audioBlob = fileData
  } else {
    // Provider recording: download with Basic Auth
    const { data: config } = await admin
      .from("fs_telephony_config")
      .select("provider, api_key, api_token, auth_id, auth_token")
      .eq("org_id", callRow.org_id)
      .eq("is_active", true)
      .maybeSingle()

    if (!config) {
      console.error("transcribe: no fs_telephony_config for org", callRow.org_id)
      return
    }

    // Build credentials based on provider
    const authUser = config.provider === "plivo" ? (config.auth_id || config.api_key) : config.api_key
    const authPass = config.provider === "plivo" ? (config.auth_token || config.api_token) : config.api_token
    const basicAuth = Buffer.from(
      `${authUser}:${authPass}`,
    ).toString("base64")

    const audioRes = await fetch(callRow.recording_url, {
      headers: { Authorization: `Basic ${basicAuth}` },
    })

    if (!audioRes.ok) {
      console.error(
        "transcribe: failed to download recording",
        audioRes.status,
        callRow.recording_url,
      )
      return
    }

    const audioBuffer = await audioRes.arrayBuffer()
    audioBlob = new Blob([audioBuffer], { type: "audio/mp3" })
  }

  // 4. Send audio to Groq Whisper API
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    console.error("transcribe: GROQ_API_KEY not set")
    return
  }

  const formData = new FormData()
  formData.append("file", audioBlob, "recording.mp3")
  formData.append("model", "whisper-large-v3-turbo")

  const whisperRes = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: formData,
    },
  )

  if (!whisperRes.ok) {
    const errText = await whisperRes.text().catch(() => "")
    console.error("transcribe: Groq Whisper failed", whisperRes.status, errText)
    return
  }

  const whisperData = (await whisperRes.json()) as { text: string }
  const rawText = whisperData.text?.trim()

  if (!rawText) {
    console.warn("transcribe: empty transcript for call", callId)
    return
  }

  // 5. Send transcript to DeepSeek for summary
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  let summary: string | null = null

  if (deepseekKey) {
    try {
      const summaryRes = await fetch(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${deepseekKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content:
                  "You are a sales call analyst. Summarize the following call transcript in 2-3 concise lines. Mention key points: client interest, objections, commitments, and next steps. If the conversation is in Hindi or mixed Hindi-English, still write the summary in English.",
              },
              { role: "user", content: rawText },
            ],
            max_tokens: 300,
            temperature: 0.3,
          }),
        },
      )

      if (summaryRes.ok) {
        const summaryData = (await summaryRes.json()) as {
          choices: { message: { content: string } }[]
        }
        summary = summaryData.choices?.[0]?.message?.content?.trim() || null
      } else {
        console.error("transcribe: DeepSeek failed", summaryRes.status)
      }
    } catch (err) {
      console.error("transcribe: DeepSeek error", err)
    }
  }

  // 6. Insert into call_transcripts
  const modelVersion = `whisper-large-v3-turbo${deepseekKey ? "+deepseek-chat" : ""}`

  const { data: transcript, error: insertErr } = await admin
    .from("call_transcripts")
    .insert({
      call_id: callId,
      raw_text: rawText,
      summary,
      model_version: modelVersion,
    })
    .select("id")
    .single()

  if (insertErr) {
    console.error("transcribe: failed to insert transcript", insertErr)
    return
  }

  // 7. Update call_logs.transcript_id
  await admin
    .from("call_logs")
    .update({ transcript_id: transcript.id })
    .eq("id", callId)

  // 8. Create lead_activities note if lead exists
  const activityBody = summary || rawText.slice(0, 500)
  const leadId = callRow.lead_id

  if (leadId) {
    await admin.from("lead_activities").insert({
      lead_id: leadId,
      actor_id: callRow.employee_id,
      type: "call",
      body: `AI Call Summary: ${activityBody}`,
    })
  }

  // 9. Send push notification to admins/managers
  // Fetch lead name for the notification
  let leadName = "Unknown"
  if (leadId) {
    const { data: lead } = await admin
      .from("leads")
      .select("full_name")
      .eq("id", leadId)
      .maybeSingle()
    if (lead?.full_name) leadName = lead.full_name
  }

  await notifyCallTranscript(
    admin,
    callRow.org_id,
    callRow.employee_id,
    leadName,
    activityBody,
    leadId,
  ).catch((err) => {
    console.error("transcribe: push notification failed", err)
  })

  // 10. AI Extraction — extract structured data from transcript
  let extraction = null
  try {
    extraction = await extractFromTranscript(
      callId,
      rawText,
      callRow.org_id
    )
  } catch (extErr) {
    console.error("transcribe: extraction failed", extErr)
  }

  // 11. CRM Auto-Updater — apply extraction to lead
  if (extraction && leadId) {
    const { autoUpdated, suggested } = await applyCrmUpdates(
      callId,
      leadId,
      callRow.org_id,
      callRow.employee_id,
      extraction
    )
    console.log("transcribe: CRM updates —", { autoUpdated, suggested })

    // 12. Task Creator — create follow-up tasks from AI
    await createAITasks(
      callId,
      leadId,
      callRow.org_id,
      callRow.employee_id,
      extraction
    )

    // Fire ai_high_intent workflow trigger
    const intent = extraction.signals?.intent as string | undefined
    if (intent === "high") {
      fireTrigger({
        orgId: callRow.org_id,
        trigger: "ai_high_intent",
        entityType: "lead",
        entityId: leadId,
        data: {
          call_id: callId,
          confidence: extraction.confidence,
          intent,
          objections: extraction.signals?.objections || [],
        },
        actorId: callRow.employee_id,
      }).catch((err) => console.error("workflow: ai_high_intent trigger failed", err))
    }
  }

  // 13. Coaching Analysis — separate LLM call for call quality
  await analyzeCoaching(callId, rawText, callRow.org_id).catch((err) => {
    console.error("transcribe: coaching analysis failed", err)
  })

  // 14. Update recording status to 'processed' if recording exists
  const { data: recording } = await admin
    .from("recordings")
    .select("id")
    .eq("call_id", callId)
    .maybeSingle()

  if (recording) {
    await admin
      .from("recordings")
      .update({ status: "processed" })
      .eq("id", recording.id)

    await admin
      .from("call_logs")
      .update({ recording_status: "processed" })
      .eq("id", callId)

    // Fire recording_processed workflow trigger
    if (leadId) {
      fireTrigger({
        orgId: callRow.org_id,
        trigger: "recording_processed",
        entityType: "lead",
        entityId: leadId,
        data: {
          call_id: callId,
          recording_id: recording.id,
          has_transcript: true,
          has_extraction: !!extraction,
        },
        actorId: callRow.employee_id,
      }).catch((err) => console.error("workflow: recording_processed trigger failed", err))
    }
  }

  console.log("transcribe: full pipeline completed for call", callId)
}
