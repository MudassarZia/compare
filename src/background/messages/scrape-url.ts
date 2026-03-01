import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { ScrapeUrlRequest, ScrapeUrlResponse } from "~types/messages"
import { scrapeQueue } from "~core/scrape-queue"

const handler: PlasmoMessaging.MessageHandler<ScrapeUrlRequest, ScrapeUrlResponse> = async (
  req,
  res
) => {
  const { url } = req.body

  try {
    const html = await scrapeQueue.enqueue(url)
    res.send({ success: true, html })
  } catch (err) {
    res.send({ success: false, error: String(err) })
  }
}

export default handler
