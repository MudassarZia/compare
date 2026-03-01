import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { parsePrice } from "~utils/price-utils"
import { detectRetailer, extractIdentifier } from "~utils/url-patterns"

export const jsonLdExtractor: ProductExtractor = {
  name: "JSON-LD",

  canExtract: () => true, // JSON-LD can exist on any page

  extract: (doc: Document, url: string): ProductData | null => {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "")
        const product = findProduct(data)
        if (product) {
          return mapToProductData(product, url)
        }
      } catch {
        // malformed JSON-LD, skip
      }
    }
    return null
  }
}

function findProduct(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null

  if (Array.isArray(data)) {
    for (const item of data) {
      const result = findProduct(item)
      if (result) return result
    }
    return null
  }

  const obj = data as Record<string, unknown>

  if (obj["@type"] === "Product" || obj["@type"]?.toString().includes("Product")) {
    return obj
  }

  // Check @graph array
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) {
      const result = findProduct(item)
      if (result) return result
    }
  }

  return null
}

function mapToProductData(product: Record<string, unknown>, url: string): ProductData | null {
  const title = (product.name as string) || ""
  if (!title) return null

  let price: number | null = null
  let currency = "USD"

  const offers = product.offers as Record<string, unknown> | Record<string, unknown>[] | undefined

  if (offers) {
    const offer = Array.isArray(offers) ? offers[0] : offers

    if (offer) {
      // Offers can be AggregateOffer with lowPrice or a direct Offer with price
      const rawPrice =
        (offer.price as string | number) ??
        (offer.lowPrice as string | number) ??
        null

      if (rawPrice !== null) {
        price = typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice)
        if (isNaN(price)) price = null
      }
      currency = (offer.priceCurrency as string) || "USD"
    }
  }

  // Fallback: parse from text representation
  if (price === null && product.offers) {
    const priceText = JSON.stringify(product.offers)
    const parsed = parsePrice(priceText)
    if (parsed) {
      price = parsed.price
      currency = parsed.currency
    }
  }

  const image = extractImage(product)

  return {
    title,
    price,
    currency,
    image,
    url,
    retailer: detectRetailer(url),
    identifier: extractIdentifier(url),
    brand: (product.brand as Record<string, string>)?.name ?? (product.brand as string) ?? null,
    model: (product.model as string) ?? (product.mpn as string) ?? null,
    rating: parseRating(product),
    reviewCount: parseReviewCount(product)
  }
}

function extractImage(product: Record<string, unknown>): string | null {
  const img = product.image
  if (typeof img === "string") return img
  if (Array.isArray(img) && typeof img[0] === "string") return img[0]
  if (typeof img === "object" && img !== null) {
    return (img as Record<string, string>).url ?? (img as Record<string, string>).contentUrl ?? null
  }
  return null
}

function parseRating(product: Record<string, unknown>): number | null {
  const rating = product.aggregateRating as Record<string, unknown> | undefined
  if (!rating) return null
  const val = parseFloat(String(rating.ratingValue ?? ""))
  return isNaN(val) ? null : val
}

function parseReviewCount(product: Record<string, unknown>): number | null {
  const rating = product.aggregateRating as Record<string, unknown> | undefined
  if (!rating) return null
  const val = parseInt(String(rating.reviewCount ?? rating.ratingCount ?? ""), 10)
  return isNaN(val) ? null : val
}
