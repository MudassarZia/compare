import type { Scraper, ScrapedCandidate } from "./index"
import type { Region } from "~utils/url-patterns"
import { parsePrice } from "~utils/price-utils"
import { parseHTML } from "~utils/html-parser"
import { scanHtmlForProducts } from "~utils/html-scanner"
import { logger } from "~utils/logger"

const NEWEGG_DOMAINS: Record<string, string> = {
  us: "www.newegg.com",
  ca: "www.newegg.ca"
}

export const neweggScraper: Scraper = {
  key: "newegg",
  regions: ["us", "ca"],

  buildSearchUrl: (query: string, region: Region) => {
    const domain = NEWEGG_DOMAINS[region] ?? NEWEGG_DOMAINS.us
    return `https://${domain}/p/pl?d=${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const doc = parseHTML(html)
    const candidates: ScrapedCandidate[] = []

    const results = doc.querySelectorAll(".item-cell, .item-container")

    for (const result of results) {
      if (candidates.length >= 5) break

      const title =
        result.querySelector(".item-title")?.textContent?.trim() ??
        result.querySelector("a.item-title")?.textContent?.trim() ??
        null
      if (!title) continue

      const dollars = result.querySelector(".price-current strong")?.textContent
      const cents = result.querySelector(".price-current sup")?.textContent
      let price: number | null = null
      let currency = "USD"
      if (dollars) {
        const parsed = parsePrice(`$${dollars}${cents || ""}`)
        if (parsed) { price = parsed.price; currency = parsed.currency }
      }
      if (price === null) {
        const priceEl = result.querySelector(".price-current")?.textContent
        if (priceEl) {
          const parsed = parsePrice(priceEl)
          if (parsed) { price = parsed.price; currency = parsed.currency }
        }
      }
      if (price === null) continue

      const href = result.querySelector(".item-title")?.getAttribute("href") ?? ""
      const domain = NEWEGG_DOMAINS.us
      const url = href.startsWith("http") ? href : `https://${domain}${href}`
      const image = result.querySelector(".item-img img")?.getAttribute("src") ?? null
      candidates.push({ title, price, currency, url, retailer: "newegg", image })
    }

    if (candidates.length > 0) return candidates

    logger.debug("Newegg DOM selectors matched nothing, trying fallback scan")
    return scanHtmlForProducts(html, "newegg", NEWEGG_DOMAINS.us).map((p) => ({
      ...p,
      retailer: "newegg" as const
    }))
  }
}
