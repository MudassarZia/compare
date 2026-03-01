import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { ComparePricesRequest, ComparePricesResponse } from "~types/messages"
import type { ComparisonError, ComparisonResult, CompetitorPrice, RetailerKey } from "~types/product"
import { scrapeQueue } from "~core/scrape-queue"
import { googleShoppingScraper, getDirectScrapers, type ScrapedCandidate } from "~core/scrapers"
import { matchProducts } from "~core/ai/openrouter"
import { aiRateLimiter } from "~core/ai/rate-limiter"
import { fallbackMatch } from "~core/ai/fallback-matcher"
import { cacheManager } from "~core/cache/cache-manager"
import { buildSearchQuery } from "~utils/url-patterns"
import { logger } from "~utils/logger"

const handler: PlasmoMessaging.MessageHandler<ComparePricesRequest, ComparePricesResponse> = async (
  req,
  res
) => {
  const { product } = req.body

  try {
    // 1. Check cache
    const cacheKey = product.identifier ?? product.url
    const cached = await cacheManager.get(cacheKey)
    if (cached) {
      logger.info("Cache hit for", cacheKey)
      res.send({ success: true, result: { ...cached, cached: true } })
      return
    }

    const query = buildSearchQuery(product)
    logger.info("Searching for:", query)

    const errors: ComparisonError[] = []
    const allCandidates: ScrapedCandidate[] = []
    const coveredRetailers = new Set<RetailerKey>()

    // 2. Scrape Google Shopping first (one request -> multiple retailers)
    try {
      const gsUrl = googleShoppingScraper.buildSearchUrl(query)
      const gsHtml = await scrapeQueue.enqueue(gsUrl)
      const gsResults = googleShoppingScraper.parseSearchResults(gsHtml)
      for (const r of gsResults) {
        allCandidates.push(r)
        if (r.retailer !== "unknown") coveredRetailers.add(r.retailer)
      }
      logger.info(`Google Shopping returned ${gsResults.length} results, covering: ${[...coveredRetailers].join(", ")}`)
    } catch (err) {
      logger.warn("Google Shopping scrape failed:", err)
      errors.push({ retailer: "google-shopping", message: String(err) })
    }

    // 3. Fill gaps: scrape retailers not covered by Google Shopping
    // Skip the source product's retailer
    const directScrapers = getDirectScrapers().filter(
      (s) => s.key !== product.retailer && !coveredRetailers.has(s.key)
    )

    const scrapePromises = directScrapers.map(async (scraper) => {
      try {
        const url = scraper.buildSearchUrl(query)
        const html = await scrapeQueue.enqueue(url)
        const results = scraper.parseSearchResults(html)
        logger.info(`${scraper.key} returned ${results.length} results`)
        return results
      } catch (err) {
        logger.warn(`${scraper.key} scrape failed:`, err)
        errors.push({ retailer: scraper.key, message: String(err) })
        return []
      }
    })

    const directResults = await Promise.all(scrapePromises)
    for (const results of directResults) {
      allCandidates.push(...results)
    }

    if (allCandidates.length === 0) {
      res.send({
        success: true,
        result: {
          sourceProduct: product,
          competitors: [],
          timestamp: Date.now(),
          cached: false,
          errors
        }
      })
      return
    }

    // 4. AI matching (or fallback)
    let competitors: CompetitorPrice[]
    if (aiRateLimiter.canRequest()) {
      try {
        competitors = await matchProducts(product, allCandidates)
      } catch (err) {
        logger.warn("AI matching failed, using fallback:", err)
        competitors = fallbackMatch(product, allCandidates)
      }
    } else {
      logger.info("AI rate limited, using fallback matcher")
      competitors = fallbackMatch(product, allCandidates)
    }

    // Sort by price ascending
    competitors.sort((a, b) => a.price - b.price)

    const result: ComparisonResult = {
      sourceProduct: product,
      competitors,
      timestamp: Date.now(),
      cached: false,
      errors
    }

    // 5. Cache the result
    await cacheManager.set(cacheKey, result)

    res.send({ success: true, result })
  } catch (err) {
    logger.error("Comparison failed:", err)
    res.send({ success: false, error: String(err) })
  }
}

export default handler
