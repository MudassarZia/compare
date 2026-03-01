import type { ComparisonResult } from "~types/product"
import { formatPrice } from "~utils/price-utils"
import { ComparisonCard } from "./ComparisonCard"
import { ErrorBanner } from "./ErrorBanner"
import { LoadingSpinner } from "./LoadingSpinner"

interface ComparisonPanelProps {
  result: ComparisonResult | null
  isLoading: boolean
  error: string | null
  onClose: () => void
}

export function ComparisonPanel({ result, isLoading, error, onClose }: ComparisonPanelProps) {
  const cheapest = result?.competitors?.[0]
  const sourcePrice = result?.sourceProduct?.price
  const hasSavings =
    cheapest && sourcePrice && cheapest.price < sourcePrice

  return (
    <div className="w-96 max-h-[80vh] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-teal-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span className="font-semibold">Compare Prices</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white text-xl leading-none">
          &times;
        </button>
      </div>

      {/* Current price banner */}
      {result?.sourceProduct && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
          <p className="text-xs text-gray-500 mb-0.5">Current price on this page</p>
          <p className="text-xl font-bold text-gray-900">
            {sourcePrice ? formatPrice(sourcePrice, result.sourceProduct.currency) : "Price unavailable"}
          </p>
        </div>
      )}

      {/* Savings banner */}
      {hasSavings && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200 shrink-0">
          <p className="text-sm font-semibold text-green-700">
            Save {formatPrice(sourcePrice - cheapest.price)} at{" "}
            {cheapest.retailer.charAt(0).toUpperCase() + cheapest.retailer.slice(1)}!
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && <LoadingSpinner />}

        {error && <ErrorBanner message={error} />}

        {/* Retailer-specific notices */}
        {result?.errors && result.errors.length > 0 && (
          <div className="space-y-1">
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-amber-600">
                Could not check {e.retailer} — {e.message.includes("403") || e.message.includes("429")
                  ? "site may be blocking requests"
                  : "connection failed"}
              </p>
            ))}
          </div>
        )}

        {result && result.competitors.length === 0 && !isLoading && (
          <p className="text-sm text-gray-500 text-center py-4">
            No competitor prices found for this product.
          </p>
        )}

        {result?.competitors.map((competitor, i) => (
          <ComparisonCard
            key={`${competitor.retailer}-${i}`}
            competitor={competitor}
            sourcePrice={sourcePrice ?? null}
          />
        ))}
      </div>

      {/* Footer */}
      {result && (
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 shrink-0 flex justify-between">
          <span>
            {result.cached ? "Cached" : "Fresh"} &middot;{" "}
            {new Date(result.timestamp).toLocaleTimeString()}
          </span>
          <span>{result.competitors.length} results</span>
        </div>
      )}
    </div>
  )
}
