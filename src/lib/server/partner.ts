import { ALL_SCENARIOS, CUSTOM_SCENARIO_ID, scenarioFromCustom, type Scenario } from "../content/scenarios";
import { ASIDE_PREFIX, speakable } from "../conversation/machine";
import { brokenRule, type ContractRule } from "../safety/screen";
import type { CustomScenario, ListenerManner, Term } from "../types";

/**
 * Server-side pieces of the AI partner that do not need the network:
 * request validation, model capabilities, and the sentence-by-sentence check
 * that keeps every line inside the behaviour contract before it is sent on.
 */

// --- Request -----------------------------------------------------------------

export interface TurnRequest {
  scenario: Scenario;
  custom?: CustomScenario;
  manner: ListenerManner;
  replyLength: "short" | "medium";
  term: Term;
  messages: { role: "user" | "partner"; text: string }[];
}

export const LIMITS = {
  maxMessages: 120,
  maxMessageChars: 2_000,
  maxBodyBytes: 200_000,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length <= max ? v : null;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Returns the parsed request, or a short reason it was rejected. */
export function parseTurnRequest(body: unknown): TurnRequest | { error: string } {
  if (!isRecord(body)) return { error: "Body must be a JSON object." };

  const scenarioId = str(body.scenarioId, 64);
  if (!scenarioId) return { error: "scenarioId is required." };

  let scenario: Scenario | undefined;
  let custom: CustomScenario | undefined;
  if (scenarioId === CUSTOM_SCENARIO_ID) {
    if (!isRecord(body.custom)) return { error: "custom scene details are required." };
    const title = str(body.custom.title, 140) ?? "";
    const partner = str(body.custom.partner, 200);
    const setting = str(body.custom.setting, 400) ?? "";
    const aim = str(body.custom.aim, 400) ?? "";
    if (!partner || !partner.trim()) return { error: "custom.partner is required." };
    custom = {
      title,
      partner,
      setting,
      aim,
      channel: oneOf(body.custom.channel, ["in_person", "phone"] as const, "in_person"),
      whoStarts: oneOf(body.custom.whoStarts, ["partner", "user"] as const, "partner"),
    };
    scenario = scenarioFromCustom(custom);
  } else {
    scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return { error: "Unknown scenario." };
  }

  if (!Array.isArray(body.messages)) return { error: "messages must be an array." };
  if (body.messages.length > LIMITS.maxMessages) return { error: "This conversation is too long." };
  const messages: TurnRequest["messages"] = [];
  for (const raw of body.messages) {
    if (!isRecord(raw)) return { error: "Each message must be an object." };
    if (raw.role !== "user" && raw.role !== "partner") return { error: "Unknown message role." };
    const text = str(raw.text, LIMITS.maxMessageChars);
    if (text === null) return { error: "A message is too long." };
    if (!text.trim()) continue;
    messages.push({ role: raw.role, text: text.trim() });
  }
  if (messages.length > 0 && messages[messages.length - 1].role !== "user") {
    return { error: "The last message must be from the person." };
  }

  return {
    scenario,
    custom,
    manner: oneOf(body.manner, ["warm", "neutral", "brisk"] as const, "warm"),
    replyLength: oneOf(body.replyLength, ["short", "medium"] as const, "short"),
    term: oneOf(body.term, ["stammer", "stutter"] as const, "stammer"),
    messages,
  };
}

// --- Models ------------------------------------------------------------------

export interface ModelCapabilities {
  /** Accepts `output_config.effort`. */
  effort: boolean;
  /** Supports server-side refusal fallbacks. */
  fallbacks: boolean;
  /** Accepts a `system` message in the middle of a conversation. */
  midConversationSystem: boolean;
}

const KNOWN_MODELS: Record<string, ModelCapabilities> = {
  "claude-opus-5-5": { effort: true, fallbacks: true, midConversationSystem: true },
  "claude-sonnet-5-5": { effort: true, fallbacks: true, midConversationSystem: true },
  "claude-fable-5-2": { effort: true, fallbacks: true, midConversationSystem: true },
  "claude-haiku-5-5": { effort: true, fallbacks: false, midConversationSystem: true },
};

export const DEFAULT_MODEL = "claude-opus-5-5";

export function capabilitiesFor(model: string): ModelCapabilities {
  // An unfamiliar model gets the plainest possible request.
  return KNOWN_MODELS[model] ?? { effort: false, fallbacks: false, midConversationSystem: false };
}

export type Effort = "low" | "medium" | "high";

export function partnerConfig(env: Record<string, string | undefined> = process.env) {
  const model = env.LMF_AI_MODEL?.trim() || DEFAULT_MODEL;
  const effort = oneOf<Effort>(env.LMF_AI_EFFORT, ["low", "medium", "high"], "low");
  return {
    apiKey: env.ANTHROPIC_API_KEY?.trim() || null,
    model,
    effort,
    capabilities: capabilitiesFor(model),
  };
}

// --- Checking each line before it goes out ------------------------------------

/**
 * Collects the reply as it streams in and releases it one whole sentence at a
 * time, each checked against the behaviour contract. The first sentence that
 * breaks a rule stops the reply: nothing after it is ever released.
 */
export class ReplyAssembler {
  private buffer = "";
  private upTo = 0;
  private released: string[] = [];
  blocked: ContractRule | null = null;

  get text(): string {
    return this.released.join(" ");
  }

  get isAside(): boolean {
    return this.buffer.trimStart().startsWith(ASIDE_PREFIX);
  }

  push(delta: string): string[] {
    if (this.blocked) return [];
    // Leading whitespace would throw off the client's bookkeeping.
    this.buffer += this.buffer.length === 0 ? delta.trimStart() : delta;
    return this.release(false);
  }

  end(): string[] {
    if (this.blocked) return [];
    return this.release(true);
  }

  private release(final: boolean): string[] {
    const { chunks, upTo } = speakable(this.buffer, this.upTo, final);
    const out: string[] = [];
    for (const sentence of chunks) {
      const rule = brokenRule(sentence);
      // Out of character the partner may talk about pace or speech (to decline
      // to judge it, say) — but it may never imitate a stammer.
      const applies = rule !== null && (!this.isAside || rule === "imitation");
      if (applies) {
        this.blocked = rule;
        break;
      }
      out.push(sentence);
    }
    this.upTo = upTo;
    this.released.push(...out);
    return out;
  }
}

/** Check a complete piece of text in one go. Returns the clean opening part of it. */
export function cleanPrefix(text: string): { text: string; blocked: ContractRule | null } {
  const assembler = new ReplyAssembler();
  assembler.push(text);
  assembler.end();
  return { text: assembler.text, blocked: assembler.blocked };
}

export const REGENERATE_REMINDER =
  "Your draft reply was withheld because it remarked on the person's pace or fluency, or imitated their speech. Reply again in character without any such remark. Respond only to what they meant.";
