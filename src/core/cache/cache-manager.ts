import type { ComparisonResult } from "~types/product"
import { localCache } from "./local-cache"
import { supabaseCache } from "./supabase-client"
import { logger } from "~utils/logger"

export const cacheManager = {
  async get(key: string): Promise<ComparisonResult | null> {
    // Local first
    const local = await localCache.get(key)
    if (local) return local

    // Supabase fallback
    if (supabaseCache.isAvailable()) {
      const remote = await supabaseCache.get(key)
      if (remote) {
        // Backfill local cache
        await localCache.set(key, remote)
        return remote
      }
    }

    return null
  },

  async set(key: string, data: ComparisonResult): Promise<void> {
    // Write to both in parallel, don't fail if either fails
    const promises: Promise<void>[] = [localCache.set(key, data)]

    if (supabaseCache.isAvailable()) {
      promises.push(supabaseCache.set(key, data))
    }

    await Promise.allSettled(promises)
    logger.debug("Cached result for", key)
  },

  async clear(): Promise<void> {
    await localCache.clear()
  }
}
