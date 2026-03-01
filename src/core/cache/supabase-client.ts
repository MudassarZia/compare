import type { ComparisonResult } from "~types/product"
import { logger } from "~utils/logger"

/**
 * Lightweight Supabase REST client (no SDK).
 * Entirely optional -- the extension works fully without Supabase.
 */

function getConfig(): { url: string; anonKey: string } | null {
  const url = process.env.PLASMO_PUBLIC_SUPABASE_URL
  const anonKey = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}

let available = true

async function supabaseFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const config = getConfig()
  if (!config) throw new Error("Supabase not configured")

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: options.method === "POST" ? "return=representation" : "return=minimal",
      ...options.headers
    }
  })

  return response
}

export const supabaseCache = {
  isConfigured(): boolean {
    return getConfig() !== null
  },

  isAvailable(): boolean {
    return available && this.isConfigured()
  },

  async get(productIdentifier: string): Promise<ComparisonResult | null> {
    if (!this.isAvailable()) return null

    try {
      const response = await supabaseFetch(
        `comparisons?product_identifier=eq.${encodeURIComponent(productIdentifier)}&select=comparison_data,expires_at&limit=1`
      )

      if (!response.ok) {
        throw new Error(`Supabase ${response.status}`)
      }

      const rows = await response.json()
      if (!rows || rows.length === 0) return null

      const row = rows[0]
      if (new Date(row.expires_at) < new Date()) return null

      return row.comparison_data as ComparisonResult
    } catch (err) {
      logger.warn("Supabase get failed, disabling:", err)
      available = false
      return null
    }
  },

  async set(productIdentifier: string, data: ComparisonResult, ttlMs = 4 * 60 * 60 * 1000): Promise<void> {
    if (!this.isAvailable()) return

    try {
      const expiresAt = new Date(Date.now() + ttlMs).toISOString()

      // Upsert
      await supabaseFetch("comparisons", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          product_identifier: productIdentifier,
          comparison_data: data,
          expires_at: expiresAt
        })
      })
    } catch (err) {
      logger.warn("Supabase set failed, disabling:", err)
      available = false
    }
  }
}
