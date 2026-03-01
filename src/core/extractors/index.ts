import type { ProductExtractor } from "~types/extractors"
import type { ProductData } from "~types/product"
import { logger } from "~utils/logger"

import { amazonExtractor } from "./amazon"
import { bestbuyExtractor } from "./bestbuy"
import { ebayExtractor } from "./ebay"
import { genericExtractor } from "./generic"
import { jsonLdExtractor } from "./json-ld"
import { neweggExtractor } from "./newegg"
import { targetExtractor } from "./target"
import { walmartExtractor } from "./walmart"

// Priority order: JSON-LD (most reliable) -> retailer-specific DOM -> generic meta tags
const extractors: ProductExtractor[] = [
  jsonLdExtractor,
  amazonExtractor,
  walmartExtractor,
  targetExtractor,
  bestbuyExtractor,
  ebayExtractor,
  neweggExtractor,
  genericExtractor
]

export function extractProduct(doc: Document, url: string): ProductData | null {
  for (const extractor of extractors) {
    if (!extractor.canExtract(url)) continue
    try {
      const product = extractor.extract(doc, url)
      if (product && product.title) {
        logger.info(`Extracted product via ${extractor.name}:`, product.title)
        return product
      }
    } catch (err) {
      logger.warn(`Extractor ${extractor.name} failed:`, err)
    }
  }
  logger.warn("No extractor could extract product data from", url)
  return null
}
