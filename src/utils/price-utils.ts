/** Parse a price string into a numeric value. Handles US ($1,299.99) and EU (1.299,99 EUR) formats. */
export function parsePrice(raw: string): { price: number; currency: string } | null {
  if (!raw || typeof raw !== "string") return null

  const cleaned = raw.trim()

  // Detect currency
  let currency = "USD"
  if (cleaned.includes("€") || cleaned.includes("EUR")) currency = "EUR"
  else if (cleaned.includes("£") || cleaned.includes("GBP")) currency = "GBP"
  else if (cleaned.includes("¥") || cleaned.includes("JPY")) currency = "JPY"
  else if (cleaned.includes("$") || cleaned.includes("USD")) currency = "USD"
  else if (cleaned.includes("CAD") || cleaned.includes("C$")) currency = "CAD"

  // Strip currency symbols and letters
  let numeric = cleaned.replace(/[^0-9.,]/g, "")

  if (!numeric) return null

  // Determine decimal format
  // EU style: 1.299,99 (dots as thousands, comma as decimal)
  // US style: 1,299.99 (commas as thousands, dot as decimal)
  const lastComma = numeric.lastIndexOf(",")
  const lastDot = numeric.lastIndexOf(".")

  if (lastComma > lastDot) {
    // EU format: comma is decimal separator
    numeric = numeric.replace(/\./g, "").replace(",", ".")
  } else {
    // US format or no ambiguity
    numeric = numeric.replace(/,/g, "")
  }

  const price = parseFloat(numeric)
  if (isNaN(price) || price < 0) return null

  return { price, currency }
}

/** Format a price for display */
export function formatPrice(price: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(price)
}

/** Calculate savings percentage */
export function calcSavingsPercent(sourcePrice: number, competitorPrice: number): number {
  if (sourcePrice <= 0) return 0
  return Math.round(((sourcePrice - competitorPrice) / sourcePrice) * 100)
}
