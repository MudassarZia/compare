import type { Scraper, ScrapedCandidate } from "./index"
import type { Region } from "~utils/url-patterns"
import { parsePrice } from "~utils/price-utils"
import { parseHTML } from "~utils/html-parser"
import { scanHtmlForProducts } from "~utils/html-scanner"
import { logger } from "~utils/logger"

const EBAY_DOMAINS: Record<Region, string> = {
  us: "www.ebay.com",
  ca: "www.ebay.ca",
  uk: "www.ebay.co.uk"
}

export const ebayScraper: Scraper = {
  key: "ebay",
  regions: ["us", "ca", "uk"],

  buildSearchUrl: (query: string, region: Region) => {
    const domain = EBAY_DOMAINS[region]
    return `https://${domain}/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_BIN=1`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const doc = parseHTML(html)
    const candidates: ScrapedCandidate[] = []

    const results = doc.querySelectorAll(".s-item, .srp-results .s-item__wrapper")

    for (const result of results) {
      if (candidates.length >= 5) break

      const title =
        result.querySelector(".s-item__title span")?.textContent?.trim() ??
        result.querySelector(".s-item__title")?.textContent?.trim() ??
        null
      if (!title || title === "Shop on eBay") continue

      const priceText = result.querySelector(".s-item__price")?.textContent ?? null
      let price: number | null = null
      let currency = "USD"
      if (priceText) {
        if (priceText.includes(" to ")) continue
        const parsed = parsePrice(priceText)
        if (parsed) { price = parsed.price; currency = parsed.currency }
      }
      if (price === null) continue

      const url = result.querySelector(".s-item__link")?.getAttribute("href") ?? ""
      const image = result.querySelector(".s-item__image-img")?.getAttribute("src") ?? null
      candidates.push({ title, price, currency, url, retailer: "ebay", image })
    }

    if (candidates.length > 0) return candidates

    // Regex fallback
    logger.debug("eBay DOM selectors matched nothing, trying fallback scan")
    const domain = EBAY_DOMAINS.us
    return scanHtmlForProducts(html, "ebay", domain).map((p) => ({
      ...p,
      retailer: "ebay" as const
    }))
  }
}
