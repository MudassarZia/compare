import type { Scraper, ScrapedCandidate } from "./index"
import type { Region } from "~utils/url-patterns"
import { parsePrice } from "~utils/price-utils"
import { parseHTML } from "~utils/html-parser"
import { scanHtmlForProducts } from "~utils/html-scanner"
import { logger } from "~utils/logger"

const WALMART_DOMAINS: Record<string, string> = {
  us: "www.walmart.com",
  ca: "www.walmart.ca"
}

export const walmartScraper: Scraper = {
  key: "walmart",
  regions: ["us", "ca"],

  buildSearchUrl: (query: string, region: Region) => {
    const domain = WALMART_DOMAINS[region] ?? WALMART_DOMAINS.us
    return `https://${domain}/search?q=${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    logger.debug(`Walmart HTML size: ${html.length}, first 200 chars: ${html.slice(0, 200).replace(/\n/g, ' ')}`)

    const doc = parseHTML(html)
    const canonical = doc.querySelector("link[rel='canonical']")?.getAttribute("href") ?? ""
    const baseDomain = canonical.includes("walmart.ca") ? "www.walmart.ca" : "www.walmart.com"
    const isCanada = baseDomain.includes(".ca")

    const candidates: ScrapedCandidate[] = []

    // Try __NEXT_DATA__ first
    const nextDataEl = doc.querySelector("#__NEXT_DATA__")
    if (nextDataEl?.textContent) {
      try {
        const data = JSON.parse(nextDataEl.textContent)
        // Try multiple paths where Walmart stores search results
        const itemPaths = [
          data?.props?.pageProps?.initialData?.searchResult?.itemStacks?.[0]?.items,
          data?.props?.pageProps?.initialSearchResult?.itemStacks?.[0]?.items,
          data?.props?.pageProps?.searchResult?.itemStacks?.[0]?.items,
        ]
        for (const items of itemPaths) {
          if (!Array.isArray(items)) continue
          for (const item of items) {
            if (candidates.length >= 5) break
            if (!item.name || !item.price) continue
            candidates.push({
              title: item.name,
              price: item.price,
              currency: isCanada ? "CAD" : "USD",
              url: `https://${baseDomain}${item.canonicalUrl || `/ip/${item.id}`}`,
              retailer: "walmart",
              image: item.image || null
            })
          }
          if (candidates.length > 0) return candidates
        }
        logger.debug("Walmart __NEXT_DATA__ found but no matching item paths")
      } catch {
        logger.debug("Walmart __NEXT_DATA__ parse failed")
      }
    } else {
      logger.debug("Walmart: no __NEXT_DATA__ element found")
    }

    // Try embedded state objects (some Walmart pages use these instead)
    const statePatterns = [
      /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/,
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/,
    ]
    for (const pattern of statePatterns) {
      const stateMatch = html.match(pattern)
      if (!stateMatch) continue
      try {
        const state = JSON.parse(stateMatch[1])
        const items = state?.search?.searchResult?.itemStacks?.[0]?.items
          ?? state?.searchContent?.searchResult?.itemStacks?.[0]?.items
        if (!Array.isArray(items)) continue
        for (const item of items) {
          if (candidates.length >= 5) break
          if (!item.name || !item.price) continue
          candidates.push({
            title: item.name,
            price: item.price,
            currency: isCanada ? "CAD" : "USD",
            url: `https://${baseDomain}${item.canonicalUrl || `/ip/${item.id}`}`,
            retailer: "walmart",
            image: item.image || null
          })
        }
        if (candidates.length > 0) return candidates
      } catch {
        // continue
      }
    }

    // DOM fallback
    const results = doc.querySelectorAll('[data-testid="list-view"] [data-item-id], .search-result-gridview-item')
    for (const result of results) {
      if (candidates.length >= 5) break
      const title = result.querySelector("[data-automation-id='product-title']")?.textContent?.trim()
        ?? result.querySelector("a span")?.textContent?.trim()
        ?? null
      if (!title) continue

      const priceEl = result.querySelector("[data-automation-id='product-price'] .f2")?.textContent
        ?? result.querySelector(".price-main .visuallyhidden")?.textContent
        ?? null
      let price: number | null = null
      let currency = "USD"
      if (priceEl) {
        const parsed = parsePrice(priceEl)
        if (parsed) { price = parsed.price; currency = parsed.currency }
      }
      if (price === null) continue

      const href = result.querySelector("a")?.getAttribute("href") ?? ""
      const url = href.startsWith("http") ? href : `https://${baseDomain}${href}`
      const image = result.querySelector("img")?.getAttribute("src") ?? null
      candidates.push({ title, price, currency, url, retailer: "walmart", image })
    }

    if (candidates.length > 0) return candidates

    // Regex fallback
    logger.debug("Walmart: __NEXT_DATA__ and DOM selectors failed, trying fallback scan")
    const scanned = scanHtmlForProducts(html, "walmart", baseDomain)
    logger.debug(`Walmart fallback scan found ${scanned.length} results`)
    return scanned.map((p) => ({
      ...p,
      currency: isCanada ? "CAD" : "USD",
      retailer: "walmart" as const
    }))
  }
}
