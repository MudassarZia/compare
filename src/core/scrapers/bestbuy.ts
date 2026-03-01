import type { Scraper, ScrapedCandidate } from "./index"
import { parsePrice } from "~utils/price-utils"

export const bestbuyScraper: Scraper = {
  key: "bestbuy",

  buildSearchUrl: (query: string) => {
    return `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const candidates: ScrapedCandidate[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    const results = doc.querySelectorAll(".sku-item, .list-item")

    for (const result of results) {
      if (candidates.length >= 5) break

      const title =
        result.querySelector(".sku-title a")?.textContent?.trim() ??
        result.querySelector("h4.sku-title")?.textContent?.trim() ??
        null
      if (!title) continue

      const priceText =
        result.querySelector(".priceView-customer-price span")?.textContent ??
        result.querySelector("[data-testid='customer-price'] span")?.textContent ??
        null

      let price: number | null = null
      let currency = "USD"
      if (priceText) {
        const parsed = parsePrice(priceText)
        if (parsed) {
          price = parsed.price
          currency = parsed.currency
        }
      }
      if (price === null) continue

      const href = result.querySelector(".sku-title a")?.getAttribute("href") ?? ""
      const url = href.startsWith("http") ? href : `https://www.bestbuy.com${href}`
      const image = result.querySelector(".product-image img")?.getAttribute("src") ?? null

      candidates.push({ title, price, currency, url, retailer: "bestbuy", image })
    }

    return candidates
  }
}
