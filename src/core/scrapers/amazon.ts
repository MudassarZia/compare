import type { Scraper, ScrapedCandidate } from "./index"
import { parsePrice } from "~utils/price-utils"

export const amazonScraper: Scraper = {
  key: "amazon",

  buildSearchUrl: (query: string) => {
    return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const candidates: ScrapedCandidate[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    const results = doc.querySelectorAll('[data-component-type="s-search-result"]')

    for (const result of results) {
      if (candidates.length >= 5) break

      // Skip sponsored results
      if (result.querySelector(".puis-sponsored-label-text")) continue

      const title =
        result.querySelector("h2 a span")?.textContent?.trim() ??
        result.querySelector("h2 span")?.textContent?.trim() ??
        null
      if (!title) continue

      const priceEl =
        result.querySelector(".a-price .a-offscreen")?.textContent ??
        result.querySelector(".a-price-whole")?.textContent ??
        null

      let price: number | null = null
      let currency = "USD"
      if (priceEl) {
        const parsed = parsePrice(priceEl)
        if (parsed) {
          price = parsed.price
          currency = parsed.currency
        }
      }
      if (price === null) continue

      const linkEl = result.querySelector("h2 a")
      const href = linkEl?.getAttribute("href") ?? ""
      const url = href.startsWith("http") ? href : `https://www.amazon.com${href}`

      const image = result.querySelector(".s-image")?.getAttribute("src") ?? null

      candidates.push({ title, price, currency, url, retailer: "amazon", image })
    }

    return candidates
  }
}
