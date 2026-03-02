import { logger } from "~utils/logger"

const RATE_LIMIT = 10 // requests per window
const RATE_WINDOW_MS = 60_000 // 1 minute

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
}

class ScrapeQueue {
  private timestamps: number[] = []

  /** Fetch a URL with rate limiting. Requests fire immediately if under the limit. */
  async fetch(url: string): Promise<string> {
    await this.waitForSlot()

    logger.debug("Scraping:", url)
    const response = await globalThis.fetch(url, {
      headers: BROWSER_HEADERS,
      credentials: "omit",
      redirect: "follow"
    })

    this.timestamps.push(Date.now())

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} (${response.url})`)
    }

    const text = await response.text()
    logger.debug(`Response from ${new URL(url).hostname}: ${text.length} bytes, final URL: ${response.url}`)

    // Log first 300 chars for debugging (helps detect captcha/consent pages)
    if (text.length < 5000) {
      logger.warn(`Small response from ${new URL(url).hostname} (${text.length} bytes) — may be a captcha/consent page`)
    }

    return text
  }

  private async waitForSlot() {
    const now = Date.now()
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
