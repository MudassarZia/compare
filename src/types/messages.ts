import type { ComparisonResult, ProductData } from "./product"

export interface ComparePricesRequest {
  product: ProductData
}

export interface ComparePricesResponse {
  success: boolean
  result?: ComparisonResult
  error?: string
}

export interface ScrapeUrlRequest {
  url: string
  retailer: string
}

export interface ScrapeUrlResponse {
  success: boolean
  html?: string
  error?: string
}
