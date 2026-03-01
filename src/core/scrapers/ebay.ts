import type { Scraper, ScrapedCandidate } from "./index"
import { parsePrice } from "~utils/price-utils"

export const ebayScraper: Scraper = {
  key: "ebay",

  buildSearchUrl: (query: string) => {
    // LH_BIN=1 filters to "Buy It Now" only (excludes auctions)
    return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_BIN=1`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const candidates: ScrapedCandidate[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    const results = doc.querySelectorAll(".s-item, .srp-results .s-item__wrapper")

    for (const result of results) {
      if (candidates.length >= 5) break

      const title =
        result.querySelector(".s-item__title span")?.textContent?.trim() ??
        result.querySelector(".s-item__title")?.textContent?.trim() ??
        null
      if (!title || title === "Shop on eBay") continue

      const priceText =
        result.querySelector(".s-item__price")?.textContent ??
        null

      let price: number | null = null
      let currency = "USD"
      if (priceText) {
        // Skip price ranges like "$10.00 to $20.00"
        if (priceText.includes(" to ")) continue
        const parsed = parsePrice(priceText)
        if (parsed) {
          price = parsed.price
          currency = parsed.currency
        }
      }
      if (price === null) continue

      const url = result.querySelector(".s-item__link")?.getAttribute("href") ?? ""
      const image = result.querySelector(".s-item__image-img")?.getAttribute("src") ?? null

      candidates.push({ title, price, currency, url, retailer: "ebay", image })
    }

    return candidates
  }
}
