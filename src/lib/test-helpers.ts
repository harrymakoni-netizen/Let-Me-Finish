import type { RoleplaySession } from "./types";

/** A minimal conversation record for tests. */
export function sessionRecordShape(over: Partial<RoleplaySession> = {}): RoleplaySession {
  return { id: "r", scenarioId: "coffee-order", title: "Coffee", mode: "text", partner: "scripted", startedAt: "2026-11-01T10:00:00Z", endedAt: "2026-11-01T10:05:00Z", userTurns: 2, consentSnapshot: {}, ...over };
}
