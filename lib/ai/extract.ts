import { getSupabaseAdmin } from "@/lib/supabase/admin"

const EXTRACTION_PROMPT = `You are a real estate sales call analyst. Analyze this call transcript and extract structured data.

Return ONLY valid JSON with these fields:
{
  "lead_updates": {
    "budget_min": <number or null>,
    "budget_max": <number or null>,
    "configuration": "<string like 2BHK, 3BHK or null>",
    "preferred_locations": ["<location1>", "<location2>"],
    "purpose": "<end_use or investment or null>",
    "financing": "<loan or self_funded or undecided or null>",
    "possession_timeline": "<string or null>",
    "decision_makers": ["<person1>", "<person2>"]
  },
  "signals": {
    "intent": "<high, medium, low, or none>",
    "objections": ["<objection1>", "<objection2>"],
    "projects_discussed": [
      { "name": "<project>", "sentiment": "<positive, negative, neutral>" }
    ],
    "decision_stage": "<exploring, shortlisting, decided, undecided>"
  },
  "next_action": {
    "type": "<CALL_BACK, SEND_PROPERTIES, SCHEDULE_VISIT, SEND_DOCUMENT, FOLLOW_UP, NONE>",
    "description": "<what to do>",
    "due_hint": "<tomorrow, in 2 days, next week, etc or null>"
  },
  "promises": {
    "by_rep": ["<promise1>"],
    "by_customer": ["<promise1>"]
  },
  "summary": "<2-3 sentence summary of the call>",
  "confidence": <0.0 to 1.0>
}

Rules:
- If the conversation is in Hindi or Hinglish, still extract in English
- Only include fields you're confident about — use null for uncertain fields
- Confidence should reflect how clearly the information was stated
- Budget should be in the local currency (INR) as a number (e.g., 22000000 for 2.2 Cr)
- Do NOT invent information — only extract what was actually discussed`

export interface ExtractionResult {
  lead_updates: Record<string, unknown>
  signals: Record<string, unknown>
  next_action: { type: string; description: string; due_hint: string | null }
  promises: { by_rep: string[]; by_customer: string[] }
  summary: string
  confidence: number
}

/**
 * Extract structured data from a call transcript using LLM.
 * Stores result in ai_analyses table.
 */
export async function extractFromTranscript(
  callId: string,
  transcript: string,
  orgId: string
): Promise<ExtractionResult | null> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (!deepseekKey) {
    console.warn("extract: DEEPSEEK_API_KEY not set, skipping extraction")
    return null
  }

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: transcript },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      console.error("extract: DeepSeek failed", res.status, errBody)
      throw new Error(`DeepSeek API ${res.status}: ${errBody.slice(0, 200)}`)
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[]
      usage?: { total_tokens: number }
    }

    let content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("Empty content from DeepSeek")
    }

    // Strip markdown code fences if present (```json ... ```)
    content = content.trim()
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
    }

    let parsed: ExtractionResult
    try {
      parsed = JSON.parse(content) as ExtractionResult
    } catch (parseErr) {
      throw new Error(`JSON parse failed: ${(parseErr as Error).message} — content: ${content.slice(0, 300)}`
      )
    }

    // Validate basic structure
    if (!parsed.confidence || typeof parsed.confidence !== "number") {
      parsed.confidence = 0.5
    }

    // Store in ai_analyses
    const admin = getSupabaseAdmin()
    const { error: insertErr } = await admin.from("ai_analyses").insert({
      org_id: orgId,
      call_id: callId,
      lead_updates: parsed.lead_updates || null,
      signals: { ...parsed.signals, summary: parsed.summary, promises: parsed.promises } || null,
      next_actions: parsed.next_action || null,
      confidence: parsed.confidence,
      model_version: "deepseek-chat",
    })

    if (insertErr) {
      throw new Error(`ai_analyses insert failed: ${insertErr.message} (code: ${insertErr.code}, details: ${insertErr.details})`)
    }

    // Track usage
    const tokensUsed = data.usage?.total_tokens || 0
    if (tokensUsed > 0) {
      try {
        const period = new Date().toISOString().slice(0, 7) + "-01"
        await admin.rpc("increment_usage_meter", {
          p_org_id: orgId,
          p_period: period,
          p_field: "llm_tokens_used",
          p_value: tokensUsed,
        })
      } catch {}
    }

    return parsed
  } catch (err) {
    console.error("extract: error", err)
    throw err
  }
}
