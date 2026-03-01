import type { CompetitorPrice } from "~types/product"
import { RETAILERS } from "~types/product"
import { formatPrice, calcSavingsPercent } from "~utils/price-utils"

interface ComparisonCardProps {
  competitor: CompetitorPrice
  sourcePrice: number | null
}

export function ComparisonCard({ competitor, sourcePrice }: ComparisonCardProps) {
  const retailerInfo = RETAILERS[competitor.retailer as keyof typeof RETAILERS]
  const savingsPercent =
    sourcePrice && sourcePrice > 0
      ? calcSavingsPercent(sourcePrice, competitor.price)
      : null

  const isCheaper = savingsPercent !== null && savingsPercent > 0

  return (
    <a
      href={competitor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-gray-200 rounded-lg p-3 hover:border-teal-300 hover:shadow-sm transition-all bg-white">
      <div className="flex items-start gap-3">
        {competitor.image && (
          <img
            src={competitor.image}
            alt=""
            className="w-12 h-12 object-contain rounded bg-gray-50 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: retailerInfo?.color ?? "#6b7280" }}>
              {retailerInfo?.name ?? competitor.retailer}
            </span>
            {isCheaper && (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {savingsPercent}% less
              </span>
            )}
            {savingsPercent !== null && savingsPercent < 0 && (
              <span className="text-xs text-gray-400">
                {Math.abs(savingsPercent)}% more
              </span>
            )}
          </div>

          <p className="text-sm text-gray-700 line-clamp-2 leading-tight mb-1">
            {competitor.title}
          </p>

          <div className="flex items-center justify-between">
            <span className={`text-lg font-bold ${isCheaper ? "text-green-600" : "text-gray-900"}`}>
              {formatPrice(competitor.price, competitor.currency)}
            </span>

            {/* Confidence indicator */}
            <div className="flex items-center gap-1" title={competitor.matchReasoning ?? undefined}>
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(competitor.matchConfidence * 100)}%`,
                    backgroundColor:
                      competitor.matchConfidence >= 0.8
                        ? "#10b981"
                        : competitor.matchConfidence >= 0.5
                          ? "#f59e0b"
                          : "#ef4444"
                  }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {Math.round(competitor.matchConfidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  )
}
