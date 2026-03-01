import { logger } from "~utils/logger"

const MAX_PER_MINUTE = 15
const MAX_PER_DAY = 180
const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

class AiRateLimiter {
  private minuteTimestamps: number[] = []
  private dayTimestamps: number[] = []

  canRequest(): boolean {
    this.cleanup()
    return this.minuteTimestamps.length < MAX_PER_MINUTE && this.dayTimestamps.length < MAX_PER_DAY
  }

  record(): void {
    const now = Date.now()
    this.minuteTimestamps.push(now)
    this.dayTimestamps.push(now)
  }

  get remaining(): { minute: number; day: number } {
    this.cleanup()
    return {
      minute: MAX_PER_MINUTE - this.minuteTimestamps.length,
      day: MAX_PER_DAY - this.dayTimestamps.length
    }
  }

  private cleanup() {
    const now = Date.now()
    this.minuteTimestamps = this.minuteTimestamps.filter((t) => now - t < MINUTE_MS)
    this.dayTimestamps = this.dayTimestamps.filter((t) => now - t < DAY_MS)
  }
}

export const aiRateLimiter = new AiRateLimiter()
