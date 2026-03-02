import type { RetailerKey } from "~types/product"
import { parsePrice } from "./price-utils"
import { logger } from "./logger"

interface ScannedProduct {
  title: string
  price: number
  currency: string
  url: string
  image: string | null
}

/**
 * Regex-based fallback scanner for when CSS selectors fail.
 * Scans raw HTML for price/title patterns embedded in JSON or visible text.
 */
export function scanHtmlForProducts(
  html: string,
  retailer: RetailerKey,
  baseDomain: string,
  maxResults = 5
): ScannedProduct[] {
  const results: ScannedProduct[] = []

  // Strategy 1: Find JSON blobs embedded in script tags (very common for SSR/hydration)
  const scriptJsonResults = extractFromScriptJson(html, baseDomain, maxResults)
  results.push(...scriptJsonResults)
  if (results.length >= maxResults) return results.slice(0, maxResults)

  // Strategy 2: Find price patterns near title-like text in the HTML
  const regexResults = extractFromRegexPatterns(html, baseDomain, maxResults - results.length)
  results.push(...regexResults)

  // Strategy 3: Broad sweep - find any dollar amounts near reasonable product text
  if (results.length === 0) {
    const broadResults = extractBroadSweep(html, baseDomain, maxResults)
    results.push(...broadResults)
  }

  return results.slice(0, maxResults)
}

function extractFromScriptJson(html: string, baseDomain: string, max: number): ScannedProduct[] {
  const results: ScannedProduct[] = []
  const seen = new Set<string>()

  // Extract all JSON-like objects from script tags
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let scriptMatch: RegExpExecArray | null

  while ((scriptMatch = scriptPattern.exec(html)) !== null) {
    const content = scriptMatch[1]
    if (content.length < 50 || content.length > 500_000) continue

    // Look for product-like JSON objects within script content
    const jsonPatterns = [
      // {"name":"...","price":123}
      /"(?:name|title|productName|product_name)"\s*:\s*"([^"]{10,150})"[\s\S]{0,500}?"(?:price|salePrice|currentPrice|offerPrice|regular_price|sale_price)"\s*:\s*"?(\$?[\d,.]+)"?/g,
      // Reverse: {"price":123,"name":"..."}
      /"(?:price|salePrice|currentPrice|offerPrice)"\s*:\s*"?(\$?[\d,.]+)"?[\s\S]{0,500}?"(?:name|title|productName|product_name)"\s*:\s*"([^"]{10,150})"/g,
    ]

    for (const pattern of jsonPatterns) {
      pattern.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = pattern.exec(content)) !== null) {
        if (results.length >= max) break

        let title: string
        let priceRaw: string

        if (pattern.source.startsWith('"(?:name')) {
          title = m[1]
          priceRaw = m[2]
        } else {
          priceRaw = m[1]
          title = m[2]
        }

        title = cleanTitle(title)
        if (!title || seen.has(title.toLowerCase())) continue

        const priceNum = parseFloat(priceRaw.replace(/[$,]/g, ''))
        if (isNaN(priceNum) || priceNum <= 0 || priceNum > 50000) continue

        seen.add(title.toLowerCase())
        results.push({
          title,
          price: priceNum,
          currency: "USD",
          url: `https://${baseDomain}`,
          image: null
        })
      }
    }
  }

  return results
}

function extractFromRegexPatterns(html: string, baseDomain: string, max: number): ScannedProduct[] {
  const results: ScannedProduct[] = []
  const seen = new Set<string>()

  // Pattern: <a href="...product-url...">...title text...</a> ... $XX.XX
  const linkPatterns = [
    /<a\s[^>]*href="([^"]*(?:\/dp\/|\/ip\/|\/itm\/|\/p\/|\/product\/|\/site\/)[^"]*)"[^>]*>([^<]{10,120})<\/a>[\s\S]{0,500}?\$(\d[\d,.]*)/g,
    // Reversed: price then link
    /\$(\d[\d,.]*)[\s\S]{0,300}?<a\s[^>]*href="([^"]*(?:\/dp\/|\/ip\/|\/itm\/|\/p\/|\/product\/)[^"]*)"[^>]*>([^<]{10,120})<\/a>/g,
  ]

  for (const pattern of linkPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(html)) !== null) {
      if (results.length >= max) break

      let href: string, rawTitle: string, rawPrice: string
      if (pattern.source.startsWith('<a')) {
        [, href, rawTitle, rawPrice] = match
      } else {
        [, rawPrice, href, rawTitle] = match
      }

      const title = cleanTitle(rawTitle)
      if (!title || seen.has(title.toLowerCase())) continue

      const price = parseFloat(rawPrice.replace(/,/g, ''))
      if (isNaN(price) || price <= 0) continue

      seen.add(title.toLowerCase())
      const url = href.startsWith('http') ? href : `https://${baseDomain}${href}`
      results.push({ title, price, currency: "USD", url, image: null })
    }
  }

  return results
}

function extractBroadSweep(html: string, baseDomain: string, max: number): ScannedProduct[] {
  const results: ScannedProduct[] = []
  const seen = new Set<string>()

  // Find any visible text blocks that contain dollar prices
  // Strip HTML tags to get raw text, then look for "Title ... $Price" patterns
  const textBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 5)

  for (let i = 0; i < textBlocks.length && results.length < max; i++) {
    const line = textBlocks[i]
    // Check if this line has a price
    const priceMatch = line.match(/\$(\d[\d,]*\.?\d{0,2})/)
    if (!priceMatch) continue

    const price = parseFloat(priceMatch[1].replace(/,/g, ''))
    if (isNaN(price) || price <= 0 || price > 50000) continue

    // Look for a title in nearby lines (within 3 lines before)
    for (let j = Math.max(0, i - 3); j <= i; j++) {
      const candidate = textBlocks[j]
      if (candidate.length < 10 || candidate.length > 150) continue
      if (/^\$/.test(candidate) || /^[\d,.]+$/.test(candidate)) continue
      if (/^(http|www\.|function|return|var |let |const |if |for )/i.test(candidate)) continue
      // Must look like a product title (has letters and spaces)
      if (!/[A-Za-z].*\s.*[A-Za-z]/.test(candidate)) continue

      const title = candidate
      if (seen.has(title.toLowerCase())) continue
      seen.add(title.toLowerCase())

      results.push({
        title,
        price,
        currency: "USD",
        url: `https://${baseDomain}`,
        image: null
      })
      break
    }
  }

  return results
}

/**
 * Extract product data from Google Shopping's embedded data.
 * Google Shopping embeds product data in script tags and data attributes.
 */
export function scanGoogleShoppingHtml(html: string, maxResults = 10): ScannedProduct[] {
  const results: ScannedProduct[] = []
  const seen = new Set<string>()

  // Check for consent/redirect page
  if (html.includes("consent.google") || html.includes("Before you continue")) {
    logger.warn("Google Shopping returned a consent page — results will be empty")
    return []
  }

  // Strategy 1: Google Shopping often embeds data in AF_initDataCallback calls
  // These contain large arrays of product data
  const afCallbackPattern = /AF_initDataCallback\(\{[^}]*data:([\s\S]*?)\}\);/g
  let afMatch: RegExpExecArray | null

  while ((afMatch = afCallbackPattern.exec(html)) !== null) {
    if (results.length >= maxResults) break
    const data = afMatch[1]
    // Look for product-like entries: title strings followed by price strings
    extractProductsFromGoogleData(data, results, seen, maxResults)
  }

  // Strategy 2: Look for structured product entries in the HTML
  // Google Shopping uses patterns like: data-docid="..." with nearby title and price
  const productBlockPattern = /data-docid="[^"]*"[\s\S]{0,2000}?<h3[^>]*>([^<]{5,150})<\/h3>[\s\S]{0,500}?(?:\$|C\$|£|€)([\d,.]+)/g
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = productBlockPattern.exec(html)) !== null) {
    if (results.length >= maxResults) break
    const title = cleanTitle(blockMatch[1])
    const price = parseFloat(blockMatch[2].replace(/,/g, ''))
    if (!title || seen.has(title.toLowerCase()) || isNaN(price) || price <= 0) continue

    seen.add(title.toLowerCase())
    results.push({ title, price, currency: "USD", url: "", image: null })
  }

  // Strategy 3: Look for patterns like ["Product Title",null,...,"$XX.XX",...]
  const bracketPattern = /\["([^"]{10,150})"(?:,(?:null|"[^"]*"|\d+|\[[^\]]*\]|\{[^}]*\})){1,12},"?\$?([\d,.]+)"?/g
  let bracketMatch: RegExpExecArray | null

  while ((bracketMatch = bracketPattern.exec(html)) !== null) {
    if (results.length >= maxResults) break
    const title = cleanTitle(bracketMatch[1])
    if (!title || seen.has(title.toLowerCase())) continue
    // Must look like a product title
    if (!/[A-Za-z]/.test(title) || !title.includes(' ')) continue

    const price = parseFloat(bracketMatch[2].replace(/,/g, ''))
    if (isNaN(price) || price <= 0 || price > 50000) continue

    seen.add(title.toLowerCase())
    results.push({ title, price, currency: "USD", url: "", image: null })
  }

  // Strategy 4: Find visible price+title pairs in the rendered HTML
  // Strip scripts, look for h3/h4/span elements with text near price spans
  if (results.length < 3) {
    const titlePricePattern = /<(?:h3|h4|a)[^>]*>([^<]{10,120})<\/(?:h3|h4|a)>[\s\S]{0,400}?(?:[\$C£€])([\d,.]+)/g
    let tpMatch: RegExpExecArray | null

    while ((tpMatch = titlePricePattern.exec(html)) !== null) {
      if (results.length >= maxResults) break
      const title = cleanTitle(tpMatch[1])
      const price = parseFloat(tpMatch[2].replace(/,/g, ''))
      if (!title || seen.has(title.toLowerCase()) || isNaN(price) || price <= 0) continue
      if (!title.includes(' ')) continue

      seen.add(title.toLowerCase())
      results.push({ title, price, currency: "USD", url: "", image: null })
    }
  }

  // Strategy 5: Broad quoted-string near price pattern
  if (results.length < 3) {
    const nearbyPattern = /"([A-Z][^"]{10,120})"[\s\S]{0,200}?\$(\d[\d,.]*)/g
    let nearbyMatch: RegExpExecArray | null

    while ((nearbyMatch = nearbyPattern.exec(html)) !== null) {
      if (results.length >= maxResults) break
      const title = cleanTitle(nearbyMatch[1])
      const price = parseFloat(nearbyMatch[2].replace(/,/g, ''))

      if (!title || isNaN(price) || price <= 0 || price > 50000) continue
      if (!title.includes(' ') || /^(http|www\.|function|return|var |let |const )/i.test(title)) continue
      if (seen.has(title.toLowerCase())) continue

      seen.add(title.toLowerCase())
      results.push({ title, price, currency: "USD", url: "", image: null })
    }
  }

  logger.debug(`Google Shopping scanner found ${results.length} results from HTML (${html.length} bytes)`)
  return results
}

function extractProductsFromGoogleData(
  data: string,
  results: ScannedProduct[],
  seen: Set<string>,
  max: number
) {
  // Look for product name/price pairs in Google's AF_initDataCallback data
  // Products typically appear as: ["product title", null, ..., "price", ...]
  // or as JSON-like nested structures

  // Pattern: find quoted strings that look like product names near prices
  const pattern = /"([A-Z][^"]{10,120})"[\s\S]{0,300}?(?:(\d{1,5}\.\d{2})|\$(\d[\d,.]+)|"(\$\d[\d,.]+)")/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(data)) !== null) {
    if (results.length >= max) break

    const title = cleanTitle(match[1])
    if (!title || seen.has(title.toLowerCase())) continue
    if (!title.includes(' ')) continue

    const priceStr = match[2] || match[3] || match[4]
    if (!priceStr) continue
    const price = parseFloat(priceStr.replace(/[$,]/g, ''))
    if (isNaN(price) || price <= 0 || price > 50000) continue

    seen.add(title.toLowerCase())
    results.push({
      title,
      price,
      currency: "USD",
      url: "",
      image: null
    })
  }
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\\u[\dA-Fa-f]{4}/g, ' ')
    .replace(/\\['"]/g, "'")
    .replace(/&#\d+;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
