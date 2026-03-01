import { Storage } from "@plasmohq/storage"
import type { ComparisonResult } from "~types/product"

const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

interface CacheEntry {
  data: ComparisonResult
  expiresAt: number
}

const storage = new Storage({ area: "local" })

export const localCache = {
  async get(key: string): Promise<ComparisonResult | null> {
    const raw = await storage.get<CacheEntry>(`cache:${key}`)
    if (!raw) return null

    if (Date.now() > raw.expiresAt) {
      await storage.remove(`cache:${key}`)
      return null
    }

    return raw.data
  },

  async set(key: string, data: ComparisonResult, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const entry: CacheEntry = {
      data,
      expiresAt: Date.now() + ttlMs
    }
    await storage.set(`cache:${key}`, entry)
  },

  async remove(key: string): Promise<void> {
    await storage.remove(`cache:${key}`)
  },

  async clear(): Promise<void> {
    const all = await new Promise<Record<string, unknown>>((resolve) =>
      chrome.storage.local.get(null, (items) => resolve(items))
    )
    const cacheKeys = Object.keys(all).filter((k) => k.startsWith("cache:"))
    if (cacheKeys.length > 0) {
      await new Promise<void>((resolve) =>
        chrome.storage.local.remove(cacheKeys, resolve)
      )
    }
  }
}
