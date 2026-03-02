import type { PlasmoMessaging } from "@plasmohq/messaging"
import { cacheManager } from "~core/cache/cache-manager"
import { logger } from "~utils/logger"

const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
  try {
    await cacheManager.clear()
    logger.info("Cache cleared")
    res.send({ success: true })
  } catch (err) {
    logger.error("Failed to clear cache:", err)
    res.send({ success: false, error: String(err) })
  }
}

export default handler
