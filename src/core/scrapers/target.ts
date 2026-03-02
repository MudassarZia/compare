import type { Scraper, ScrapedCandidate } from "./index"
import type { Region } from "~utils/url-patterns"
import { parsePrice } from "~utils/price-utils"
import { parseHTML } from "~utils/html-parser"
import { scanHtmlForProducts } from "~utils/html-scanner"
import { logger } from "~utils/logger"

export const targetScraper: Scraper = {
  key: "target",
  regions: ["us"],

  buildSearchUrl: (query: string, _region: Region) => {
    return `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const doc = parseHTML(html)
    const candidates: ScrapedCandidate[] = []

    const results = doc.querySelectorAll("[data-test='product-grid'] li, [data-test='@web/ProductCard']")

    for (const result of results) {
      if (candidates.length >= 5) break

      const title =
        result.querySelector("[data-test='product-title']")?.textContent?.trim() ??
        result.querySelector("a[data-test='product-title']")?.textContent?.trim() ??
        result.querySelector("h3")?.textContent?.trim() ??
        null
      if (!title) continue

      const priceText =
        result.querySelector("[data-test='current-price'] span")?.textContent ??
        result.querySelector(".styles__StyledPricePromoWrapper span")?.textContent ??
        null
      let price: number | null = null
      let currency = "USD"
      if (priceText) {
        const parsed = parsePrice(priceText)
        if (parsed) { price = parsed.price; currency = parsed.currency }
      }
      if (price === null) continue

      const href = result.querySelector("a")?.getAttribute("href") ?? ""
      const url = href.startsWith("http") ? href : `https://www.target.com${href}`
      const image = result.querySelector("img")?.getAttribute("src") ?? null
      candidates.push({ title, price, currency, url, retailer: "target", image })
    }

    if (candidates.length > 0) return candidates

    logger.debug("Target DOM selectors matched nothing, trying fallback scan")
    return scanHtmlForProducts(html, "target", "www.target.com").map((p) => ({
      ...p,
      retailer: "target" as const
    }))
  }
}
