import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { parsePrice } from "~utils/price-utils"
import { extractIdentifier } from "~utils/url-patterns"

export const ebayExtractor: ProductExtractor = {
  name: "eBay DOM",

  canExtract: (url: string) => /ebay\.(com|co\.uk|de|fr)/.test(url),

  extract: (doc: Document, url: string): ProductData | null => {
    const title =
      doc.querySelector("#mainContent .x-item-title__mainTitle span")?.textContent?.trim() ??
      doc.querySelector("h1.x-item-title__mainTitle")?.textContent?.trim() ??
      doc.querySelector("h1[itemprop='name']")?.textContent?.trim() ??
      null
    if (!title) return null

    let price: number | null = null
    let currency = "USD"

    const priceEl =
      doc.querySelector("#mainContent .x-price-primary span")?.textContent ??
      doc.querySelector("[itemprop='price']")?.getAttribute("content") ??
      doc.querySelector(".x-bin-price__content .x-price-primary")?.textContent ??
      null
    if (priceEl) {
      const parsed = parsePrice(priceEl)
      if (parsed) {
        price = parsed.price
        currency = parsed.currency
      }
    }

    const image =
      doc.querySelector(".ux-image-carousel-item img")?.getAttribute("src") ??
      doc.querySelector("#icImg")?.getAttribute("src") ??
      null

    return {
      title,
      price,
      currency,
      image,
      url,
      retailer: "ebay",
      identifier: extractIdentifier(url),
      brand: doc.querySelector("[itemprop='brand'] span")?.textContent?.trim() ?? null,
      model: null,
      rating: null,
      reviewCount: null
    }
  }
}
