/**
 * Spending guards for the AI partner.
 *
 * These live in memory, so they are per server instance: a firm ceiling on a
 * single long-running server, a best-effort one on serverless hosting where
 * instances come and go. A shared store (Redis or similar) is the next step
 * before opening to the public — see the README.
 */

interface Window {
  count: number;
  resetAt: number;
}

export class FixedWindowLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 20_000,
  ) {}

  /** Returns seconds to wait when over the limit, or 0 when the call may go ahead. */
  hit(key: string, now: number = Date.now()): number {
    if (this.limit <= 0) return 0;
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      if (this.windows.size >= this.maxKeys) this.sweep(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return 0;
    }
    if (current.count >= this.limit) return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    current.count += 1;
    return 0;
  }

  private sweep(now: number) {
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
    // Still full of live keys: drop the oldest to bound memory.
    if (this.windows.size >= this.maxKeys) {
      const drop = Math.ceil(this.maxKeys / 10);
      let i = 0;
      for (const key of this.windows.keys()) {
        if (i++ >= drop) break;
        this.windows.delete(key);
      }
    }
  }
}

/** Remembers recent request keys so a retried or double-sent turn is not paid for twice. */
export class RecentKeys {
  private seen = new Map<string, number>();

  constructor(
    private readonly ttlMs = 2 * 60_000,
    private readonly max = 5_000,
  ) {}

  /** True the first time a key is offered within the window. */
  claim(key: string, now: number = Date.now()): boolean {
    const expires = this.seen.get(key);
    if (expires !== undefined && expires > now) return false;
    if (this.seen.size >= this.max) {
      for (const [k, t] of this.seen) if (t <= now) this.seen.delete(k);
      if (this.seen.size >= this.max) this.seen.clear();
    }
    this.seen.set(key, now + this.ttlMs);
    return true;
  }

  release(key: string) {
    this.seen.delete(key);
  }
}

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Best available client address behind a proxy. Used only as a rate-limit key, never stored. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}
