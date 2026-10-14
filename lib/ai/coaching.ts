import { getSupabaseAdmin } from "@/lib/supabase/admin"

const COACHING_PROMPT = `You are a real estate sales coaching analyst. Analyze this sales call transcript and score the salesperson's performance across 8 dimensions.

Return ONLY valid JSON:
{
  "scores": {
    "opening": { "score": <1-10>, "evidence": "<brief quote or observation>" },
    "discovery": { "score": <1-10>, "evidence": "<did they ask about budget, timeline, location, configuration?>" },
    "listening": { "score": <1-10>, "evidence": "<talk ratio, interruptions, acknowledgments>" },
    "objection_handling": { "score": <1-10>, "evidence": "<how were objections addressed?>" },
    "product_fit": { "score": <1-10>, "evidence": "<did they match properties to needs?>" },
    "next_step_commitment": { "score": <1-10>, "evidence": "<did they secure a clear next step?>" },
    "followup_quality": { "score": <1-10>, "evidence": "<did they reference previous conversations?>" },
    "compliance": { "score": <1-10>, "evidence": "<proper greeting, no misleading claims>" }
  },
  "talk_ratio": {
    "rep_pct": <0-100>,
    "customer_pct": <0-100>
  },
  "missed_opportunities": ["<thing they should have asked/done>"],
  "strengths": ["<thing they did well>"],
  "overall_recommendation": "<1-2 sentence coaching recommendation>"
}

Rules:
- Be specific with evidence — quote or reference actual parts of the conversation
- Score 1-3 = poor, 4-6 = average, 7-8 = good, 9-10 = excellent
- For Hindi/Hinglish conversations, still write analysis in English
- Focus on actionable, constructive feedback
- Do NOT give all high scores unless genuinely warranted`

export interface CoachingResult {
  scores: Record<string, { score: number; evidence: string }>
  talk_ratio: { rep_pct: number; customer_pct: number }
  missed_opportunities: string[]
  strengths: string[]
  overall_recommendation: string
}

/**
 * Analyze a call transcript for coaching insights.
 * Scores 8 dimensions with evidence.
 * Stores result in ai_analyses.coaching JSONB.
 */
export async function analyzeCoaching(
  callId: string,
  transcript: string,
  orgId: string
): Promise<CoachingResult | null> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (!deepseekKey) {
    console.warn("coaching: DEEPSEEK_API_KEY not set")
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
          { role: "system", content: COACHING_PROMPT },
          { role: "user", content: transcript },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    })

    if (!res.ok) {
      console.error("coaching: DeepSeek failed", res.status)
      return null
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[]
      usage?: { total_tokens: number }
    }

    let content = data.choices?.[0]?.message?.content
    if (!content) return null

    // Strip markdown code fences if present (```json ... ```)
    content = content.trim()
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
    }

    const parsed = JSON.parse(content) as CoachingResult

    // Store coaching scores in ai_analyses
    const admin = getSupabaseAdmin()

    // Build flat scores object for JSONB storage
    const flatScores: Record<string, number> = {}
    if (parsed.scores) {
      for (const [dim, val] of Object.entries(parsed.scores)) {
        flatScores[dim] = val.score
      }
    }

    // Update existing ai_analyses row for this call, or create new one
    const { data: existing } = await admin
      .from("ai_analyses")
      .select("id")
      .eq("call_id", callId)
      .maybeSingle()

    const coachingData = {
      ...flatScores,
      talk_ratio: parsed.talk_ratio,
      missed_opportunities: parsed.missed_opportunities,
      strengths: parsed.strengths,
      overall_recommendation: parsed.overall_recommendation,
      detailed_scores: parsed.scores,
    }

    if (existing) {
      await admin
        .from("ai_analyses")
        .update({ coaching_scores: coachingData })
        .eq("id", existing.id)
    } else {
      await admin.from("ai_analyses").insert({
        org_id: orgId,
        call_id: callId,
        coaching_scores: coachingData,
        model_version: "deepseek-chat",
      })
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
    console.error("coaching: error", err)
    return null
  }
}
