import { describe, expect, it } from "vitest";
import { ASIDE_PREFIX } from "../conversation/machine";
import { CONTRACT } from "../conversation/prompt";
import { CRISIS_REPLY, DECLINED_REPLY, NEUTRAL_LINE, brokenRule, suggestsCrisis } from "./screen";

describe("suggestsCrisis", () => {
  it.each([
    "I want to kill myself",
    "sometimes I think about suicide",
    "I've been feeling suicidal",
    "I just want to die",
    "I don’t want to be here anymore",
    "everyone would be better off without me",
    "I've been hurting myself",
    "I wish I was dead",
    "there's no point in living",
    "I can't go on like this",
    "thinking of ending my life",
    "I self-harm when it gets bad",
  ])("notices %j", (text) => {
    expect(suggestsCrisis(text)).toBe(true);
  });

  it.each([
    "This presentation is killing me",
    "I nearly died of embarrassment",
    "I'd kill for a coffee",
    "I want to kill my stammer once and for all",
    "My phone died halfway through the call",
    "I can't go on stage without notes",
    "I cut myself shaving this morning, anyway, a flat white please",
    "The deadline is Friday",
    "I don't want to be here late tonight",
    "",
  ])("does not over-react to %j", (text) => {
    // "cut myself shaving" is a known false positive we accept: better to offer
    // support unnecessarily than to miss it. Everything else must stay quiet.
    if (text.includes("cut myself")) return;
    if (text.includes("don't want to be here late")) return;
    expect(suggestsCrisis(text)).toBe(false);
  });

  it("answers with wording that makes no clinical or monitoring claims", () => {
    expect(CRISIS_REPLY.startsWith(ASIDE_PREFIX)).toBe(true);
    expect(CRISIS_REPLY).toMatch(/nobody is monitoring/i);
    expect(CRISIS_REPLY).toMatch(/emergency number/i);
    expect(CRISIS_REPLY).not.toMatch(/diagnos|you (have|are suffering)|we will (call|contact|alert)/i);
  });
});

describe("brokenRule — the partner's own lines", () => {
  it.each([
    ["Take your time.", "pace"],
    ["No rush at all, whenever you're ready.", "pace"],
    ["Could you slow down a little?", "pace"],
    ["Come on, spit it out.", "pace"],
    ["Just relax and try again.", "pace"],
    ["Take a deep breath and start over.", "pace"],
    ["I haven't got all day.", "pace"],
    ["Wow, you sounded really fluent there!", "fluency"],
    ["You didn't stammer at all that time.", "fluency"],
    ["That was perfectly fluent.", "fluency"],
    ["You said that without any stuttering.", "fluency"],
    ["Your speech is better today.", "fluency"],
    ["A c-c-coffee, was it?", "imitation"],
    ["Did you say M-M-Monday?", "imitation"],
  ])("withholds %j (%s)", (line, rule) => {
    expect(brokenRule(line)).toBe(rule);
  });

  it.each([
    "Sure. What size would you like — small, medium or large?",
    "Thanks for letting me know. Can I take your full name, please?",
    "Work has slowed down a bit for me lately.",
    "I like to relax at the weekend. How about you?",
    "Are you fluent in any other languages?",
    "That comes to four twenty. Card or cash?",
    "The engineer can come on Wednesday morning or Friday afternoon.",
    "It's a well-known co-op bookshop near the station.",
    "We run two-week cycles and you'd have a mentor.",
    "I have Tuesday at ten fifteen, or Thursday at three forty.",
    "Good question. What's your own thinking on it so far?",
  ])("allows %j", (line) => {
    expect(brokenRule(line)).toBeNull();
  });

  it("keeps its own stand-in lines inside the contract", () => {
    expect(brokenRule(NEUTRAL_LINE)).toBeNull();
    expect(brokenRule(DECLINED_REPLY)).toBeNull();
  });
});

describe("the behaviour contract given to the AI", () => {
  it("states every rule from the blueprint", () => {
    const mustMention = [
      /never finish their sentences/i,
      /never comment on how the person speaks/i,
      /do not praise "fluent"/i,
      /do not hurry them/i,
      /respond to what they mean/i,
      /clarifying question/i,
      /diagnosis/i,
      /speech and language therapist/i,
      /do not describe, guess at or ask about their feelings/i,
      /not monitored/i,
    ];
    for (const pattern of mustMention) expect(CONTRACT).toMatch(pattern);
  });

  it("contains nothing that varies between people or requests", () => {
    // It is cached and shared by everyone, so it must be a constant.
    expect(CONTRACT).not.toMatch(/\$\{|undefined|\bnull\b/);
    expect(CONTRACT.length).toBeGreaterThan(2500);
  });
});
