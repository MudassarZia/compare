import type { Scraper, ScrapedCandidate } from "./index"
import { parsePrice } from "~utils/price-utils"

export const walmartScraper: Scraper = {
  key: "walmart",

  buildSearchUrl: (query: string) => {
    return `https://www.walmart.com/search?q=${encodeURIComponent(query)}`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const candidates: ScrapedCandidate[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Try to extract from __NEXT_DATA__
    const nextDataEl = doc.querySelector("#__NEXT_DATA__")
    if (nextDataEl?.textContent) {
      try {
        const data = JSON.parse(nextDataEl.textContent)
        const items = data?.props?.pageProps?.initialData?.searchResult?.itemStacks?.[0]?.items
        if (Array.isArray(items)) {
          for (const item of items) {
            if (candidates.length >= 5) break
            if (!item.name || !item.price) continue
            candidates.push({
              title: item.name,
              price: item.price,
              currency: "USD",
              url: `https://www.walmart.com${item.canonicalUrl || `/ip/${item.id}`}`,
              retailer: "walmart",
              image: item.image || null
            })
          }
          return candidates
        }
      } catch {
        // fall through to DOM
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
        if (parsed) {
          price = parsed.price
          currency = parsed.currency
        }
      }
      if (price === null) continue

      const href = result.querySelector("a")?.getAttribute("href") ?? ""
      const url = href.startsWith("http") ? href : `https://www.walmart.com${href}`
      const image = result.querySelector("img")?.getAttribute("src") ?? null

      candidates.push({ title, price, currency, url, retailer: "walmart", image })
    }

    return candidates
  }
}
