import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { parsePrice } from "~utils/price-utils"
import { extractIdentifier } from "~utils/url-patterns"

export const neweggExtractor: ProductExtractor = {
  name: "Newegg DOM",

  canExtract: (url: string) => /newegg\.com/.test(url),

  extract: (doc: Document, url: string): ProductData | null => {
    const title =
      doc.querySelector(".product-title")?.textContent?.trim() ??
      doc.querySelector("h1.product-title")?.textContent?.trim() ??
      null
    if (!title) return null

    let price: number | null = null
    let currency = "USD"

    // Newegg has .price-current with dollar and cents separated
    const priceDollars = doc.querySelector(".price-current strong")?.textContent
    const priceCents = doc.querySelector(".price-current sup")?.textContent
    if (priceDollars) {
      const priceStr = `$${priceDollars}${priceCents || ""}`
      const parsed = parsePrice(priceStr)
      if (parsed) {
        price = parsed.price
        currency = parsed.currency
      }
    }

    // Fallback
    if (price === null) {
      const priceEl = doc.querySelector(".price-current")?.textContent
      if (priceEl) {
        const parsed = parsePrice(priceEl)
        if (parsed) {
          price = parsed.price
          currency = parsed.currency
        }
      }
    }

    const image =
      doc.querySelector(".product-view-img-original")?.getAttribute("src") ??
      doc.querySelector(".swiper-slide img")?.getAttribute("src") ??
      null

    const ratingEl = doc.querySelector(".product-rating i")
    const ratingClass = ratingEl?.className || ""
    const ratingMatch = ratingClass.match(/is-(\d)/)
    const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : null

    return {
      title,
      price,
      currency,
      image,
      url,
      retailer: "newegg",
      identifier: extractIdentifier(url),
      brand: null,
      model: null,
      rating,
      reviewCount: null
    }
  }
}
