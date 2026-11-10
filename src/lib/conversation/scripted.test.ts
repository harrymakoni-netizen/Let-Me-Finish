import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS, SCENARIOS, getScenario, scenarioFromCustom, scenariosFor } from "../content/scenarios";
import { brokenRule } from "../safety/screen";
import type { ChatMessage } from "../types";
import { ASIDE_PREFIX } from "./machine";
import { scriptedReply } from "./scripted";

let n = 0;
const user = (text: string): ChatMessage => ({ id: `u${n++}`, role: "user", text, at: "2026-11-09T10:00:00Z" });
const partner = (text: string, beat?: number): ChatMessage => ({
  id: `p${n++}`,
  role: "partner",
  text,
  at: "2026-11-09T10:00:00Z",
  ...(beat !== undefined ? { beat } : {}),
});

/** Play a whole scripted scene, answering each line with the given replies. */
function play(scenarioId: string, replies: string[]) {
  const scenario = getScenario(scenarioId)!;
  const messages: ChatMessage[] = [];
  if (scenario.opener) messages.push(partner(scenario.opener, 0));
  const lines = [];
  for (const reply of replies) {
    messages.push(user(reply));
    const line = scriptedReply(scenario, messages, "stammer");
    lines.push(line);
    messages.push({ ...partner(line.text, line.beat), ...(line.aside ? { aside: true } : {}) });
  }
  return { lines, messages, scenario };
}

describe("the scripted partner", () => {
  it("walks through a scene in order and then closes it", () => {
    const { lines, scenario } = play("coffee-order", ["a flat white", "medium", "to take away", "Jamie", "no thanks", "card", "thank you"]);
    expect(lines.slice(0, 6).map((l) => l.text)).toEqual(scenario.beats);
    expect(lines[6]).toMatchObject({ text: scenario.closing, closing: true });
    expect(lines.slice(0, 6).every((l) => !l.closing)).toBe(true);
  });

  it("keeps going politely if the person carries on after the scene ends", () => {
    const { lines } = play("first-hello", ["cycling", "being outdoors", "one more thing", "and another"]);
    expect(lines[1].closing).toBe(true);
    expect(lines[2].text).toBe("Is there anything else you’d like to say?");
    expect(lines[3].text).toBe("Okay.");
  });

  it("repeats itself when asked, without moving on", () => {
    const { lines, scenario } = play("phone-appointment", ["I'd like to book a check-up", "Sorry, could you repeat that?", "Jamie Chen"]);
    expect(lines[0].text).toBe(scenario.beats[0]);
    // This line already opens with "Of course", which must not be doubled.
    expect(lines[1].text).toBe(scenario.beats[0]);
    expect(lines[1].beat).toBe(lines[0].beat);
    expect(lines[2].text).toBe(scenario.beats[1]);

    const coffee = play("coffee-order", ["a flat white", "pardon?"]);
    expect(coffee.lines[1].text).toBe(`Of course. ${coffee.scenario.beats[0]}`);
  });

  it("takes a mention of stammering in its stride, once", () => {
    const { lines, scenario } = play("phone-appointment", ["Hi, I stammer so I might need a moment. I'd like to book a check-up.", "Jamie Chen, and yes I stammer"]);
    expect(lines[0].text).toBe(`No problem at all. ${scenario.beats[0]}`);
    expect(lines[1].text).toBe(scenario.beats[1]);
  });

  it("uses the person's own word for their speech", () => {
    const scenario = getScenario("coffee-order")!;
    const line = scriptedReply(scenario, [partner(scenario.opener!, 0), user("Can you diagnose my stutter?")], "stutter");
    expect(line.aside).toBe(true);
    expect(line.text).toContain("speech-language pathologist");
  });

  it("steps out of the scene for clinical questions and stays on the same line", () => {
    const { lines, scenario } = play("coffee-order", ["Is there a cure for stammering?", "a flat white"]);
    expect(lines[0].text.startsWith(ASIDE_PREFIX)).toBe(true);
    expect(lines[0].aside).toBe(true);
    expect(lines[1].text).toBe(scenario.beats[0]);
  });

  it("answers a crisis disclosure with the fixed support message", () => {
    const { lines } = play("friend-catchup", ["honestly I want to kill myself"]);
    expect(lines[0].aside).toBe(true);
    expect(lines[0].text).toMatch(/emergency number/);
  });

  it("jumps to the goodbye when the person wraps up early", () => {
    const { lines, scenario } = play("customer-service-call", ["Sam", "Actually that's everything, goodbye"]);
    expect(lines[1]).toMatchObject({ text: scenario.closing, closing: true });
  });

  it("speaks first-line when the person opens the scene", () => {
    const scenario = getScenario("incoming-call")!;
    const line = scriptedReply(scenario, [user("Hello?")], "stammer");
    expect(line.text).toBe(scenario.beats[0]);
    expect(line.beat).toBe(1);
  });

  it("can play a scene the person described themselves", () => {
    const scenario = scenarioFromCustom({
      title: "Asking my landlord about the boiler",
      partner: "my landlord",
      setting: "on the doorstep",
      aim: "get a date for the repair",
      channel: "in_person",
      whoStarts: "user",
    });
    const line = scriptedReply(scenario, [user("Hi, the boiler is broken again")], "stammer");
    expect(line.text).toBe(scenario.beats[0]);
  });
});

describe("every scenario", () => {
  it("covers the six roles the blueprint requires", () => {
    const roles = new Set(SCENARIOS.map((s) => s.role));
    for (const role of ["friend", "lecturer", "recruiter", "cashier", "colleague", "phone_agent"]) {
      expect(roles.has(role as never), role).toBe(true);
    }
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(6);
  });

  it("has unique ids and a way to begin", () => {
    const ids = ALL_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ALL_SCENARIOS) {
      if (s.whoStarts === "partner") expect(s.opener, s.id).toBeTruthy();
      else expect(s.userOpensWith, s.id).toBeTruthy();
      expect(s.beats.length, s.id).toBeGreaterThan(0);
      expect(s.brief.length, s.id).toBeGreaterThan(40);
    }
  });

  it("never has the scripted partner hurry anyone or remark on their speech", () => {
    for (const s of ALL_SCENARIOS) {
      // The welcome scene explains how the app works ("there's no rush") in the
      // app's own voice; in-scene characters are held to the contract.
      const lines = s.id === "first-hello" ? [...s.beats, s.closing] : [s.opener ?? "", ...s.beats, s.closing];
      for (const line of lines) expect(brokenRule(line), `${s.id}: ${line}`).toBeNull();
    }
  });

  it("puts the most relevant scenes first for the situations someone chose", () => {
    expect(scenariosFor(["phone_calls"])[0].channel).toBe("phone");
    expect(scenariosFor(["interviews"])[0].id).toBe("job-interview");
    expect(scenariosFor([])).toHaveLength(SCENARIOS.length);
  });
});
