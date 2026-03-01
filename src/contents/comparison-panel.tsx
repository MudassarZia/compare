import cssText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"

import { ComparisonPanel } from "~components/ComparisonPanel"
import type { ComparePricesResponse } from "~types/messages"
import type { ComparisonResult } from "~types/product"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.amazon.com/*",
    "https://www.amazon.co.uk/*",
    "https://www.walmart.com/*",
    "https://www.target.com/*",
    "https://www.bestbuy.com/*",
    "https://www.ebay.com/*",
    "https://www.newegg.com/*"
  ],
  run_at: "document_idle"
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

export const getShadowHostId = () => "compare-panel-host"

function ComparisonPanelCSUI() {
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleResult = (event: CustomEvent<ComparePricesResponse>) => {
      const response = event.detail
      if (response.success && response.result) {
        setResult(response.result)
        setError(null)
      } else {
        setError(response.error || "Comparison failed")
        setResult(null)
      }
      setIsLoading(false)
      setVisible(true)
    }

    const handleLoading = () => {
      setIsLoading(true)
      setVisible(true)
    }

    window.addEventListener("compare-result", handleResult as EventListener)
    window.addEventListener("compare-loading", handleLoading)

    return () => {
      window.removeEventListener("compare-result", handleResult as EventListener)
      window.removeEventListener("compare-loading", handleLoading)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 2147483646
      }}>
      <ComparisonPanel
        result={result}
        isLoading={isLoading}
        error={error}
        onClose={() => setVisible(false)}
      />
    </div>
  )
}

export default ComparisonPanelCSUI
