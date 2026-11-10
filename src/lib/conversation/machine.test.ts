import { describe, expect, it } from "vitest";
import {
  ASIDE_PREFIX,
  initialState,
  speakable,
  transition,
  userTurns,
  type Effect,
  type MachineConfig,
  type MachineEvent,
  type MachineState,
} from "./machine";

const voice: MachineConfig = {
  mode: "voice",
  whoStarts: "partner",
  opener: "Hi there! What can I get for you?",
  autoListen: true,
  autoEnd: { enabled: false, seconds: 8 },
  reviewBeforeSend: false,
  speakReplies: true,
};

const text: MachineConfig = { ...voice, mode: "text", speakReplies: false };

/** Run events in order and collect every effect that was asked for. */
function run(config: MachineConfig, events: MachineEvent[], from: MachineState = initialState()) {
  let state = from;
  const effects: Effect[] = [];
  for (const event of events) {
    const result = transition(state, event, config);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const types = (effects: Effect[]) => effects.map((e) => e.type);

/** A voice conversation where the partner has spoken and the person's turn is open. */
function openVoiceTurn(config: MachineConfig = voice): MachineState {
  const { state } = run(config, [{ type: "START" }, { type: "SPEAKING_DONE" }]);
  expect(state.phase).toBe("user_turn_open");
  return state;
}

// Small deterministic random source so failures can be reproduced.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe("the basic turn cycle", () => {
  it("goes idle → partner speaks → turn opens → person finishes → partner responds", () => {
    let { state, effects } = run(voice, [{ type: "START" }]);
    expect(state.phase).toBe("ai_responding");
    expect(state.messages).toHaveLength(1);
    expect(effects.filter((e) => e.type === "tts.speak").map((e) => (e as { text: string }).text)).toEqual([
      "Hi there!",
      "What can I get for you?",
    ]);

    ({ state, effects } = run(voice, [{ type: "SPEAKING_DONE" }], state));
    expect(state.phase).toBe("user_turn_open");
    expect(types(effects)).toContain("mic.start");

    ({ state } = run(voice, [{ type: "SPEECH_FINAL", text: "a flat white" }, { type: "SPEECH_FINAL", text: "please" }], state));
    expect(state.draft).toBe("a flat white please");

    ({ state, effects } = run(voice, [{ type: "FINISH_TURN" }], state));
    expect(state.phase).toBe("user_turn_ready");
    expect(effects).toContainEqual({ type: "mic.stop", finalize: true });

    ({ state, effects } = run(voice, [{ type: "TRANSCRIPT_READY" }], state));
    expect(state.phase).toBe("ai_responding");
    expect(types(effects)).toContain("partner.request");
    expect(state.messages.at(-1)).toMatchObject({ role: "user", text: "a flat white please", via: "voice" });

    ({ state } = run(
      voice,
      [
        { type: "REPLY_DELTA", text: "Sure. What size " },
        { type: "REPLY_DELTA", text: "would you like?" },
        { type: "REPLY_DONE", text: "Sure. What size would you like?" },
        { type: "SPEAKING_DONE" },
      ],
      state,
    ));
    expect(state.phase).toBe("user_turn_open");
    expect(state.messages.map((m) => m.role)).toEqual(["partner", "user", "partner"]);
    expect(userTurns(state)).toBe(1);
  });

  it("lets the person speak first when the scene calls for it", () => {
    const { state, effects } = run({ ...voice, whoStarts: "user", opener: undefined }, [{ type: "START" }]);
    expect(state.phase).toBe("user_turn_open");
    expect(types(effects)).toContain("mic.start");
    expect(state.messages).toHaveLength(0);
  });

  it("waits for a tap to open the turn when automatic listening is off", () => {
    const config = { ...voice, autoListen: false };
    let { state } = run(config, [{ type: "START" }, { type: "SPEAKING_DONE" }]);
    expect(state.phase).toBe("idle");
    ({ state } = run(config, [{ type: "OPEN_TURN" }], state));
    expect(state.phase).toBe("user_turn_open");
  });

  it("works entirely by typing, with no microphone involved", () => {
    const { state, effects } = run(text, [
      { type: "START" },
      { type: "DRAFT_EDIT", text: "A flat white, please." },
      { type: "FINISH_TURN" },
      { type: "REPLY_DONE", text: "Sure. What size?" },
    ]);
    expect(state.phase).toBe("user_turn_open");
    expect(state.messages).toHaveLength(3);
    expect(types(effects).filter((t) => t.startsWith("mic.start") || t === "mic.stop")).toEqual([]);
  });

  it("does not send an empty typed turn", () => {
    const { state } = run(text, [{ type: "START" }, { type: "DRAFT_EDIT", text: "   " }, { type: "FINISH_TURN" }]);
    expect(state.phase).toBe("user_turn_open");
    expect(userTurns(state)).toBe(0);
  });
});

describe("a turn stays open until the person ends it", () => {
  it("ignores silence of any length by default", () => {
    const open = openVoiceTurn();
    for (const seconds of [1, 10, 60, 600, 86_400]) {
      const { state, effects } = run(voice, [{ type: "SILENCE_ELAPSED", seconds }], open);
      expect(state).toBe(open);
      expect(effects).toEqual([]);
    }
  });

  it("ignores silence mid-sentence too, with words already spoken", () => {
    const { state: withWords } = run(voice, [{ type: "SPEECH_FINAL", text: "I would like a" }], openVoiceTurn());
    const { state, effects } = run(voice, [{ type: "SILENCE_ELAPSED", seconds: 3600 }], withWords);
    expect(state.phase).toBe("user_turn_open");
    expect(state.draft).toBe("I would like a");
    expect(effects).toEqual([]);
  });

  it("restarts the speech engine whenever it gives up, without closing the turn", () => {
    const open = openVoiceTurn();
    for (const reason of ["engine", "no-speech", "network"] as const) {
      const { state, effects } = run(voice, [{ type: "RECOGNIZER_STOPPED", reason }], open);
      expect(state.phase).toBe("user_turn_open");
      expect(effects).toEqual([{ type: "mic.start" }]);
    }
  });

  it("keeps the turn open through a long block made of many engine timeouts", () => {
    let state = run(voice, [{ type: "SPEECH_FINAL", text: "My name is" }], openVoiceTurn()).state;
    for (let i = 0; i < 200; i++) {
      const result = run(
        voice,
        [
          { type: "SILENCE_ELAPSED", seconds: i * 8 },
          { type: "RECOGNIZER_STOPPED", reason: "no-speech" },
        ],
        state,
      );
      state = result.state;
      expect(state.phase).toBe("user_turn_open");
      expect(types(result.effects)).toEqual(["mic.start"]);
    }
    expect(state.draft).toBe("My name is");
  });

  it("never closes an open turn on anything except the person's own action (fuzz)", () => {
    // Everything that can happen *to* a turn without the person choosing it.
    const background: MachineEvent[] = [
      { type: "SPEECH_INTERIM", text: "I I I w" },
      { type: "SPEECH_FINAL", text: "c-c-coffee" },
      { type: "SPEECH_FINAL", text: "" },
      { type: "SILENCE_ELAPSED", seconds: 1 },
      { type: "SILENCE_ELAPSED", seconds: 99_999 },
      { type: "RECOGNIZER_STOPPED", reason: "engine" },
      { type: "RECOGNIZER_STOPPED", reason: "no-speech" },
      { type: "RECOGNIZER_STOPPED", reason: "network" },
      { type: "REPLY_DELTA", text: "Hello." },
      { type: "REPLY_DONE", text: "Hello." },
      { type: "REPLY_FAILED", message: "x", canRetry: true },
      { type: "SPEAKING_DONE" },
      { type: "TRANSCRIPT_READY", text: "stray" },
      { type: "CONFIRM_SEND" },
      { type: "KEEP_TALKING" },
      { type: "RETRY_REPLY" },
      { type: "DISMISS_ERROR" },
      { type: "START" },
      { type: "OPEN_TURN" },
      { type: "MIC_ERROR", code: "network" },
      { type: "MIC_ERROR", code: "not-allowed" },
      { type: "DRAFT_EDIT", text: "typed words" },
      { type: "SWITCH_INPUT", via: "text" },
      { type: "SWITCH_INPUT", via: "voice" },
    ];
    const random = rng(20261109);
    for (let trial = 0; trial < 400; trial++) {
      let state = openVoiceTurn();
      for (let step = 0; step < 60; step++) {
        const event = background[Math.floor(random() * background.length)];
        const result = transition(state, event, voice);
        state = result.state;
        expect(state.phase, `trial ${trial} step ${step} after ${event.type}`).toBe("user_turn_open");
        const kinds = types(result.effects);
        expect(kinds).not.toContain("tts.speak");
        expect(kinds).not.toContain("partner.request");
        expect(result.effects).not.toContainEqual({ type: "mic.stop", finalize: true });
      }
    }
  });
});

describe("automatic end of turn is opt-in", () => {
  const optedIn: MachineConfig = { ...voice, autoEnd: { enabled: true, seconds: 5 } };

  it("only ends a turn after the chosen silence, and only once something was said", () => {
    const open = openVoiceTurn(optedIn);
    expect(run(optedIn, [{ type: "SILENCE_ELAPSED", seconds: 4.9 }], open).state.phase).toBe("user_turn_open");
    // A block before the first word must never end the turn.
    expect(run(optedIn, [{ type: "SILENCE_ELAPSED", seconds: 120 }], open).state.phase).toBe("user_turn_open");

    const spoken = run(optedIn, [{ type: "SPEECH_FINAL", text: "A latte" }], open).state;
    expect(run(optedIn, [{ type: "SILENCE_ELAPSED", seconds: 4 }], spoken).state.phase).toBe("user_turn_open");
    const ended = run(optedIn, [{ type: "SILENCE_ELAPSED", seconds: 5 }], spoken);
    expect(ended.state.phase).toBe("user_turn_ready");
    expect(ended.effects).toContainEqual({ type: "mic.stop", finalize: true });
  });

  it("does not apply while the person is typing", () => {
    const typing = run(optedIn, [{ type: "SWITCH_INPUT", via: "text" }, { type: "DRAFT_EDIT", text: "A latte" }], openVoiceTurn(optedIn)).state;
    expect(run(optedIn, [{ type: "SILENCE_ELAPSED", seconds: 999 }], typing).state.phase).toBe("user_turn_open");
  });
});

describe("the partner never talks over the person", () => {
  it("stops speaking immediately when the person takes their turn", () => {
    const speaking = run(voice, [{ type: "START" }]).state;
    const { state, effects } = run(voice, [{ type: "OPEN_TURN" }], speaking);
    expect(state.phase).toBe("user_turn_open");
    const kinds = types(effects);
    expect(kinds.indexOf("tts.cancel")).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf("tts.cancel")).toBeLessThan(kinds.indexOf("mic.start"));
  });

  it("goes quiet mid-reply and opens the turn as soon as the reply has arrived", () => {
    let state = run(voice, [{ type: "START" }, { type: "SPEAKING_DONE" }, { type: "SPEECH_FINAL", text: "hello" }, { type: "FINISH_TURN" }, { type: "TRANSCRIPT_READY" }]).state;
    expect(state.phase).toBe("ai_responding");
    let result = run(voice, [{ type: "REPLY_DELTA", text: "Well, " }, { type: "OPEN_TURN" }], state);
    expect(types(result.effects)).toContain("tts.cancel");
    state = result.state;
    result = run(voice, [{ type: "REPLY_DELTA", text: "that is a long story. It began years ago." }], state);
    expect(types(result.effects)).not.toContain("tts.speak");
    result = run(voice, [{ type: "REPLY_DONE", text: "Well, that is a long story. It began years ago." }], result.state);
    expect(result.state.phase).toBe("user_turn_open");
    expect(types(result.effects)).not.toContain("tts.speak");
    expect(result.state.messages.at(-1)?.text).toBe("Well, that is a long story. It began years ago.");
  });

  it("only ever asks to speak while it is the partner's turn and not paused (fuzz)", () => {
    const all: MachineEvent[] = [
      { type: "START" },
      { type: "OPEN_TURN" },
      { type: "SPEECH_INTERIM", text: "um" },
      { type: "SPEECH_FINAL", text: "words" },
      { type: "DRAFT_EDIT", text: "typed" },
      { type: "SWITCH_INPUT", via: "text" },
      { type: "SWITCH_INPUT", via: "voice" },
      { type: "FINISH_TURN" },
      { type: "SILENCE_ELAPSED", seconds: 30 },
      { type: "RECOGNIZER_STOPPED", reason: "no-speech" },
      { type: "MIC_ERROR", code: "unavailable" },
      { type: "TRANSCRIPT_READY", text: "more" },
      { type: "CONFIRM_SEND" },
      { type: "KEEP_TALKING" },
      { type: "REPLY_DELTA", text: "One sentence. " },
      { type: "REPLY_DONE", text: "One sentence. And another." },
      { type: "REPLY_FAILED", message: "x", canRetry: true },
      { type: "SPEAKING_DONE" },
      { type: "RETRY_REPLY" },
      { type: "EDIT_LAST", text: "what I meant" },
      { type: "DISMISS_ERROR" },
      { type: "PAUSE" },
      { type: "RESUME" },
    ];
    const configs: MachineConfig[] = [
      voice,
      { ...voice, autoListen: false },
      { ...voice, reviewBeforeSend: true },
      { ...voice, autoEnd: { enabled: true, seconds: 5 } },
      { ...voice, whoStarts: "user", opener: undefined },
      { ...text, speakReplies: true },
    ];
    const random = rng(7);
    for (let trial = 0; trial < 600; trial++) {
      const config = configs[trial % configs.length];
      let state = initialState();
      for (let step = 0; step < 80; step++) {
        const event = all[Math.floor(random() * all.length)];
        const before = state;
        const result = transition(state, event, config);
        state = result.state;
        const kinds = types(result.effects);
        if (kinds.includes("tts.speak")) {
          expect(state.phase, `spoke in ${state.phase} after ${event.type}`).toBe("ai_responding");
          expect(state.paused).toBe(false);
          expect(before.phase).not.toBe("user_turn_open");
        }
        if (kinds.includes("mic.start")) {
          expect(state.phase).toBe("user_turn_open");
          expect(state.paused).toBe(false);
          expect(config.mode).toBe("voice");
          // The microphone never opens over the partner's voice.
          const cancelAt = kinds.indexOf("tts.cancel");
          if (before.phase === "ai_responding") expect(cancelAt).toBeGreaterThanOrEqual(0);
        }
        if (config.mode === "text") {
          expect(kinds).not.toContain("mic.start");
          expect(result.effects).not.toContainEqual({ type: "mic.stop", finalize: true });
        }
      }
    }
  });
});

describe("pause and stop always work", () => {
  /** One representative state for each phase. */
  function samples(): Record<string, MachineState> {
    const idle = run({ ...voice, autoListen: false }, [{ type: "START" }, { type: "SPEAKING_DONE" }]).state;
    const open = openVoiceTurn();
    const ready = run(voice, [{ type: "SPEECH_FINAL", text: "hi" }, { type: "FINISH_TURN" }], open).state;
    const responding = run(voice, [{ type: "TRANSCRIPT_READY" }], ready).state;
    return { idle, open, ready, responding, fresh: initialState() };
  }

  it("pauses from every state, silencing the partner and releasing the microphone", () => {
    for (const [name, state] of Object.entries(samples())) {
      const { state: paused, effects } = run(voice, [{ type: "PAUSE" }], state);
      expect(paused.paused, name).toBe(true);
      expect(paused.phase, name).toBe(state.phase);
      expect(types(effects), name).toContain("tts.cancel");
      if (state.phase === "user_turn_open") expect(effects).toContainEqual({ type: "mic.stop", finalize: false });
    }
  });

  it("stops from every state, including while paused", () => {
    for (const [name, state] of Object.entries(samples())) {
      for (const from of [state, run(voice, [{ type: "PAUSE" }], state).state]) {
        const { state: ended, effects } = run(voice, [{ type: "STOP" }], from);
        expect(ended.phase, name).toBe("ended");
        expect(types(effects), name).toEqual(expect.arrayContaining(["mic.discard", "tts.cancel", "partner.abort"]));
      }
    }
  });

  it("does nothing at all once the conversation has ended", () => {
    const ended = run(voice, [{ type: "STOP" }], openVoiceTurn()).state;
    const events: MachineEvent[] = [
      { type: "START" },
      { type: "OPEN_TURN" },
      { type: "SPEECH_FINAL", text: "x" },
      { type: "FINISH_TURN" },
      { type: "REPLY_DONE", text: "x" },
      { type: "RESUME" },
      { type: "PAUSE" },
      { type: "STOP" },
    ];
    for (const event of events) {
      const result = transition(ended, event, voice);
      expect(result.state).toBe(ended);
      expect(result.effects).toEqual([]);
    }
  });

  it("keeps every word across a pause and reopens the microphone on resume", () => {
    const open = run(voice, [{ type: "SPEECH_FINAL", text: "I wanted to ask about" }], openVoiceTurn()).state;
    const paused = run(voice, [{ type: "PAUSE" }, { type: "SPEECH_FINAL", text: "the deadline" }], open).state;
    expect(paused.draft).toBe("I wanted to ask about the deadline");
    const { state, effects } = run(voice, [{ type: "RESUME" }], paused);
    expect(state.paused).toBe(false);
    expect(state.phase).toBe("user_turn_open");
    expect(state.draft).toBe("I wanted to ask about the deadline");
    expect(effects).toEqual([{ type: "mic.start" }]);
  });

  it("cannot finish, open or restart anything while paused", () => {
    const paused = run(voice, [{ type: "SPEECH_FINAL", text: "half a thought" }, { type: "PAUSE" }], openVoiceTurn()).state;
    for (const event of [{ type: "FINISH_TURN" }, { type: "OPEN_TURN" }, { type: "RECOGNIZER_STOPPED", reason: "engine" }] as MachineEvent[]) {
      const result = transition(paused, event, voice);
      expect(result.state.phase).toBe("user_turn_open");
      expect(types(result.effects)).not.toContain("mic.start");
    }
  });

  it("replays the partner's reply from the top after a pause", () => {
    const speaking = run(voice, [{ type: "START" }]).state;
    const paused = run(voice, [{ type: "PAUSE" }, { type: "SPEAKING_DONE" }], speaking).state;
    expect(paused.phase).toBe("ai_responding");
    const { effects } = run(voice, [{ type: "RESUME" }], paused);
    expect(effects.filter((e) => e.type === "tts.speak")).toHaveLength(2);
  });
});

describe("when the words were not captured", () => {
  it("never blames the person or sends an empty turn", () => {
    const ready = run(voice, [{ type: "FINISH_TURN" }], openVoiceTurn());
    const { state, effects } = run(voice, [{ type: "TRANSCRIPT_READY", text: "" }], ready.state);
    expect(state.phase).toBe("user_turn_ready");
    expect(state.ready).toEqual({ awaitingTranscript: false, empty: true });
    expect(types(effects)).not.toContain("partner.request");

    const again = run(voice, [{ type: "KEEP_TALKING" }], state);
    expect(again.state.phase).toBe("user_turn_open");
    expect(types(again.effects)).toContain("mic.start");
  });

  it("lets them type what they said instead", () => {
    const empty = run(voice, [{ type: "FINISH_TURN" }, { type: "TRANSCRIPT_READY", text: "" }], openVoiceTurn()).state;
    const { state } = run(voice, [{ type: "CONFIRM_SEND", text: "A cappuccino please" }], empty);
    expect(state.phase).toBe("ai_responding");
    expect(state.messages.at(-1)).toMatchObject({ role: "user", text: "A cappuccino please" });
  });

  it("includes words the engine had not settled on when the turn ended", () => {
    const { state } = run(
      voice,
      [{ type: "SPEECH_FINAL", text: "Can I book" }, { type: "SPEECH_INTERIM", text: "an appointment" }, { type: "FINISH_TURN" }, { type: "TRANSCRIPT_READY" }],
      openVoiceTurn(),
    );
    expect(state.messages.at(-1)?.text).toBe("Can I book an appointment");
  });

  it("accepts words that arrive just after “I’m finished”", () => {
    const { state } = run(
      voice,
      [{ type: "SPEECH_FINAL", text: "Can I book" }, { type: "FINISH_TURN" }, { type: "SPEECH_FINAL", text: "an appointment" }, { type: "TRANSCRIPT_READY" }],
      openVoiceTurn(),
    );
    expect(state.messages.at(-1)?.text).toBe("Can I book an appointment");
  });
});

describe("checking and correcting the transcript", () => {
  const review: MachineConfig = { ...voice, reviewBeforeSend: true };

  it("holds the turn for checking when asked to", () => {
    const { state, effects } = run(review, [{ type: "SPEECH_FINAL", text: "I'd like a tea" }, { type: "FINISH_TURN" }, { type: "TRANSCRIPT_READY" }], openVoiceTurn(review));
    expect(state.phase).toBe("user_turn_ready");
    expect(state.draft).toBe("I'd like a tea");
    expect(types(effects)).not.toContain("partner.request");

    const sent = run(review, [{ type: "CONFIRM_SEND", text: "I'd like a green tea" }], state).state;
    expect(sent.messages.at(-1)).toMatchObject({ text: "I'd like a green tea", edited: true });
  });

  it("lets the person carry on if they were not finished", () => {
    const held = run(review, [{ type: "SPEECH_FINAL", text: "First" }, { type: "FINISH_TURN" }, { type: "TRANSCRIPT_READY" }], openVoiceTurn(review)).state;
    const { state } = run(review, [{ type: "KEEP_TALKING" }, { type: "SPEECH_FINAL", text: "and second" }], held);
    expect(state.phase).toBe("user_turn_open");
    expect(state.draft).toBe("First and second");
  });

  it("re-asks the partner after the last message is corrected", () => {
    const convo = run(voice, [
      { type: "START" },
      { type: "SPEAKING_DONE" },
      { type: "SPEECH_FINAL", text: "a flat right" },
      { type: "FINISH_TURN" },
      { type: "TRANSCRIPT_READY" },
      { type: "REPLY_DONE", text: "Sorry, a what?" },
      { type: "SPEAKING_DONE" },
    ]).state;
    const { state, effects } = run(voice, [{ type: "EDIT_LAST", text: "a flat white" }], convo);
    expect(state.phase).toBe("ai_responding");
    expect(state.messages.map((m) => m.text)).toEqual(["Hi there! What can I get for you?", "a flat white"]);
    expect(state.messages.at(-1)?.edited).toBe(true);
    expect(types(effects)).toEqual(expect.arrayContaining(["tts.cancel", "partner.request"]));
  });

  it("switches to typing mid-turn without losing what was heard", () => {
    const { state, effects } = run(
      voice,
      [{ type: "SPEECH_FINAL", text: "My address is" }, { type: "SPEECH_INTERIM", text: "fourteen" }, { type: "SWITCH_INPUT", via: "text" }],
      openVoiceTurn(),
    );
    expect(state.inputVia).toBe("text");
    expect(state.draft).toBe("My address is fourteen");
    expect(effects).toContainEqual({ type: "mic.stop", finalize: false });

    const sent = run(voice, [{ type: "DRAFT_EDIT", text: "My address is 14 Mill Lane" }, { type: "FINISH_TURN" }], state).state;
    expect(sent.phase).toBe("ai_responding");
    expect(sent.messages.at(-1)?.text).toBe("My address is 14 Mill Lane");
  });
});

describe("when something goes wrong", () => {
  it("falls back to typing if the microphone fails, keeping the turn and its words", () => {
    const { state } = run(voice, [{ type: "SPEECH_FINAL", text: "Hello I am" }, { type: "MIC_ERROR", code: "not-allowed" }], openVoiceTurn());
    expect(state.phase).toBe("user_turn_open");
    expect(state.inputVia).toBe("text");
    expect(state.draft).toBe("Hello I am");
    expect(state.error?.kind).toBe("mic");
  });

  it("returns the turn to the person if the microphone fails while finishing", () => {
    const { state } = run(voice, [{ type: "SPEECH_FINAL", text: "Hello" }, { type: "FINISH_TURN" }, { type: "MIC_ERROR", code: "unavailable" }], openVoiceTurn());
    expect(state.phase).toBe("user_turn_open");
    expect(state.draft).toBe("Hello");
  });

  it("keeps the person's message and offers a retry if the partner fails", () => {
    const responding = run(voice, [{ type: "SPEECH_FINAL", text: "Hello" }, { type: "FINISH_TURN" }, { type: "TRANSCRIPT_READY" }], openVoiceTurn()).state;
    const failed = run(voice, [{ type: "REPLY_FAILED", message: "No connection", canRetry: true }], responding).state;
    expect(failed.phase).toBe("idle");
    expect(failed.error).toMatchObject({ kind: "partner", canRetry: true });
    expect(failed.messages.at(-1)?.text).toBe("Hello");

    const retried = run(voice, [{ type: "RETRY_REPLY" }], failed);
    expect(retried.state.phase).toBe("ai_responding");
    expect(types(retried.effects)).toContain("partner.request");
  });

  it("asks the partner for an opening line when the scene has none scripted", () => {
    const config: MachineConfig = { ...voice, opener: undefined };
    const { state, effects } = run(config, [{ type: "START" }]);
    expect(state.phase).toBe("ai_responding");
    expect(types(effects)).toContain("partner.request");
    const failed = run(config, [{ type: "REPLY_FAILED", message: "x", canRetry: true }], state).state;
    expect(run(config, [{ type: "RETRY_REPLY" }], failed).state.phase).toBe("ai_responding");
  });

  it("starts the reply over if a safety check replaces it", () => {
    const responding = run(voice, [{ type: "SPEECH_FINAL", text: "Hello" }, { type: "FINISH_TURN" }, { type: "TRANSCRIPT_READY" }], openVoiceTurn()).state;
    const streaming = run(voice, [{ type: "REPLY_DELTA", text: "Bad sentence. More " }], responding).state;
    const { state, effects } = run(voice, [{ type: "REPLY_DONE", text: "Right, okay." }], streaming);
    expect(state.messages.at(-1)?.text).toBe("Right, okay.");
    expect(types(effects)[0]).toBe("tts.cancel");
    expect(effects).toContainEqual({ type: "tts.speak", text: "Right, okay." });
  });
});

describe("marking asides and scene endings", () => {
  it("recognises when the partner steps out of the scene", () => {
    const responding = run(text, [{ type: "START" }, { type: "DRAFT_EDIT", text: "Can you diagnose my stammer?" }, { type: "FINISH_TURN" }]).state;
    const { state } = run(text, [{ type: "REPLY_DONE", text: `${ASIDE_PREFIX} I can't assess speech.` }], responding);
    expect(state.messages.at(-1)?.aside).toBe(true);
  });

  it("notes the end of a scripted scene without ending the conversation", () => {
    const responding = run(text, [{ type: "START" }, { type: "DRAFT_EDIT", text: "Thanks, bye" }, { type: "FINISH_TURN" }]).state;
    const { state } = run(text, [{ type: "REPLY_DONE", text: "Goodbye!", closing: true, beat: 6 }], responding);
    expect(state.sceneClosed).toBe(true);
    expect(state.phase).toBe("user_turn_open");
    expect(state.messages.at(-1)?.beat).toBe(6);
  });
});

describe("speakable()", () => {
  it("releases whole sentences as they complete", () => {
    expect(speakable("Sure. What size would you", 0, false)).toEqual({ chunks: ["Sure."], upTo: 6 });
    expect(speakable("Sure. What size would you like?", 6, false)).toEqual({ chunks: [], upTo: 6 });
    expect(speakable("Sure. What size would you like?", 6, true)).toEqual({ chunks: ["What size would you like?"], upTo: 31 });
  });

  it("does not break after titles or initials", () => {
    const { chunks } = speakable("Good morning, Dr. Okafor is running late. Please take a seat.", 0, true);
    expect(chunks).toEqual(["Good morning, Dr. Okafor is running late.", "Please take a seat."]);
  });

  it("does not split prices and times", () => {
    const { chunks } = speakable("That comes to 4.20 at 3.40 today. Card or cash?", 0, true);
    expect(chunks).toEqual(["That comes to 4.20 at 3.40 today.", "Card or cash?"]);
  });

  it("flushes a trailing fragment only at the end", () => {
    expect(speakable("Okay then", 0, false).chunks).toEqual([]);
    expect(speakable("Okay then", 0, true).chunks).toEqual(["Okay then"]);
  });
});
