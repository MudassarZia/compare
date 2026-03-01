import type { Scraper, ScrapedCandidate } from "./index"
import { parsePrice } from "~utils/price-utils"

export const neweggScraper: Scraper = {
  key: "newegg",

  buildSearchUrl: (query: string) => {
    return `https://www.newegg.com/p/pl?d=${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const candidates: ScrapedCandidate[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    const results = doc.querySelectorAll(".item-cell, .item-container")

    for (const result of results) {
      if (candidates.length >= 5) break

      const title =
        result.querySelector(".item-title")?.textContent?.trim() ??
        result.querySelector("a.item-title")?.textContent?.trim() ??
        null
      if (!title) continue

      // Newegg splits price: .price-current strong (dollars) + sup (cents)
      const dollars = result.querySelector(".price-current strong")?.textContent
      const cents = result.querySelector(".price-current sup")?.textContent

      let price: number | null = null
      let currency = "USD"
      if (dollars) {
        const priceStr = `$${dollars}${cents || ""}`
        const parsed = parsePrice(priceStr)
        if (parsed) {
          price = parsed.price
          currency = parsed.currency
        }
      }

      // Fallback
      if (price === null) {
        const priceEl = result.querySelector(".price-current")?.textContent
        if (priceEl) {
          const parsed = parsePrice(priceEl)
          if (parsed) {
            price = parsed.price
            currency = parsed.currency
          }
        }
      }
      if (price === null) continue

      const href = result.querySelector(".item-title")?.getAttribute("href") ?? ""
      const url = href.startsWith("http") ? href : `https://www.newegg.com${href}`
      const image = result.querySelector(".item-img img")?.getAttribute("src") ?? null

      candidates.push({ title, price, currency, url, retailer: "newegg", image })
    }

    return candidates
  }
}
