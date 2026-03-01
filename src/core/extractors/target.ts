import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { parsePrice } from "~utils/price-utils"
import { extractIdentifier } from "~utils/url-patterns"

export const targetExtractor: ProductExtractor = {
  name: "Target DOM",

  canExtract: (url: string) => /target\.com/.test(url),

  extract: (doc: Document, url: string): ProductData | null => {
    const title =
      doc.querySelector("[data-test='product-title']")?.textContent?.trim() ??
      doc.querySelector("h1")?.textContent?.trim() ??
      null
    if (!title) return null

    let price: number | null = null
    let currency = "USD"

    const priceEl =
      doc.querySelector("[data-test='product-price']") ??
      doc.querySelector(".styles__CurrentPriceFontSize")
    if (priceEl?.textContent) {
      const parsed = parsePrice(priceEl.textContent)
      if (parsed) {
        price = parsed.price
        currency = parsed.currency
      }
    }

    const image =
      doc.querySelector("[data-test='product-image'] img")?.getAttribute("src") ??
      doc.querySelector("picture img")?.getAttribute("src") ??
      null

    return {
      title,
      price,
      currency,
      image,
      url,
      retailer: "target",
      identifier: extractIdentifier(url),
      brand: doc.querySelector("[data-test='product-brand']")?.textContent?.trim() ?? null,
      model: null,
      rating: null,
      reviewCount: null
    }
  }
}
