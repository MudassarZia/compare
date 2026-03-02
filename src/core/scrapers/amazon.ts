import type { Scraper, ScrapedCandidate } from "./index"
import type { Region } from "~utils/url-patterns"
import { parsePrice } from "~utils/price-utils"
import { parseHTML } from "~utils/html-parser"
import { scanHtmlForProducts } from "~utils/html-scanner"
import { logger } from "~utils/logger"

const AMAZON_DOMAINS: Record<Region, string> = {
  us: "www.amazon.com",
  ca: "www.amazon.ca",
  uk: "www.amazon.co.uk"
}

export const amazonScraper: Scraper = {
  key: "amazon",
  regions: ["us", "ca", "uk"],

  buildSearchUrl: (query: string, region: Region) => {
    const domain = AMAZON_DOMAINS[region]
    return `https://${domain}/s?k=${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const doc = parseHTML(html)

    // Detect domain from page
    const canonical = doc.querySelector("link[rel='canonical']")?.getAttribute("href") ?? ""
    const domain = canonical.includes("amazon.ca") ? "www.amazon.ca"
      : canonical.includes("amazon.co.uk") ? "www.amazon.co.uk"
      : "www.amazon.com"

    const candidates: ScrapedCandidate[] = []
    const results = doc.querySelectorAll('[data-component-type="s-search-result"]')

    for (const result of results) {
      if (candidates.length >= 5) break
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

      const href = result.querySelector("h2 a")?.getAttribute("href") ?? ""
      const url = href.startsWith("http") ? href : `https://${domain}${href}`
      const image = result.querySelector(".s-image")?.getAttribute("src") ?? null

      candidates.push({ title, price, currency, url, retailer: "amazon", image })
    }

    if (candidates.length > 0) return candidates

    // Fallback: regex scan
    logger.debug("Amazon DOM selectors matched nothing, trying fallback scan")
    return scanHtmlForProducts(html, "amazon", domain).map((p) => ({
      ...p,
      retailer: "amazon" as const
    }))
  }
}
