import type { RetailerKey } from "~types/product"

import { amazonScraper } from "./amazon"
import { bestbuyScraper } from "./bestbuy"
import { ebayScraper } from "./ebay"
import { googleShoppingScraper } from "./google-shopping"
import { neweggScraper } from "./newegg"
import { targetScraper } from "./target"
import { walmartScraper } from "./walmart"

export interface ScrapedCandidate {
  title: string
  price: number
  currency: string
  url: string
  retailer: RetailerKey
  image: string | null
}

export interface Scraper {
  key: RetailerKey
  buildSearchUrl: (query: string) => string
  parseSearchResults: (html: string) => ScrapedCandidate[]
}

const scraperMap: Record<string, Scraper> = {
  "google-shopping": googleShoppingScraper,
  amazon: amazonScraper,
  walmart: walmartScraper,
  target: targetScraper,
  bestbuy: bestbuyScraper,
  ebay: ebayScraper,
  newegg: neweggScraper
}

export function getScraper(key: string): Scraper | undefined {
  return scraperMap[key]
}

export function getAllScrapers(): Scraper[] {
  return Object.values(scraperMap)
}

export function getDirectScrapers(): Scraper[] {
  return Object.values(scraperMap).filter((s) => s.key !== "google-shopping")
}

export { googleShoppingScraper }
