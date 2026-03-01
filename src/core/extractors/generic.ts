import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { parsePrice } from "~utils/price-utils"
import { detectRetailer } from "~utils/url-patterns"

export const genericExtractor: ProductExtractor = {
  name: "Generic Meta Tags",

  canExtract: () => true,

  extract: (doc: Document, url: string): ProductData | null => {
    const title =
      getMeta(doc, "og:title") ??
      getMeta(doc, "twitter:title") ??
      doc.querySelector("h1")?.textContent?.trim() ??
      null
    if (!title) return null

    let price: number | null = null
    let currency = "USD"

    // product:price:amount is a standard Open Graph product tag
    const priceAmount = getMeta(doc, "product:price:amount")
    if (priceAmount) {
      price = parseFloat(priceAmount)
      if (isNaN(price)) price = null
      currency = getMeta(doc, "product:price:currency") ?? "USD"
    }

    // Try schema.org itemprop
    if (price === null) {
      const priceEl =
        doc.querySelector("[itemprop='price']")?.getAttribute("content") ??
        doc.querySelector("[itemprop='price']")?.textContent
      if (priceEl) {
        const parsed = parsePrice(priceEl)
        if (parsed) {
          price = parsed.price
          currency = parsed.currency
        }
      }
    }

    const image =
      getMeta(doc, "og:image") ??
      getMeta(doc, "twitter:image") ??
      null

    return {
      title,
      price,
      currency,
      image,
      url,
      retailer: detectRetailer(url),
      identifier: null,
      brand: getMeta(doc, "product:brand") ?? null,
      model: null,
      rating: null,
      reviewCount: null
    }
  }
}

function getMeta(doc: Document, property: string): string | null {
  const el =
    doc.querySelector(`meta[property="${property}"]`) ??
    doc.querySelector(`meta[name="${property}"]`)
  return el?.getAttribute("content") ?? null
}
