import type { ProductData } from "./product"

export interface ProductExtractor {
  name: string
  canExtract: (url: string) => boolean
  extract: (document: Document, url: string) => ProductData | null
}
