import { randomDelay } from "~utils/delay"
import { logger } from "~utils/logger"

interface QueueItem {
  url: string
  resolve: (html: string) => void
  reject: (error: Error) => void
}

const RATE_LIMIT = 5 // requests per window
const RATE_WINDOW_MS = 60_000 // 1 minute
const MIN_DELAY_MS = 2000
const MAX_DELAY_MS = 5000

const BROWSER_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache"
}

class ScrapeQueue {
  private queue: QueueItem[] = []
  private processing = false
  private timestamps: number[] = []

  async enqueue(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject })
      this.processNext()
    })
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true
    const item = this.queue.shift()!

    try {
      await this.waitForRateLimit()
      await randomDelay(MIN_DELAY_MS, MAX_DELAY_MS)

      logger.debug("Scraping:", item.url)
      const response = await fetch(item.url, {
        headers: BROWSER_HEADERS,
        credentials: "omit"
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()
      this.timestamps.push(Date.now())
      item.resolve(html)
    } catch (err) {
      item.reject(err instanceof Error ? err : new Error(String(err)))
    } finally {
      this.processing = false
      this.processNext()
    }
  }

  private async waitForRateLimit() {
    const now = Date.now()
    // Remove timestamps outside the rate window
    this.timestamps = this.timestamps.filter((t) => now - t < RATE_WINDOW_MS)

    if (this.timestamps.length >= RATE_LIMIT) {
      const oldestInWindow = this.timestamps[0]
      const waitMs = RATE_WINDOW_MS - (now - oldestInWindow) + 100
      logger.info(`Rate limited, waiting ${Math.round(waitMs / 1000)}s`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }
}

export const scrapeQueue = new ScrapeQueue()
