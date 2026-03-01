import type { CompetitorPrice, ProductData } from "~types/product"
import type { ScrapedCandidate } from "~core/scrapers"
import { SYSTEM_PROMPT, buildUserPrompt, type AiMatchResult } from "./prompts"
import { aiRateLimiter } from "./rate-limiter"
import { logger } from "~utils/logger"

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

// Free model fallback chain
const MODEL_CHAIN = [
  "qwen/qwen3-235b-a22b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free"
]

function getApiKey(): string | null {
  return process.env.PLASMO_PUBLIC_OPENROUTER_API_KEY || null
}

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error("OpenRouter API key not configured")

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "chrome-extension://compare",
      "X-Title": "Compare Price Extension"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" }
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenRouter ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ""
}

export async function matchProducts(
  source: ProductData,
  candidates: ScrapedCandidate[]
): Promise<CompetitorPrice[]> {
  if (candidates.length === 0) return []

  const userPrompt = buildUserPrompt(source, candidates)

  let lastError: Error | null = null

  for (const model of MODEL_CHAIN) {
    try {
      logger.info(`Trying AI model: ${model}`)
      aiRateLimiter.record()

      const responseText = await callOpenRouter(model, SYSTEM_PROMPT, userPrompt)
      const result = parseAiResponse(responseText)

      return result.matches
        .filter((m) => m.confidence >= 0.3 && m.index >= 0 && m.index < candidates.length)
        .map((m) => {
          const candidate = candidates[m.index]
          return {
            title: candidate.title,
            price: candidate.price,
            currency: candidate.currency,
            url: candidate.url,
            retailer: candidate.retailer,
            image: candidate.image,
            matchConfidence: m.confidence,
            matchReasoning: m.reasoning
          }
        })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn(`Model ${model} failed:`, lastError.message)
    }
  }

  throw lastError ?? new Error("All AI models failed")
}

function parseAiResponse(text: string): AiMatchResult {
  try {
    // Try direct parse
    const parsed = JSON.parse(text)
    if (parsed.matches && Array.isArray(parsed.matches)) {
      return parsed as AiMatchResult
    }
    return { matches: [] }
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1])
      if (parsed.matches && Array.isArray(parsed.matches)) {
        return parsed as AiMatchResult
      }
    }
    logger.warn("Could not parse AI response:", text)
    return { matches: [] }
  }
}
