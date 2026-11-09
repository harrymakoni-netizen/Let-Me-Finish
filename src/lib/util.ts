import type { Day, ID, ISO } from "./types";

export function newId(): ID {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Older browsers on plain http: good enough for local identifiers.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function nowIso(now: Date = new Date()): ISO {
  return now.toISOString();
}

/** Local calendar day for a moment in time (the person's own day, not UTC). */
export function dayOf(value: Date | ISO = new Date()): Day {
  const d = typeof value === "string" ? new Date(value) : value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: ISO | Date, b: ISO | Date): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / 86_400_000;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "3 Nov", "3 Nov 2025" when the year differs from now. */
export function formatDay(value: ISO | Day | Date, locale?: string): string {
  const d =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return `${rest} sec`;
  if (rest === 0) return `${m} min`;
  return `${m} min ${rest} sec`;
}

/** Trim and collapse whitespace; cap length without cutting mid-surrogate. */
export function tidy(text: string, max = 4000): string {
  const t = text.replace(/\s+/g, " ").trim();
  return Array.from(t).slice(0, max).join("");
}

export function sentenceCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
