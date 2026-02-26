export class DomainRateLimiter {
  private lastRequestTime: Map<string, number> = new Map()
  private minIntervalMs: number

  constructor(minIntervalMs = 1500) {
    this.minIntervalMs = minIntervalMs
  }

  async waitForDomain(url: string): Promise<void> {
    const domain = new URL(url).hostname
    const lastTime = this.lastRequestTime.get(domain) ?? 0
    const elapsed = Date.now() - lastTime

    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed))
    }

    this.lastRequestTime.set(domain, Date.now())
  }
}
