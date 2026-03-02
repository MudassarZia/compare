import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { ComparePricesRequest, ComparePricesResponse } from "~types/messages"
import type { ComparisonError, ComparisonResult, CompetitorPrice, RetailerKey } from "~types/product"
import { scrapeQueue } from "~core/scrape-queue"
import { googleShoppingScraper, getDirectScrapers, type ScrapedCandidate } from "~core/scrapers"
import { matchProducts } from "~core/ai/openrouter"
import { aiRateLimiter } from "~core/ai/rate-limiter"
import { fallbackMatch } from "~core/ai/fallback-matcher"
import { cacheManager } from "~core/cache/cache-manager"
import { buildSearchQuery, detectRegion } from "~utils/url-patterns"
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

    const region = detectRegion(product.url)
    const query = buildSearchQuery(product)
    logger.info(`Searching for: "${query}" in region: ${region}`)

    const errors: ComparisonError[] = []
    const allCandidates: ScrapedCandidate[] = []

    // 2. Fire Google Shopping + all direct retailer scrapes in parallel
    const directScrapers = getDirectScrapers(region).filter(
      (s) => s.key !== product.retailer
    )

    const allScrapePromises = [
      // Google Shopping
      (async () => {
        try {
          const gsUrl = googleShoppingScraper.buildSearchUrl(query, region)
          const gsHtml = await scrapeQueue.fetch(gsUrl)
          const gsResults = googleShoppingScraper.parseSearchResults(gsHtml)
          logger.info(`Google Shopping returned ${gsResults.length} results (HTML size: ${gsHtml.length})`)
          return { source: "google-shopping" as const, results: gsResults }
        } catch (err) {
          logger.warn("Google Shopping scrape failed:", err)
          errors.push({ retailer: "google-shopping", message: String(err) })
          return { source: "google-shopping" as const, results: [] }
        }
      })(),
      // All direct retailers in parallel
      ...directScrapers.map(async (scraper) => {
        try {
          const url = scraper.buildSearchUrl(query, region)
          const html = await scrapeQueue.fetch(url)
          const results = scraper.parseSearchResults(html)
          logger.info(`${scraper.key} returned ${results.length} results (HTML size: ${html.length})`)
          if (results.length === 0 && html.length > 1000) {
            errors.push({ retailer: scraper.key, message: "No products found in search results" })
          }
          return { source: scraper.key, results }
        } catch (err) {
          logger.warn(`${scraper.key} scrape failed:`, err)
          errors.push({ retailer: scraper.key, message: String(err) })
          return { source: scraper.key, results: [] }
        }
      })
    ]

    const scrapeResults = await Promise.all(allScrapePromises)

    // Log summary
    for (const r of scrapeResults) {
      logger.info(`[${r.source}] ${r.results.length} candidates`)
    }

    // Collect all candidates, deduplicating by retailer if Google Shopping already covered them
    const coveredRetailers = new Set<RetailerKey>()

    // Add Google Shopping results first
    const gsResult = scrapeResults.find((r) => r.source === "google-shopping")
    if (gsResult) {
      for (const r of gsResult.results) {
        allCandidates.push(r)
        if (r.retailer !== "unknown") coveredRetailers.add(r.retailer)
      }
    }

    // Add direct scraper results only for retailers not already covered
    for (const result of scrapeResults) {
      if (result.source === "google-shopping") continue
      if (coveredRetailers.has(result.source as RetailerKey)) continue
      allCandidates.push(...result.results)
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

    // 3. AI matching (or fallback)
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

    // 4. Cache the result (only if we got actual competitors — don't cache failures)
    if (competitors.length > 0) {
      await cacheManager.set(cacheKey, result)
    }

    res.send({ success: true, result })
  } catch (err) {
    logger.error("Comparison failed:", err)
    res.send({ success: false, error: String(err) })
  }
}

export default handler
