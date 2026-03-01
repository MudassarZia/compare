/** Wait for a fixed number of milliseconds */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Wait for a random duration between min and max milliseconds */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs)
  return delay(ms)
}
