import type { ProductData, RetailerKey } from "~types/product"

export type Region = "us" | "ca" | "uk"

interface RetailerPattern {
  key: RetailerKey
  hostPattern: RegExp
  productPagePattern: RegExp
  identifierExtractor?: (url: string) => string | null
}

const RETAILER_PATTERNS: RetailerPattern[] = [
  {
    key: "amazon",
    hostPattern: /amazon\.(com|co\.uk|ca|de|fr|it|es)/,
    productPagePattern: /\/(dp|gp\/product)\/[A-Z0-9]{10}/,
    identifierExtractor: (url) => {
      const match = url.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
      return match?.[1] ?? null
    }
  },
  {
    key: "walmart",
    hostPattern: /walmart\.(com|ca)/,
    productPagePattern: /\/ip\/[^/]+\/\d+/,
    identifierExtractor: (url) => {
      const match = url.match(/\/ip\/[^/]+\/(\d+)/)
      return match?.[1] ?? null
    }
  },
  {
    key: "target",
    hostPattern: /target\.com/,
    productPagePattern: /\/p\/[^/]+-\/A-\d+/,
    identifierExtractor: (url) => {
      const match = url.match(/A-(\d+)/)
      return match?.[1] ?? null
    }
  },
  {
    key: "bestbuy",
    hostPattern: /bestbuy\.(com|ca)/,
    productPagePattern: /\/site\/[^/]+\/\d+\.p|\/en-ca\/product\//,
    identifierExtractor: (url) => {
      const match = url.match(/\/(\d+)\.p/)
      return match?.[1] ?? null
    }
  },
  {
    key: "ebay",
    hostPattern: /ebay\.(com|co\.uk|ca|de|fr)/,
    productPagePattern: /\/itm\/\d+/,
    identifierExtractor: (url) => {
      const match = url.match(/\/itm\/(\d+)/)
      return match?.[1] ?? null
    }
  },
  {
    key: "newegg",
    hostPattern: /newegg\.(com|ca)/,
    productPagePattern: /\/p\/[A-Z0-9-]+|\/Product\/Product\.aspx/,
    identifierExtractor: (url) => {
      const match = url.match(/\/p\/([A-Z0-9-]+)/) || url.match(/Item=([A-Z0-9-]+)/)
      return match?.[1] ?? null
    }
  }
]

export function detectRetailer(url: string): RetailerKey {
  try {
    const hostname = new URL(url).hostname
    for (const pattern of RETAILER_PATTERNS) {
      if (pattern.hostPattern.test(hostname)) {
        return pattern.key
      }
    }
  } catch {
    // invalid URL
  }
  return "unknown"
}

export function detectRegion(url: string): Region {
  try {
    const hostname = new URL(url).hostname
    if (/\.ca$/.test(hostname)) return "ca"
    if (/\.co\.uk$/.test(hostname)) return "uk"
  } catch {
    // invalid URL
  }
  return "us"
}

export function isProductPage(url: string): boolean {
  for (const pattern of RETAILER_PATTERNS) {
    if (pattern.hostPattern.test(new URL(url).hostname)) {
      return pattern.productPagePattern.test(url)
    }
  }
  return false
}

export function extractIdentifier(url: string): string | null {
  for (const pattern of RETAILER_PATTERNS) {
    if (pattern.hostPattern.test(new URL(url).hostname) && pattern.identifierExtractor) {
      return pattern.identifierExtractor(url)
    }
  }
  return null
}

export function buildSearchQuery(product: ProductData): string {
  const words = product.title
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .filter(
      (w) =>
        !["the", "a", "an", "and", "or", "for", "with", "in", "on", "by", "from", "new"].includes(
          w.toLowerCase()
        )
    )
  return words.slice(0, 8).join(" ")
}
