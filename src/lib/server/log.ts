/**
 * Structured server logs: one JSON object per line, ready for any log drain.
 *
 * Rule: never log what a person said, what the partner replied, or anything
 * that identifies them. Counts, durations, model names and error codes only.
 */

type Fields = Record<string, string | number | boolean | null | undefined>;

export function logEvent(event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...fields });
  console.log(line);
}

/** USD per million tokens, for a rough running cost in the logs. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-fable-5-2": { input: 8, output: 40, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export function estimateCostUsd(
  model: string,
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number },
): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const cost =
    (usage.input * p.input + usage.cacheWrite * p.input * 1.25 + usage.cacheRead * p.cacheRead + usage.output * p.output) /
    1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
