import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { parsePrice } from "~utils/price-utils"
import { extractIdentifier } from "~utils/url-patterns"

export const amazonExtractor: ProductExtractor = {
  name: "Amazon DOM",

  canExtract: (url: string) => /amazon\.(com|co\.uk|ca|de|fr|it|es)/.test(url),

  extract: (doc: Document, url: string): ProductData | null => {
    const title =
      doc.querySelector("#productTitle")?.textContent?.trim() ??
      doc.querySelector("#title")?.textContent?.trim() ??
      null
    if (!title) return null

    let price: number | null = null
    let currency = "USD"

    // Primary: .a-price .a-offscreen (hidden accessible price text)
    const priceEl =
      doc.querySelector(".a-price .a-offscreen") ??
      doc.querySelector("#priceblock_ourprice") ??
      doc.querySelector("#priceblock_dealprice") ??
      doc.querySelector(".a-price-whole")
    if (priceEl?.textContent) {
      const parsed = parsePrice(priceEl.textContent)
      if (parsed) {
        price = parsed.price
        currency = parsed.currency
      }
    }

    const image =
      doc.querySelector("#landingImage")?.getAttribute("src") ??
      doc.querySelector("#imgBlkFront")?.getAttribute("src") ??
      null

    const brand =
      doc.querySelector("#bylineInfo")?.textContent?.replace(/^(Visit the |Brand: )/, "").trim() ??
      null

    const ratingText = doc.querySelector("#acrPopover")?.getAttribute("title")
    const rating = ratingText ? parseFloat(ratingText) : null

    const reviewText = doc.querySelector("#acrCustomerReviewText")?.textContent
    const reviewCount = reviewText ? parseInt(reviewText.replace(/[^0-9]/g, ""), 10) : null

    return {
      title,
      price,
      currency,
      image,
      url,
      retailer: "amazon",
      identifier: extractIdentifier(url),
      brand,
      model: null,
      rating: isNaN(rating) ? null : rating,
      reviewCount: isNaN(reviewCount) ? null : reviewCount
    }
  }
}
