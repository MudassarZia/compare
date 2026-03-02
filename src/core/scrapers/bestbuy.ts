import type { Scraper, ScrapedCandidate } from "./index"
import type { Region } from "~utils/url-patterns"
import { parsePrice } from "~utils/price-utils"
import { parseHTML } from "~utils/html-parser"
import { scanHtmlForProducts } from "~utils/html-scanner"
import { logger } from "~utils/logger"

const BESTBUY_SEARCH: Record<string, string> = {
  us: "https://www.bestbuy.com/site/searchpage.jsp?st=",
  ca: "https://www.bestbuy.ca/en-ca/search?search="
}

const BESTBUY_BASE: Record<string, string> = {
  us: "www.bestbuy.com",
  ca: "www.bestbuy.ca"
}

export const bestbuyScraper: Scraper = {
  key: "bestbuy",
  regions: ["us", "ca"],

  buildSearchUrl: (query: string, region: Region) => {
    const base = BESTBUY_SEARCH[region] ?? BESTBUY_SEARCH.us
    return `${base}${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const doc = parseHTML(html)
    const canonical = doc.querySelector("link[rel='canonical']")?.getAttribute("href") ?? ""
    const region = canonical.includes("bestbuy.ca") ? "ca" : "us"
    const baseDomain = BESTBUY_BASE[region]

    const candidates: ScrapedCandidate[] = []
    const results = doc.querySelectorAll(".sku-item, .list-item, .productLine")

    for (const result of results) {
      if (candidates.length >= 5) break

      const title =
        result.querySelector(".sku-title a")?.textContent?.trim() ??
        result.querySelector("h4.sku-title")?.textContent?.trim() ??
        result.querySelector("[itemprop='name']")?.textContent?.trim() ??
        null
      if (!title) continue

      const priceText =
        result.querySelector(".priceView-customer-price span")?.textContent ??
        result.querySelector("[data-testid='customer-price'] span")?.textContent ??
        result.querySelector(".price_FHDfG")?.textContent ??
        null
      let price: number | null = null
      let currency = "USD"
      if (priceText) {
        const parsed = parsePrice(priceText)
        if (parsed) { price = parsed.price; currency = parsed.currency }
      }
      if (price === null) continue

      const href =
        result.querySelector(".sku-title a")?.getAttribute("href") ??
        result.querySelector("a[itemprop='url']")?.getAttribute("href") ?? ""
      const url = href.startsWith("http") ? href : `https://${baseDomain}${href}`
      const image = result.querySelector(".product-image img, img[itemprop='image']")?.getAttribute("src") ?? null
      candidates.push({ title, price, currency, url, retailer: "bestbuy", image })
    }

    if (candidates.length > 0) return candidates

    logger.debug("Best Buy DOM selectors matched nothing, trying fallback scan")
    return scanHtmlForProducts(html, "bestbuy", baseDomain).map((p) => ({
      ...p,
      retailer: "bestbuy" as const
    }))
  }
}
