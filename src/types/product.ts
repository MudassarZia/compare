export interface ProductData {
  title: string
  price: number | null
  currency: string
  image: string | null
  url: string
  retailer: RetailerKey
  identifier: string | null // ASIN, SKU, UPC, etc.
  brand: string | null
  model: string | null
  rating: number | null
  reviewCount: number | null
}

export interface CompetitorPrice {
  title: string
  price: number
  currency: string
  url: string
  retailer: RetailerKey
  image: string | null
  matchConfidence: number // 0-1
  matchReasoning: string | null
}

export interface ComparisonResult {
  sourceProduct: ProductData
  competitors: CompetitorPrice[]
  timestamp: number
  cached: boolean
  errors: ComparisonError[]
}

export interface ComparisonError {
  retailer: RetailerKey
  message: string
}

export type RetailerKey =
  | "amazon"
  | "walmart"
  | "target"
  | "bestbuy"
  | "ebay"
  | "newegg"
  | "google-shopping"
  | "unknown"

export interface RetailerInfo {
  key: RetailerKey
  name: string
  domain: string
  color: string
}

export const RETAILERS: Record<Exclude<RetailerKey, "unknown">, RetailerInfo> = {
  amazon: { key: "amazon", name: "Amazon", domain: "amazon.com", color: "#FF9900" },
  walmart: { key: "walmart", name: "Walmart", domain: "walmart.com", color: "#0071CE" },
  target: { key: "target", name: "Target", domain: "target.com", color: "#CC0000" },
  bestbuy: { key: "bestbuy", name: "Best Buy", domain: "bestbuy.com", color: "#0046BE" },
  ebay: { key: "ebay", name: "eBay", domain: "ebay.com", color: "#E53238" },
  newegg: { key: "newegg", name: "Newegg", domain: "newegg.com", color: "#F7821B" },
  "google-shopping": {
    key: "google-shopping",
    name: "Google Shopping",
    domain: "google.com",
    color: "#4285F4"
  }
}
