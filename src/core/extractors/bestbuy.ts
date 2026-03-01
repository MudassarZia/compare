import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { parsePrice } from "~utils/price-utils"
import { extractIdentifier } from "~utils/url-patterns"

export const bestbuyExtractor: ProductExtractor = {
  name: "Best Buy DOM",

  canExtract: (url: string) => /bestbuy\.com/.test(url),

  extract: (doc: Document, url: string): ProductData | null => {
    const title =
      doc.querySelector(".sku-title h1")?.textContent?.trim() ??
      doc.querySelector("[data-testid='heading']")?.textContent?.trim() ??
      doc.querySelector("h1")?.textContent?.trim() ??
      null
    if (!title) return null

    let price: number | null = null
    let currency = "USD"

    const priceEl =
      doc.querySelector(".priceView-customer-price span")?.textContent ??
      doc.querySelector("[data-testid='customer-price'] span")?.textContent ??
      null
    if (priceEl) {
      const parsed = parsePrice(priceEl)
      if (parsed) {
        price = parsed.price
        currency = parsed.currency
      }
    }

    const image =
      doc.querySelector(".primary-image")?.getAttribute("src") ??
      doc.querySelector(".shop-media-gallery img")?.getAttribute("src") ??
      null

    return {
      title,
      price,
      currency,
      image,
      url,
      retailer: "bestbuy",
      identifier: extractIdentifier(url),
      brand: null,
      model: doc.querySelector(".sku-model .sku-value")?.textContent?.trim() ?? null,
      rating: null,
      reviewCount: null
    }
  }
}
