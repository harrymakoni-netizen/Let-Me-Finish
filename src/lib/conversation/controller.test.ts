import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getScenario } from "../content/scenarios";
import { CRISIS_REPLY } from "../safety/screen";
import type { RecognizerHandlers, TurnRecognizer } from "../speech/recognizer";
import type { Speaker } from "../speech/speaker";
import type { ConversationSnapshot } from "../types";
import { ConversationController, type ConversationDeps, type ConversationSetup } from "./controller";
import type { MachineConfig } from "./machine";
import { PartnerError, type AiReplyRequest } from "./partner-client";

/** A microphone we can script: say words, go quiet, or have the engine give up. */
class FakeRecognizer implements TurnRecognizer {
  readonly kind = "browser" as const;
  listening = false;
  starts = 0;
  stops = 0;
  aborts = 0;
  constructor(readonly handlers: RecognizerHandlers) {}
  start() {
    this.listening = true;
    this.starts += 1;
  }
  stop() {
    this.listening = false;
    this.stops += 1;
    return Promise.resolve("");
  }
  abort() {
    this.listening = false;
    this.aborts += 1;
  }
  dispose() {
    this.listening = false;
  }
  /** The person says something. */
  hear(text: string) {
    this.handlers.onInterim(text);
    this.handlers.onFinal(text);
  }
  /** The engine times out after a stretch of quiet, as real engines do. */
  timeOut(reason: "engine" | "no-speech" | "network" = "no-speech") {
    this.listening = false;
    this.handlers.onStopped(reason);
  }
}

/** A voice that only finishes speaking when the test says so. */
class FakeSpeaker implements Speaker {
  onIdle: (() => void) | null = null;
  spoken: string[] = [];
  private pending = 0;
  cancels = 0;
  get idle() {
    return this.pending === 0;
  }
  unlock() {}
  speak(text: string) {
    this.spoken.push(text);
    this.pending += 1;
  }
  cancel() {
    this.cancels += 1;
    this.pending = 0;
  }
  finish() {
    this.pending = 0;
    this.onIdle?.();
  }
}

const voiceConfig: MachineConfig = {
  mode: "voice",
  whoStarts: "partner",
  opener: getScenario("coffee-order")!.opener,
  autoListen: true,
  autoEnd: { enabled: false, seconds: 8 },
  reviewBeforeSend: false,
  speakReplies: true,
};

function build(overrides: { config?: Partial<MachineConfig>; setup?: Partial<ConversationSetup>; deps?: Partial<ConversationDeps> } = {}) {
  let recognizer: FakeRecognizer | null = null;
  const speaker = new FakeSpeaker();
  const saved: ConversationSnapshot[] = [];
  const controller = new ConversationController(
    {
      sessionId: "session-1234",
      scenario: getScenario("coffee-order")!,
      config: { ...voiceConfig, ...overrides.config },
      partner: "scripted",
      manner: "warm",
      replyLength: "short",
      term: "stammer",
      ...overrides.setup,
    },
    {
      createRecognizer: (handlers) => (recognizer = new FakeRecognizer(handlers)),
      speaker,
      persist: (snapshot) => saved.push(snapshot),
      scriptedDelayMs: 10,
      ...overrides.deps,
    },
  );
  return {
    controller,
    speaker,
    saved,
    mic: () => recognizer!,
    phase: () => controller.getView().machine.phase,
    state: () => controller.getView().machine,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a spoken conversation, end to end", () => {
  it("speaks the opener, listens, waits, and replies only after “I’m finished”", async () => {
    const t = build();
    t.controller.dispatch({ type: "START" });
    expect(t.speaker.spoken).toEqual(["Hi there!", "What can I get for you?"]);
    expect(t.phase()).toBe("ai_responding");

    t.speaker.finish();
    expect(t.phase()).toBe("user_turn_open");
    expect(t.mic().listening).toBe(true);

    t.mic().hear("a flat white");
    // A long, long quiet. Nothing happens, because nothing should.
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(t.phase()).toBe("user_turn_open");
    expect(t.speaker.spoken).toHaveLength(2);

    t.mic().hear("please");
    t.controller.dispatch({ type: "FINISH_TURN" });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.phase()).toBe("ai_responding");
    expect(t.state().messages.at(-1)).toMatchObject({ role: "user", text: "a flat white please" });

    await vi.advanceTimersByTimeAsync(20);
    expect(t.speaker.spoken.slice(2)).toEqual(["Sure.", "What size would you like — small, medium or large?"]);
    t.speaker.finish();
    expect(t.phase()).toBe("user_turn_open");
    expect(t.mic().listening).toBe(true);
  });

  it("starts a fresh engine every time the old one gives up, for as long as it takes", async () => {
    const t = build();
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("My name is");

    // Thirty engine time-outs in a row — a block lasting several minutes.
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(8_000);
      t.mic().timeOut("no-speech");
      await vi.advanceTimersByTimeAsync(1);
      expect(t.phase()).toBe("user_turn_open");
      expect(t.mic().listening).toBe(true);
    }
    expect(t.mic().starts).toBe(31);
    expect(t.state().draft).toBe("My name is");
    expect(t.state().messages.filter((m) => m.role === "user")).toHaveLength(0);
  });

  it("falls back to typing if the engine cannot stay up at all, keeping the turn", async () => {
    const t = build();
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("I wanted to say");
    // Each new engine dies almost as soon as it starts.
    for (let i = 0; i < 8; i++) {
      t.mic().timeOut("engine");
      await vi.advanceTimersByTimeAsync(1_600);
    }
    expect(t.phase()).toBe("user_turn_open");
    expect(t.state().inputVia).toBe("text");
    expect(t.state().draft).toBe("I wanted to say");
    expect(t.state().error?.kind).toBe("mic");
  });

  it("tells the person plainly when speech recognition needs a connection", async () => {
    const t = build();
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().timeOut("network");
    await vi.advanceTimersByTimeAsync(2_000);
    t.mic().timeOut("network");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(t.state().inputVia).toBe("text");
    expect(t.state().error?.message).toMatch(/needs a connection/);
  });

  it("silences the partner the moment the person takes the floor", () => {
    const t = build();
    t.controller.dispatch({ type: "START" });
    expect(t.speaker.idle).toBe(false);
    t.controller.dispatch({ type: "OPEN_TURN" });
    expect(t.speaker.cancels).toBeGreaterThan(0);
    expect(t.phase()).toBe("user_turn_open");
    expect(t.mic().listening).toBe(true);
  });

  it("pauses and resumes without losing a word, and stop ends everything", async () => {
    const t = build();
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("Could I book");
    t.controller.dispatch({ type: "PAUSE" });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.mic().listening).toBe(false);
    expect(t.state().paused).toBe(true);

    t.controller.dispatch({ type: "RESUME" });
    expect(t.mic().listening).toBe(true);
    t.mic().hear("an appointment");
    expect(t.state().draft).toBe("Could I book an appointment");

    t.controller.dispatch({ type: "STOP" });
    expect(t.phase()).toBe("ended");
    expect(t.mic().listening).toBe(false);
  });

  it("suspends quietly when the screen is hidden", () => {
    const t = build();
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.controller.suspend();
    expect(t.state().paused).toBe(true);
    expect(t.mic().listening).toBe(false);
  });
});

describe("automatic end of turn, when switched on", () => {
  it("measures quiet across engine restarts and never fires before the first word", async () => {
    const t = build({ config: { autoEnd: { enabled: true, seconds: 6 } } });
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();

    // A block on the very first word: a minute of quiet, engines timing out.
    for (let i = 0; i < 7; i++) {
      await vi.advanceTimersByTimeAsync(8_000);
      t.mic().timeOut("no-speech");
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(t.phase()).toBe("user_turn_open");

    t.mic().hear("a latte");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(t.phase()).toBe("user_turn_open");
    await vi.advanceTimersByTimeAsync(1_600);
    expect(t.phase()).toBe("ai_responding");
    expect(t.state().messages.filter((m) => m.role === "user").map((m) => m.text)).toEqual(["a latte"]);
  });
});

describe("the partner", () => {
  it("streams an AI reply sentence by sentence into speech", async () => {
    let request: AiReplyRequest | null = null;
    const t = build({
      setup: { partner: "ai" },
      deps: {
        requestAi: async (r) => {
          request = r;
          r.onDelta("Sure. ");
          r.onDelta("What size would you like? ");
          return { text: "Sure. What size would you like?", aside: false };
        },
      },
    });
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("a flat white");
    t.controller.dispatch({ type: "FINISH_TURN" });
    await vi.advanceTimersByTimeAsync(1);

    expect(request!.messages.map((m) => m.role)).toEqual(["partner", "user"]);
    expect(request!.scenarioId).toBe("coffee-order");
    expect(t.speaker.spoken.slice(2)).toEqual(["Sure.", "What size would you like?"]);
    expect(t.state().messages.at(-1)).toMatchObject({ role: "partner", text: "Sure. What size would you like?" });
  });

  it("hands over to the scripted partner when the AI cannot be reached", async () => {
    const t = build({
      setup: { partner: "ai" },
      deps: {
        requestAi: async () => {
          throw new PartnerError("offline", "You’re offline.", true);
        },
      },
    });
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("a flat white");
    t.controller.dispatch({ type: "FINISH_TURN" });
    await vi.advanceTimersByTimeAsync(50);

    const view = t.controller.getView();
    expect(view.partner).toBe("scripted");
    expect(view.notice).toMatch(/offline/);
    expect(view.machine.messages.at(-1)).toMatchObject({ role: "partner", text: "Sure. What size would you like — small, medium or large?" });
    expect(view.machine.error).toBeNull();
  });

  it("keeps the person's words and offers a retry on other failures", async () => {
    let attempts = 0;
    const t = build({
      setup: { partner: "ai" },
      deps: {
        requestAi: async () => {
          attempts += 1;
          if (attempts === 1) throw new PartnerError("provider_error", "The AI partner had a problem.", true);
          return { text: "Sure. What size?", aside: false };
        },
      },
    });
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("a flat white");
    t.controller.dispatch({ type: "FINISH_TURN" });
    await vi.advanceTimersByTimeAsync(1);
    expect(t.state().error).toMatchObject({ kind: "partner", canRetry: true });
    expect(t.state().messages.at(-1)?.text).toBe("a flat white");

    t.controller.dispatch({ type: "RETRY_REPLY" });
    await vi.advanceTimersByTimeAsync(1);
    expect(t.state().messages.at(-1)?.text).toBe("Sure. What size?");
  });

  it("answers a crisis disclosure itself, without sending it anywhere", async () => {
    const requestAi = vi.fn();
    const t = build({ setup: { partner: "ai" }, deps: { requestAi } });
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("honestly I want to end my life");
    t.controller.dispatch({ type: "FINISH_TURN" });
    await vi.advanceTimersByTimeAsync(400);

    expect(requestAi).not.toHaveBeenCalled();
    expect(t.controller.getView().supportSuggested).toBe(true);
    expect(t.state().messages.at(-1)).toMatchObject({ role: "partner", text: CRISIS_REPLY, aside: true });
  });

  it("ignores a late reply after the conversation has been stopped", async () => {
    let finish: ((r: { text: string; aside: boolean }) => void) | null = null;
    const t = build({
      setup: { partner: "ai" },
      deps: { requestAi: () => new Promise((resolve) => (finish = resolve)) },
    });
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("hello");
    t.controller.dispatch({ type: "FINISH_TURN" });
    await vi.advanceTimersByTimeAsync(1);
    t.controller.dispatch({ type: "STOP" });
    finish!({ text: "Too late.", aside: false });
    await vi.advanceTimersByTimeAsync(1);
    expect(t.phase()).toBe("ended");
    expect(t.state().messages.some((m) => m.text === "Too late.")).toBe(false);
  });
});

describe("typing instead of speaking", () => {
  it("never touches the microphone in text mode", async () => {
    const createRecognizer = vi.fn();
    const t = build({ config: { mode: "text", speakReplies: false }, deps: { createRecognizer } });
    t.controller.dispatch({ type: "START" });
    expect(t.phase()).toBe("user_turn_open");
    t.controller.dispatch({ type: "DRAFT_EDIT", text: "A flat white, please." });
    t.controller.dispatch({ type: "FINISH_TURN" });
    await vi.advanceTimersByTimeAsync(20);
    expect(t.state().messages).toHaveLength(3);
    expect(createRecognizer).not.toHaveBeenCalled();
  });

  it("moves on by itself when there is no voice to wait for", async () => {
    const t = build({ config: { speakReplies: true }, deps: { speaker: null } });
    t.controller.dispatch({ type: "START" });
    expect(t.phase()).toBe("user_turn_open");
  });
});

describe("recovering a conversation", () => {
  it("saves as it goes and restores messages and unfinished words", async () => {
    const t = build();
    t.controller.dispatch({ type: "START" });
    t.speaker.finish();
    t.mic().hear("half a sentence");
    const last = t.saved.at(-1)!;
    expect(last.draft).toBe("half a sentence");
    expect(last.messages).toHaveLength(1);

    const restored = build({ setup: { restore: last } });
    expect(restored.state().messages).toHaveLength(1);
    expect(restored.state().draft).toBe("half a sentence");
    expect(restored.phase()).toBe("idle");
    restored.controller.dispatch({ type: "OPEN_TURN" });
    expect(restored.phase()).toBe("user_turn_open");
    restored.mic().hear("and the rest");
    expect(restored.state().draft).toBe("half a sentence and the rest");
  });
});
