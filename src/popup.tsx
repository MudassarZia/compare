import "./style.css"

import { useEffect, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import type { ComparisonResult } from "~types/product"
import { formatPrice, calcSavingsPercent } from "~utils/price-utils"
import { RETAILERS } from "~types/product"
import type { RetailerKey } from "~types/product"

const storage = new Storage({ area: "local" })

function Popup() {
  const [lastResult, setLastResult] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLastComparison()
  }, [])

  async function loadLastComparison() {
    try {
      const all = await new Promise<Record<string, any>>((resolve) =>
        chrome.storage.local.get(null, (items) => resolve(items))
      )
      const cacheKeys = Object.keys(all).filter((k) => k.startsWith("cache:"))
      let latest: ComparisonResult | null = null
      let latestTime = 0

      for (const key of cacheKeys) {
        const entry = all[key]
        if (entry?.data?.timestamp > latestTime) {
          latest = entry.data
          latestTime = entry.data.timestamp
        }
      }
      setLastResult(latest)
    } catch {
      // ignore
    }
    setLoading(false)
  }

  const cheapest = lastResult?.competitors?.[0]
  const sourcePrice = lastResult?.sourceProduct?.price
  const hasSavings = cheapest && sourcePrice && cheapest.price < sourcePrice

  return (
    <div className="w-80 bg-white">
      {/* Header */}
      <div className="bg-teal-600 text-white px-4 py-3 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <span className="font-bold text-lg">Compare</span>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-2">Loading...</p>
        ) : lastResult ? (
          <>
            {/* Last comparison summary */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Last Comparison</p>
              <p className="text-sm font-medium text-gray-800 line-clamp-2">
                {lastResult.sourceProduct.title}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {sourcePrice ? formatPrice(sourcePrice, lastResult.sourceProduct.currency) : "N/A"}{" "}
                on {getRetailerName(lastResult.sourceProduct.retailer)}
              </p>
            </div>

            {/* Savings highlight */}
            {hasSavings && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                <p className="text-sm font-semibold text-green-700">
                  {calcSavingsPercent(sourcePrice, cheapest.price)}% cheaper on{" "}
                  {getRetailerName(cheapest.retailer)}
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  {formatPrice(cheapest.price, cheapest.currency)} (save{" "}
                  {formatPrice(sourcePrice - cheapest.price)})
                </p>
              </div>
            )}

            {!hasSavings && lastResult.competitors.length > 0 && (
              <p className="text-sm text-gray-500">
                Best price found at current store.
              </p>
            )}

            <p className="text-xs text-gray-400">
              {lastResult.competitors.length} competitor{lastResult.competitors.length !== 1 ? "s" : ""} found &middot;{" "}
              {new Date(lastResult.timestamp).toLocaleString()}
            </p>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">
              Visit a product page on a supported retailer to compare prices.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
              {(["amazon", "walmart", "target", "bestbuy", "ebay", "newegg"] as RetailerKey[]).map(
                (key) => (
                  <span
                    key={key}
                    className="text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: RETAILERS[key].color }}>
                    {RETAILERS[key].name}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={async () => {
              await sendToBackground({ name: "clear-cache" })
              setLastResult(null)
            }}
            className="flex-1 text-sm text-gray-500 hover:text-red-600 text-center py-1">
            Clear Cache
          </button>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="flex-1 text-sm text-teal-600 hover:text-teal-700 text-center py-1">
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}

function getRetailerName(key: RetailerKey): string {
  return RETAILERS[key as keyof typeof RETAILERS]?.name ?? key
}

export default Popup
