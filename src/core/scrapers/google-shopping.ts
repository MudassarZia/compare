import type { Scraper, ScrapedCandidate } from "./index"
import { parsePrice } from "~utils/price-utils"

export const googleShoppingScraper: Scraper = {
  key: "google-shopping",

  buildSearchUrl: (query: string) => {
    const encoded = encodeURIComponent(query)
    return `https://www.google.com/search?tbm=shop&q=${encoded}&hl=en`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    const candidates: ScrapedCandidate[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Google Shopping results typically appear in divs with class "sh-dgr__gr-auto" or similar
    // The structure changes frequently, so we try multiple selectors
    const resultSelectors = [
      ".sh-dgr__gr-auto",
      ".sh-dlr__list-result",
      "[data-docid]",
      ".sh-pr__product-results-grid .sh-pr__product-result"
    ]

    let resultEls: NodeListOf<Element> | null = null
    for (const selector of resultSelectors) {
      const els = doc.querySelectorAll(selector)
      if (els.length > 0) {
        resultEls = els
        break
      }
    }

    if (!resultEls) {
      // Fallback: try to extract from any elements with price patterns
      return extractFromGenericElements(doc)
    }

    for (const el of resultEls) {
      if (candidates.length >= 10) break

      const title =
        el.querySelector("h3")?.textContent?.trim() ??
        el.querySelector("h4")?.textContent?.trim() ??
        el.querySelector("[role='heading']")?.textContent?.trim() ??
        null
      if (!title) continue

      // Look for price elements
      const priceEl =
        el.querySelector(".sh-dgr__content .a8Pemb")?.textContent ??
        el.querySelector("[aria-label*='$']")?.textContent ??
        el.querySelector("span")?.textContent ??
        null

      let price: number | null = null
      let currency = "USD"

      // Try all spans for price-like patterns
      if (!priceEl || !parsePrice(priceEl)) {
        for (const span of el.querySelectorAll("span, b")) {
          const text = span.textContent?.trim() || ""
          if (/^\$[\d,.]+$/.test(text) || /^[\d,.]+\s*(USD|EUR|GBP)$/.test(text)) {
            const parsed = parsePrice(text)
            if (parsed) {
              price = parsed.price
              currency = parsed.currency
              break
            }
          }
        }
      } else {
        const parsed = parsePrice(priceEl)
        if (parsed) {
          price = parsed.price
          currency = parsed.currency
        }
      }

      if (price === null) continue

      // Try to find the store/retailer name
      const storeEl =
        el.querySelector(".sh-dgr__store-name")?.textContent?.trim() ??
        el.querySelector(".aULzUe")?.textContent?.trim() ??
        el.querySelector(".E5ocAb")?.textContent?.trim() ??
        null

      // Try to get the link
      const link = el.querySelector("a")?.getAttribute("href") ?? null
      const fullUrl = link
        ? link.startsWith("http")
          ? link
          : `https://www.google.com${link}`
        : ""

      const image = el.querySelector("img")?.getAttribute("src") ?? null

      const retailer = detectRetailerFromStore(storeEl, fullUrl)

      candidates.push({
        title,
        price,
        currency,
        url: fullUrl,
        retailer,
        image
      })
    }

    return candidates
  }
}

function extractFromGenericElements(doc: Document): ScrapedCandidate[] {
  const candidates: ScrapedCandidate[] = []

  // Try a broader approach: find elements that contain both a title-like heading and a price
  const allLinks = doc.querySelectorAll("a[href*='/shopping/product/'], a[href*='tbm=shop']")

  for (const link of allLinks) {
    if (candidates.length >= 10) break
    const container = link.closest("div") || link
    const title = container.querySelector("h3, h4, [role='heading']")?.textContent?.trim()
    if (!title) continue

    for (const span of container.querySelectorAll("span, b")) {
      const text = span.textContent?.trim() || ""
      const parsed = parsePrice(text)
      if (parsed && parsed.price > 0 && parsed.price < 100000) {
        candidates.push({
          title,
          price: parsed.price,
          currency: parsed.currency,
          url: (link as HTMLAnchorElement).href || "",
          retailer: "unknown",
          image: container.querySelector("img")?.getAttribute("src") ?? null
        })
        break
      }
    }
  }

  return candidates
}

function detectRetailerFromStore(store: string | null, url: string): ScrapedCandidate["retailer"] {
  const text = (store || "").toLowerCase() + " " + url.toLowerCase()
  if (text.includes("amazon")) return "amazon"
  if (text.includes("walmart")) return "walmart"
  if (text.includes("target")) return "target"
  if (text.includes("best buy") || text.includes("bestbuy")) return "bestbuy"
  if (text.includes("ebay")) return "ebay"
  if (text.includes("newegg")) return "newegg"
  return "unknown"
}
