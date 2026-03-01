import type { ProductData } from "~types/product"
import type { ScrapedCandidate } from "~core/scrapers"

export const SYSTEM_PROMPT = `You are a product matching assistant. Given a source product and a list of candidates, determine which candidates are the SAME product (same brand, model, specs). Return JSON.

Rules:
- Only match products that are genuinely the same item (same brand + model + key specs)
- Set confidence 0.0-1.0 (1.0 = exact match, 0.5 = likely match, below 0.3 = skip)
- Exclude accessories, cases, or different variants
- For electronics: model number must match
- Return empty matches array if no candidates match`

export function buildUserPrompt(
  source: ProductData,
  candidates: ScrapedCandidate[]
): string {
  const sourceDesc = `SOURCE: "${source.title}" ${source.brand ? `(${source.brand})` : ""} ${source.price ? `$${source.price}` : ""}`

  const candidateLines = candidates
    .slice(0, 10) // limit to reduce tokens
    .map((c, i) => `${i}: "${c.title}" $${c.price} [${c.retailer}]`)
    .join("\n")

  return `${sourceDesc}

CANDIDATES:
${candidateLines}

Return JSON: {"matches":[{"index":0,"confidence":0.9,"reasoning":"same model"}]}`
}

export interface AiMatchResult {
  matches: Array<{
    index: number
    confidence: number
    reasoning: string
  }>
}
