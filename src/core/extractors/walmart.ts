import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { parsePrice } from "~utils/price-utils"
import { extractIdentifier } from "~utils/url-patterns"

export const walmartExtractor: ProductExtractor = {
  name: "Walmart DOM",

  canExtract: (url: string) => /walmart\.com/.test(url),

  extract: (doc: Document, url: string): ProductData | null => {
    // Try __NEXT_DATA__ first (Walmart uses Next.js)
    const nextDataEl = doc.querySelector("#__NEXT_DATA__")
    if (nextDataEl?.textContent) {
      try {
        const nextData = JSON.parse(nextDataEl.textContent)
        const product = extractFromNextData(nextData)
        if (product) return { ...product, url, retailer: "walmart", identifier: extractIdentifier(url) } as ProductData
      } catch {
        // fall through to DOM
      }
    }

    // DOM fallback
    const title =
      doc.querySelector("[itemprop='name']")?.textContent?.trim() ??
      doc.querySelector("h1")?.textContent?.trim() ??
      null
    if (!title) return null

    let price: number | null = null
    let currency = "USD"

    const priceEl =
      doc.querySelector("[itemprop='price']") ??
      doc.querySelector("[data-testid='price-wrap']") ??
      doc.querySelector(".price-characteristic")

    if (priceEl?.textContent) {
      const parsed = parsePrice(priceEl.textContent)
      if (parsed) {
        price = parsed.price
        currency = parsed.currency
      }
    }

    const image =
      doc.querySelector("[data-testid='hero-image'] img")?.getAttribute("src") ??
      doc.querySelector(".prod-hero-image img")?.getAttribute("src") ??
      null

    return {
      title,
      price,
      currency,
      image,
      url,
      retailer: "walmart",
      identifier: extractIdentifier(url),
      brand: doc.querySelector("[itemprop='brand']")?.textContent?.trim() ?? null,
      model: null,
      rating: null,
      reviewCount: null
    }
  }
}

function extractFromNextData(data: Record<string, unknown>): Partial<ProductData> | null {
  try {
    const props = data.props as Record<string, unknown>
    const pageProps = props?.pageProps as Record<string, unknown>
    const initialData = pageProps?.initialData as Record<string, unknown>
    const product = (initialData?.data as Record<string, unknown>)?.product as Record<string, unknown>

    if (!product) return null

    const title = product.name as string
    if (!title) return null

    const priceInfo = product.priceInfo as Record<string, unknown>
    const currentPrice = priceInfo?.currentPrice as Record<string, unknown>
    const price = currentPrice?.price as number ?? null

    return {
      title,
      price,
      currency: (currentPrice?.currencyUnit as string) ?? "USD",
      image: (product.imageInfo as Record<string, unknown>)?.thumbnailUrl as string ?? null,
      brand: (product.brand as string) ?? null,
      model: null,
      rating: null,
      reviewCount: null
    }
  } catch {
    return null
  }
}
