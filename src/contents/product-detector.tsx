import cssText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useState } from "react"

import { CompareButton } from "~components/CompareButton"
import { extractProduct } from "~core/extractors"
import type { ProductData } from "~types/product"
import { isProductPage } from "~utils/url-patterns"
import { logger } from "~utils/logger"
import { sendToBackground } from "@plasmohq/messaging"

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

// Shadow DOM styles
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

// Fixed position bottom-right
export const getOverlayAnchor = () => document.body

export const getShadowHostId = () => "compare-button-host"

function ProductDetector() {
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState<ProductData | null>(null)
  const [visible, setVisible] = useState(false)

  // Check if this is a product page on first render
  useState(() => {
    const url = window.location.href
    if (!isProductPage(url)) {
      logger.debug("Not a product page:", url)
      return
    }

    // Wait for dynamic content to load
    setTimeout(() => {
      const extracted = extractProduct(document, url)
      if (extracted) {
        logger.info("Product detected:", extracted.title)
        setProduct(extracted)
        setVisible(true)
      }
    }, 1500)
  })

  if (!visible || !product) return null

  const handleCompare = async () => {
    setLoading(true)
    window.dispatchEvent(new CustomEvent("compare-loading"))
    try {
      const response = await sendToBackground({
        name: "compare-prices",
        body: { product }
      })
      logger.info("Comparison result:", response)
      // Results will be shown via the comparison-panel CSUI
      // Dispatch a custom event for it to pick up
      window.dispatchEvent(
        new CustomEvent("compare-result", { detail: response })
      )
    } catch (err) {
      logger.error("Comparison failed:", err)
      window.dispatchEvent(
        new CustomEvent("compare-result", {
          detail: { success: false, error: String(err) }
        })
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 2147483647
      }}>
      <CompareButton onClick={handleCompare} loading={loading} />
    </div>
  )
}

export default ProductDetector
