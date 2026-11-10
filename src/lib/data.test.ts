import { describe, expect, it } from "vitest";
import { applyRevocation, grant, hasConsent, revoke, CONSENTS } from "./consent";
import { buildExport, initialData, parseImport, pruneExpired } from "./data";
import { sessionRecordShape } from "./test-helpers";

const day = 86_400_000;
const now = new Date("2026-11-10T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * day).toISOString();

describe("consent ledger", () => {
  it("is versioned, revocable and re-asked when wording changes", () => {
    let c = grant([], "voice", ago(1));
    expect(hasConsent(c, "voice")).toBe(true);
    c = revoke(c, "voice", ago(0));
    expect(hasConsent(c, "voice")).toBe(false);
    expect(c).toHaveLength(1);
    const stale = [{ id: "x", purpose: "ai" as const, version: "old", grantedAt: ago(5) }];
    expect(hasConsent(stale, "ai")).toBe(false);
    expect(grant(stale, "ai")[0].revokedAt).toBeTruthy();
    expect(CONSENTS.transcripts.required).toBe(false);
  });
  it("revoking transcripts erases saved text", () => {
    const d = initialData(now);
    d.roleplays = [sessionRecordShape({ transcript: [{ id: "1", role: "user", text: "hi", at: ago(1) }] })];
    expect(applyRevocation(d, "transcripts").roleplays[0].transcript).toBeUndefined();
  });
});

describe("retention", () => {
  it("drops transcripts without consent or past the window, keeps the sessions", () => {
    let d = initialData(now);
    d.consents = grant([], "transcripts", ago(60));
    d.roleplays = [sessionRecordShape({ id: "old", endedAt: ago(40), transcript: [] }), sessionRecordShape({ id: "new", endedAt: ago(2), transcript: [] })];
    const r = pruneExpired(d, now);
    expect(r.data.roleplays.find((x) => x.id === "old")?.transcript).toBeUndefined();
    expect(r.data.roleplays.find((x) => x.id === "new")?.transcript).toBeDefined();
    d = { ...d, consents: [] };
    expect(pruneExpired(d, now).data.roleplays.every((x) => x.transcript === undefined)).toBe(true);
  });
  it("removes stale unfinished conversations", () => {
    const d = initialData(now);
    d.activeConversation = { sessionId: "s", scenarioId: "coffee-order", startedAt: ago(3), updatedAt: ago(3), mode: "text", partner: "scripted", messages: [], draft: "" };
    expect(pruneExpired(d, now).data.activeConversation).toBeNull();
  });
});

describe("export and import", () => {
  it("round-trips and rejects other files", () => {
    const d = initialData(now);
    d.goals = [{ id: "g", text: "ring the GP", createdAt: ago(1), updatedAt: ago(1), status: "active" }];
    expect(parseImport(JSON.stringify(buildExport(d, now))).goals[0].text).toBe("ring the GP");
    expect(() => parseImport("nope")).toThrow();
    expect(() => parseImport(JSON.stringify({ app: "other" }))).toThrow();
  });
});
