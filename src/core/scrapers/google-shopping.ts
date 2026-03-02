import type { Scraper, ScrapedCandidate } from "./index"
import type { Region } from "~utils/url-patterns"
import { parsePrice } from "~utils/price-utils"
import { parseHTML } from "~utils/html-parser"
import { scanGoogleShoppingHtml } from "~utils/html-scanner"
import { logger } from "~utils/logger"

const GOOGLE_DOMAINS: Record<Region, string> = {
  us: "www.google.com",
  ca: "www.google.ca",
  uk: "www.google.co.uk"
}

export const googleShoppingScraper: Scraper = {
  key: "google-shopping",
  regions: ["us", "ca", "uk"],

  buildSearchUrl: (query: string, region: Region) => {
    const domain = GOOGLE_DOMAINS[region]
    const encoded = encodeURIComponent(query)
    // ucbcb=1 helps bypass consent pages; gl sets country; num limits results
    const gl = region === "uk" ? "gb" : region
    return `https://${domain}/search?tbm=shop&q=${encoded}&hl=en&gl=${gl}&ucbcb=1&num=10`
  },

  parseSearchResults: (html: string): ScrapedCandidate[] => {
    logger.debug(`Google Shopping HTML size: ${html.length}, first 200 chars: ${html.slice(0, 200).replace(/\n/g, ' ')}`)

    // Try CSS selectors first
    const domResults = parseDom(html)
    if (domResults.length > 0) {
      logger.debug(`Google Shopping DOM parser found ${domResults.length} results`)
      return domResults
    }

    // Fallback: scan embedded JSON data in the HTML
    logger.debug("Google Shopping DOM selectors matched nothing, trying JSON scan")
    const scanned = scanGoogleShoppingHtml(html, 10)
    if (scanned.length > 0) {
      logger.debug(`Google Shopping JSON scan found ${scanned.length} results`)
    } else {
      logger.warn(`Google Shopping: 0 results from both DOM and JSON scan (HTML ${html.length} bytes)`)
    }
    return scanned.map((p) => ({
      title: p.title,
      price: p.price,
      currency: p.currency,
      url: p.url,
      retailer: "unknown" as const,
      image: p.image
    }))
  }
}

function parseDom(html: string): ScrapedCandidate[] {
  const candidates: ScrapedCandidate[] = []
  const doc = parseHTML(html)

  // Check for consent/redirect pages
  const bodyText = doc.querySelector("body")?.textContent ?? ""
  if (bodyText.includes("Before you continue") || bodyText.includes("consent.google")) {
    logger.warn("Google Shopping returned a consent page")
    return []
  }

  const resultSelectors = [
    ".sh-dgr__gr-auto",
    ".sh-dlr__list-result",
    "[data-docid]",
    ".sh-pr__product-results-grid .sh-pr__product-result",
    ".sh-np__click-target",
    // Broader fallback selectors
    "[data-ved] .sh-dgr__content",
    ".commercial-unit-desktop-rhs .pla-unit",
    ".mnr-c.pla-unit"
  ]

  let resultEls: ReturnType<typeof doc.querySelectorAll> | null = null
  for (const selector of resultSelectors) {
    try {
      const els = doc.querySelectorAll(selector)
      if (els.length > 0) {
        resultEls = els
        logger.debug(`Google Shopping matched selector: ${selector} (${els.length} elements)`)
        break
      }
    } catch {
      // node-html-parser may not support all selectors
    }
  }

  if (!resultEls) {
    logger.debug("Google Shopping: no DOM selectors matched")
    return []
  }

  for (const el of resultEls) {
    if (candidates.length >= 10) break

    const title =
      el.querySelector("h3")?.textContent?.trim() ??
      el.querySelector("h4")?.textContent?.trim() ??
      el.querySelector("[role='heading']")?.textContent?.trim() ??
      el.querySelector("a[aria-label]")?.getAttribute("aria-label")?.trim() ??
      null
    if (!title) continue

    let price: number | null = null
    let currency = "USD"

    // Search all text-containing elements for price patterns
    for (const child of el.querySelectorAll("span, b, div, a")) {
      const text = child.textContent?.trim() || ""
      if (!text || text.length > 20) continue
      // Match prices like $299.99, C$299.99, £199.99, €249.99
      if (/^[C£€]?\$?[\d,.]+$/.test(text) || /^\$[\d,.]+$/.test(text)) {
        const parsed = parsePrice(text)
        if (parsed && parsed.price > 0 && parsed.price < 50000) {
          price = parsed.price
          currency = parsed.currency
          break
        }
      }
    }

    // Also try aria-label for price (Google sometimes puts price info there)
    if (price === null) {
      const ariaLabel = el.querySelector("[aria-label*='$']")?.getAttribute("aria-label") ?? ""
      if (ariaLabel) {
        const priceMatch = ariaLabel.match(/\$[\d,.]+/)
        if (priceMatch) {
          const parsed = parsePrice(priceMatch[0])
          if (parsed) { price = parsed.price; currency = parsed.currency }
        }
      }
    }

    if (price === null) continue

    const storeText =
      el.querySelector(".sh-dgr__store-name")?.textContent?.trim() ??
      el.querySelector(".aULzUe")?.textContent?.trim() ??
      el.querySelector(".E5ocAb")?.textContent?.trim() ??
      el.querySelector(".LrzXr")?.textContent?.trim() ??
      null

    const link = el.querySelector("a")?.getAttribute("href") ?? null
    const fullUrl = link
      ? link.startsWith("http") ? link : `https://www.google.com${link}`
      : ""

    const image = el.querySelector("img")?.getAttribute("src") ?? null
    const retailer = detectRetailerFromStore(storeText, fullUrl)

    candidates.push({ title, price, currency, url: fullUrl, retailer, image })
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
