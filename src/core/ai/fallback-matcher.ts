import type { CompetitorPrice, ProductData } from "~types/product"
import type { ScrapedCandidate } from "~core/scrapers"

const MIN_SIMILARITY = 0.3

/** Jaccard word similarity fallback when AI is unavailable */
export function fallbackMatch(
  source: ProductData,
  candidates: ScrapedCandidate[]
): CompetitorPrice[] {
  const sourceWords = tokenize(source.title)

  return candidates
    .map((candidate) => {
      const candidateWords = tokenize(candidate.title)
      const similarity = jaccardSimilarity(sourceWords, candidateWords)

      return {
        title: candidate.title,
        price: candidate.price,
        currency: candidate.currency,
        url: candidate.url,
        retailer: candidate.retailer,
        image: candidate.image,
        matchConfidence: similarity,
        matchReasoning: `Word similarity: ${Math.round(similarity * 100)}%`
      }
    })
    .filter((m) => m.matchConfidence >= MIN_SIMILARITY)
    .sort((a, b) => b.matchConfidence - a.matchConfidence)
    .slice(0, 10)
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
      // Skip common noise words
      .filter(
        (w) =>
          !["the", "a", "an", "and", "or", "for", "with", "in", "on", "by", "from", "new", "free", "shipping"].includes(w)
      )
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const word of a) {
    if (b.has(word)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}
