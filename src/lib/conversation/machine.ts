import type { ChatMessage } from "../types";

/**
 * The conversation state machine.
 *
 *   IDLE → USER_TURN_OPEN → USER_TURN_READY → AI_RESPONDING → IDLE
 *
 * This file is the product's central promise written as code:
 *
 *  1. Once a person's turn is open it stays open — through silence, blocks,
 *     repetitions, stretched sounds, and the speech engine stopping by itself.
 *     Only the person can close it ("I'm finished"), unless they have
 *     explicitly switched on automatic end-of-turn themselves.
 *  2. The partner never speaks while a turn is open, and stops speaking the
 *     moment the person takes control.
 *  3. Pause and stop work from every state.
 *
 * It is a pure function: (state, event, config) → { state, effects }. All
 * microphone, speech and network work happens elsewhere, driven by `effects`,
 * so every rule above can be tested exhaustively.
 */

export type Phase = "idle" | "user_turn_open" | "user_turn_ready" | "ai_responding" | "ended";

export interface MachineConfig {
  /** Whether a microphone is in play at all. Text mode never emits mic effects. */
  mode: "voice" | "text";
  whoStarts: "partner" | "user";
  /** The partner's scripted first line, when the partner starts. */
  opener?: string;
  /** Open the person's turn automatically once the partner has finished. */
  autoListen: boolean;
  /** Opt-in only. When off, silence can never end a turn. */
  autoEnd: { enabled: boolean; seconds: number };
  reviewBeforeSend: boolean;
  speakReplies: boolean;
}

export type MicErrorCode = "not-allowed" | "unavailable" | "network" | "audio";

export interface MachineError {
  kind: "partner" | "mic";
  message: string;
  canRetry: boolean;
}

export interface ReplyInProgress {
  text: string;
  /** Everything before this index has been handed to the speaker. */
  spokenUpTo: number;
  complete: boolean;
  /** The person asked to speak; skip the rest of the audio. */
  muted: boolean;
  aside: boolean;
  closing: boolean;
  beat?: number;
}

export interface MachineState {
  phase: Phase;
  paused: boolean;
  messages: ChatMessage[];
  /** Words of the open turn so far (recognised or typed). */
  draft: string;
  /** Words the engine has heard but not yet settled on. */
  interim: string;
  /** How the open turn is being entered right now. */
  inputVia: "voice" | "text";
  reply: ReplyInProgress | null;
  /** After "I'm finished": waiting for the final words, or for the person to check them. */
  ready: null | { awaitingTranscript: boolean; empty: boolean };
  error: MachineError | null;
  /** The partner has said its goodbye; the person can carry on or finish. */
  sceneClosed: boolean;
  /** Open the person's turn as soon as the current reply has arrived. */
  openAfterReply: boolean;
}

export type MachineEvent =
  | { type: "START" }
  | { type: "OPEN_TURN"; via?: "voice" | "text" }
  | { type: "SPEECH_INTERIM"; text: string }
  | { type: "SPEECH_FINAL"; text: string }
  | { type: "DRAFT_EDIT"; text: string }
  | { type: "SWITCH_INPUT"; via: "voice" | "text" }
  | { type: "FINISH_TURN" }
  | { type: "SILENCE_ELAPSED"; seconds: number }
  | { type: "RECOGNIZER_STOPPED"; reason: "engine" | "no-speech" | "network" }
  | { type: "MIC_ERROR"; code: MicErrorCode }
  | { type: "TRANSCRIPT_READY"; text?: string }
  | { type: "CONFIRM_SEND"; text?: string }
  | { type: "KEEP_TALKING" }
  | { type: "REPLY_DELTA"; text: string }
  | { type: "REPLY_DONE"; text: string; aside?: boolean; closing?: boolean; beat?: number }
  | { type: "REPLY_FAILED"; message: string; canRetry: boolean }
  | { type: "SPEAKING_DONE" }
  | { type: "RETRY_REPLY" }
  | { type: "EDIT_LAST"; text: string }
  | { type: "DISMISS_ERROR" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" };

export type Effect =
  | { type: "mic.start" }
  /** Stop listening. `finalize` asks for the turn's final words (TRANSCRIPT_READY). */
  | { type: "mic.stop"; finalize: boolean }
  | { type: "mic.discard" }
  | { type: "tts.speak"; text: string }
  | { type: "tts.cancel" }
  | { type: "partner.request" }
  | { type: "partner.abort" }
  | { type: "persist" };

export interface Transition {
  state: MachineState;
  effects: Effect[];
}

export const ASIDE_PREFIX = "Stepping out of the scene for a moment:";

export function initialState(messages: ChatMessage[] = [], draft = ""): MachineState {
  return {
    phase: "idle",
    paused: false,
    messages,
    draft,
    interim: "",
    inputVia: "text",
    reply: null,
    ready: null,
    error: null,
    sceneClosed: false,
    openAfterReply: false,
  };
}

// --- helpers -----------------------------------------------------------------

let messageCounter = 0;
/** Ids only need to be unique within one conversation. */
function messageId(): string {
  messageCounter += 1;
  return `m${Date.now().toString(36)}-${messageCounter}`;
}

function joinWords(a: string, b: string): string {
  const left = a.trimEnd();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

const NON_TERMINAL = /(?:\b(?:mr|mrs|ms|dr|prof|st|vs|etc|no|e\.g|i\.e)|\b[A-Za-z])$/i;

/**
 * Split off the complete sentences in `text` after `from` so they can be
 * spoken while the rest is still arriving. With `final`, the remainder goes too.
 */
export function speakable(text: string, from: number, final: boolean): { chunks: string[]; upTo: number } {
  const chunks: string[] = [];
  let cursor = from;
  const boundary = /[.!?…]+["'”’)\]]*(?:\s+|$)/g;
  boundary.lastIndex = from;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const atEnd = end >= text.length;
    // Mid-stream we cannot know a sentence has ended until something follows it.
    if (atEnd && !final) break;
    const candidate = text.slice(cursor, match.index);
    // "Dr." or an initial is not the end of a sentence.
    if (match[0].trim().startsWith(".") && NON_TERMINAL.test(candidate) && !atEnd) continue;
    const sentence = text.slice(cursor, end).trim();
    if (sentence) chunks.push(sentence);
    cursor = end;
  }
  if (final && cursor < text.length) {
    const rest = text.slice(cursor).trim();
    if (rest) chunks.push(rest);
    cursor = text.length;
  }
  return { chunks, upTo: cursor };
}

function userMessage(text: string, via: "voice" | "text", edited = false): ChatMessage {
  return { id: messageId(), role: "user", text, at: new Date().toISOString(), via, ...(edited ? { edited } : {}) };
}

function partnerMessage(reply: ReplyInProgress): ChatMessage {
  return {
    id: messageId(),
    role: "partner",
    text: reply.text.trim(),
    at: new Date().toISOString(),
    ...(reply.aside ? { aside: true } : {}),
    ...(reply.beat !== undefined ? { beat: reply.beat } : {}),
  };
}

function wantsMic(state: MachineState, config: MachineConfig): boolean {
  return config.mode === "voice" && state.inputVia === "voice";
}

function same(state: MachineState): Transition {
  return { state, effects: [] };
}

/** Open the person's turn. Always silences the partner first. */
function openTurn(state: MachineState, config: MachineConfig, via?: "voice" | "text"): Transition {
  const inputVia: "voice" | "text" = config.mode === "text" ? "text" : (via ?? "voice");
  const next: MachineState = {
    ...state,
    phase: "user_turn_open",
    inputVia,
    interim: "",
    reply: null,
    ready: null,
    openAfterReply: false,
  };
  const effects: Effect[] = [{ type: "tts.cancel" }];
  if (inputVia === "voice" && !state.paused) effects.push({ type: "mic.start" });
  effects.push({ type: "persist" });
  return { state: next, effects };
}

/** What happens once the partner's reply is fully delivered. */
function afterReply(state: MachineState, config: MachineConfig): Transition {
  const base: MachineState = { ...state, reply: null, openAfterReply: false };
  const shouldOpen = state.openAfterReply || config.mode === "text" || config.autoListen;
  if (shouldOpen && !state.paused) return openTurn(base, config, config.mode === "text" ? "text" : "voice");
  return { state: { ...base, phase: "idle" }, effects: [{ type: "persist" }] };
}

function sendTurn(state: MachineState, text: string, edited: boolean): Transition {
  const clean = text.replace(/\s+/g, " ").trim();
  const message = userMessage(clean, state.inputVia, edited);
  return {
    state: {
      ...state,
      phase: "ai_responding",
      messages: [...state.messages, message],
      draft: "",
      interim: "",
      ready: null,
      error: null,
      reply: { text: "", spokenUpTo: 0, complete: false, muted: false, aside: false, closing: false },
    },
    effects: [{ type: "partner.request" }, { type: "persist" }],
  };
}

function speakNew(reply: ReplyInProgress, config: MachineConfig, paused: boolean): { reply: ReplyInProgress; effects: Effect[] } {
  if (!config.speakReplies || reply.muted || paused) return { reply, effects: [] };
  const { chunks, upTo } = speakable(reply.text, reply.spokenUpTo, reply.complete);
  if (chunks.length === 0) return { reply, effects: [] };
  return {
    reply: { ...reply, spokenUpTo: upTo },
    effects: chunks.map((text) => ({ type: "tts.speak", text }) as Effect),
  };
}

// --- the machine -------------------------------------------------------------

export function transition(state: MachineState, event: MachineEvent, config: MachineConfig): Transition {
  // Stop works from anywhere, always.
  if (event.type === "STOP") {
    if (state.phase === "ended") return same(state);
    return {
      state: { ...state, phase: "ended", paused: false, interim: "", reply: null, ready: null, error: null },
      effects: [{ type: "mic.discard" }, { type: "tts.cancel" }, { type: "partner.abort" }, { type: "persist" }],
    };
  }
  if (state.phase === "ended") return same(state);

  // Pause works from anywhere, always.
  if (event.type === "PAUSE") {
    if (state.paused) return same(state);
    const effects: Effect[] = [{ type: "tts.cancel" }];
    if (state.phase === "user_turn_open" && wantsMic(state, config)) effects.push({ type: "mic.stop", finalize: false });
    // On resume the reply is spoken again from the top, so nothing is lost.
    const reply = state.reply ? { ...state.reply, spokenUpTo: 0 } : null;
    return { state: { ...state, paused: true, reply }, effects: [...effects, { type: "persist" }] };
  }

  if (event.type === "RESUME") {
    if (!state.paused) return same(state);
    const resumed: MachineState = { ...state, paused: false };
    if (resumed.phase === "user_turn_open") {
      return { state: resumed, effects: wantsMic(resumed, config) ? [{ type: "mic.start" }] : [] };
    }
    if (resumed.phase === "ai_responding" && resumed.reply) {
      if (resumed.reply.complete && (resumed.reply.muted || !config.speakReplies)) return afterReply(resumed, config);
      const spoken = speakNew(resumed.reply, config, false);
      return { state: { ...resumed, reply: spoken.reply }, effects: spoken.effects };
    }
    return same(resumed);
  }

  switch (event.type) {
    case "START": {
      if (state.phase !== "idle" || state.messages.length > 0 || state.paused) return same(state);
      if (config.whoStarts === "partner") {
        const reply: ReplyInProgress = {
          text: config.opener ?? "",
          spokenUpTo: 0,
          complete: Boolean(config.opener),
          muted: false,
          aside: false,
          closing: false,
          beat: 0,
        };
        if (!reply.complete) {
          // No scripted opener: ask the partner for one.
          return {
            state: { ...state, phase: "ai_responding", reply },
            effects: [{ type: "partner.request" }, { type: "persist" }],
          };
        }
        const withMessage: MachineState = {
          ...state,
          phase: "ai_responding",
          messages: [...state.messages, partnerMessage(reply)],
        };
        if (!config.speakReplies) return afterReply({ ...withMessage, reply }, config);
        const spoken = speakNew(reply, config, false);
        return { state: { ...withMessage, reply: spoken.reply }, effects: [...spoken.effects, { type: "persist" }] };
      }
      return openTurn(state, config);
    }

    case "OPEN_TURN": {
      if (state.paused) return same(state);
      if (state.phase === "idle") return openTurn(state, config, event.via);
      if (state.phase === "ai_responding" && state.reply) {
        // The person takes control: the partner stops talking at once.
        if (state.reply.complete) return openTurn(state, config, event.via);
        return {
          state: { ...state, reply: { ...state.reply, muted: true }, openAfterReply: true },
          effects: [{ type: "tts.cancel" }],
        };
      }
      return same(state);
    }

    case "SPEECH_INTERIM": {
      if (state.phase !== "user_turn_open" || state.inputVia !== "voice") return same(state);
      return same({ ...state, interim: event.text });
    }

    case "SPEECH_FINAL": {
      // Accepted while open, and while the last words are still being collected.
      const collecting = state.phase === "user_turn_ready" && state.ready?.awaitingTranscript;
      if (state.phase !== "user_turn_open" && !collecting) return same(state);
      if (!event.text.trim()) return same({ ...state, interim: "" });
      return { state: { ...state, draft: joinWords(state.draft, event.text), interim: "" }, effects: [{ type: "persist" }] };
    }

    case "DRAFT_EDIT": {
      if (state.phase !== "user_turn_open" && state.phase !== "user_turn_ready") return same(state);
      return { state: { ...state, draft: event.text, interim: "" }, effects: [{ type: "persist" }] };
    }

    case "SWITCH_INPUT": {
      if (state.phase !== "user_turn_open") return same(state);
      if (config.mode === "text" || event.via === state.inputVia) return same(state);
      if (event.via === "text") {
        // Keep everything heard so far, including words not yet settled.
        return {
          state: { ...state, inputVia: "text", draft: joinWords(state.draft, state.interim), interim: "" },
          effects: state.paused ? [] : [{ type: "mic.stop", finalize: false }],
        };
      }
      return {
        state: { ...state, inputVia: "voice", error: state.error?.kind === "mic" ? null : state.error },
        effects: state.paused ? [] : [{ type: "mic.start" }],
      };
    }

    case "FINISH_TURN": {
      // The one way a turn ends by default: the person says so.
      if (state.phase !== "user_turn_open" || state.paused) return same(state);
      if (state.inputVia === "text") {
        // Typed words are already exactly what the person meant: send them.
        if (!state.draft.trim()) return same(state);
        return sendTurn(state, state.draft, false);
      }
      return {
        state: { ...state, phase: "user_turn_ready", ready: { awaitingTranscript: true, empty: false } },
        effects: [{ type: "mic.stop", finalize: true }],
      };
    }

    case "SILENCE_ELAPSED": {
      // Silence is not a signal. It only counts if the person opted in, and
      // never before they have said anything — a block on the first word must
      // not be able to end the turn.
      if (state.phase !== "user_turn_open" || state.paused) return same(state);
      if (!config.autoEnd.enabled || state.inputVia !== "voice") return same(state);
      if (event.seconds < config.autoEnd.seconds) return same(state);
      if (!joinWords(state.draft, state.interim).trim()) return same(state);
      return {
        state: { ...state, phase: "user_turn_ready", ready: { awaitingTranscript: true, empty: false } },
        effects: [{ type: "mic.stop", finalize: true }],
      };
    }

    case "RECOGNIZER_STOPPED": {
      // Speech engines give up after a few seconds of quiet. We do not.
      if (state.phase === "user_turn_open" && !state.paused && wantsMic(state, config)) {
        return { state, effects: [{ type: "mic.start" }] };
      }
      return same(state);
    }

    case "MIC_ERROR": {
      const message =
        event.code === "not-allowed"
          ? "The microphone is blocked for this site. You can type instead, or allow the microphone in your browser settings."
          : event.code === "network"
            ? "Speech recognition needs a connection in this browser. You can type instead, or switch to on-device recognition in Settings."
            : event.code === "audio"
              ? "No microphone was found. You can type instead."
              : "Speech recognition isn’t available right now. You can type instead.";
      const error: MachineError = { kind: "mic", message, canRetry: event.code !== "not-allowed" };
      if (state.phase === "user_turn_open") {
        // The turn stays open and nothing already said is lost.
        return {
          state: { ...state, inputVia: "text", draft: joinWords(state.draft, state.interim), interim: "", error },
          effects: [{ type: "mic.discard" }],
        };
      }
      if (state.phase === "user_turn_ready" && state.ready?.awaitingTranscript) {
        const draft = joinWords(state.draft, state.interim);
        return {
          state: {
            ...state,
            phase: "user_turn_open",
            inputVia: "text",
            draft,
            interim: "",
            ready: null,
            error,
          },
          effects: [{ type: "mic.discard" }],
        };
      }
      return same({ ...state, error });
    }

    case "TRANSCRIPT_READY": {
      if (state.phase !== "user_turn_ready" || !state.ready?.awaitingTranscript) return same(state);
      const text = joinWords(joinWords(state.draft, state.interim), event.text ?? "");
      if (!text.trim()) {
        // Nothing was captured. That is the software's shortfall, not the person's.
        return same({ ...state, draft: "", interim: "", ready: { awaitingTranscript: false, empty: true } });
      }
      if (config.reviewBeforeSend) {
        return same({ ...state, draft: text, interim: "", ready: { awaitingTranscript: false, empty: false } });
      }
      return sendTurn({ ...state, draft: text, interim: "" }, text, false);
    }

    case "CONFIRM_SEND": {
      if (state.phase !== "user_turn_ready" || state.ready?.awaitingTranscript) return same(state);
      const text = (event.text ?? state.draft).trim();
      if (!text) return same(state);
      return sendTurn(state, text, event.text !== undefined && event.text.trim() !== state.draft.trim());
    }

    case "KEEP_TALKING": {
      // "I wasn't finished" — reopen the same turn with everything intact.
      if (state.phase !== "user_turn_ready" || state.ready?.awaitingTranscript) return same(state);
      return openTurn({ ...state }, config, state.inputVia);
    }

    case "REPLY_DELTA": {
      if (state.phase !== "ai_responding" || !state.reply || state.reply.complete) return same(state);
      const reply = { ...state.reply, text: state.reply.text + event.text };
      const spoken = speakNew(reply, config, state.paused);
      return { state: { ...state, reply: spoken.reply }, effects: spoken.effects };
    }

    case "REPLY_DONE": {
      if (state.phase !== "ai_responding" || !state.reply || state.reply.complete) return same(state);
      const streamed = state.reply.text;
      const finalText = event.text.trim();
      // Normally the final text simply completes what has been streaming in.
      // If it differs (the reply was replaced by a safety check), start over.
      const continues = finalText.startsWith(streamed.trimEnd());
      const text = continues && streamed.length > 0 ? streamed.trimEnd() + finalText.slice(streamed.trimEnd().length) : finalText;
      const aside = event.aside ?? text.startsWith(ASIDE_PREFIX);
      const reply: ReplyInProgress = {
        ...state.reply,
        text,
        spokenUpTo: continues ? Math.min(state.reply.spokenUpTo, text.length) : 0,
        complete: true,
        aside,
        closing: Boolean(event.closing),
        beat: event.beat,
      };
      const withMessage: MachineState = {
        ...state,
        messages: [...state.messages, partnerMessage(reply)],
        sceneClosed: state.sceneClosed || reply.closing,
        error: null,
      };
      const spoken = speakNew(reply, config, state.paused);
      const effects: Effect[] = continues ? spoken.effects : [{ type: "tts.cancel" }, ...spoken.effects];
      const nothingToSay = !config.speakReplies || reply.muted;
      if (nothingToSay && !state.paused) return afterReply({ ...withMessage, reply: spoken.reply }, config);
      return { state: { ...withMessage, reply: spoken.reply }, effects: [...effects, { type: "persist" }] };
    }

    case "SPEAKING_DONE": {
      if (state.phase !== "ai_responding" || !state.reply?.complete || state.paused) return same(state);
      return afterReply(state, config);
    }

    case "REPLY_FAILED": {
      if (state.phase !== "ai_responding") return same(state);
      return {
        state: {
          ...state,
          phase: "idle",
          reply: null,
          openAfterReply: false,
          error: { kind: "partner", message: event.message, canRetry: event.canRetry },
        },
        effects: [{ type: "tts.cancel" }, { type: "persist" }],
      };
    }

    case "RETRY_REPLY": {
      if (state.phase !== "idle" || state.paused) return same(state);
      const last = state.messages[state.messages.length - 1];
      const needsOpener = state.messages.length === 0 && config.whoStarts === "partner";
      if (!needsOpener && last?.role !== "user") return same(state);
      return {
        state: {
          ...state,
          phase: "ai_responding",
          error: null,
          reply: { text: "", spokenUpTo: 0, complete: false, muted: false, aside: false, closing: false },
        },
        effects: [{ type: "partner.request" }],
      };
    }

    case "EDIT_LAST": {
      // Correct what was heard, then let the partner answer what was meant.
      if (state.paused) return same(state);
      if (state.phase !== "idle" && state.phase !== "user_turn_open") return same(state);
      const text = event.text.replace(/\s+/g, " ").trim();
      if (!text) return same(state);
      let index = -1;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].role === "user") {
          index = i;
          break;
        }
      }
      if (index === -1) return same(state);
      const kept = state.messages.slice(0, index);
      const original = state.messages[index];
      const effects: Effect[] = [{ type: "tts.cancel" }];
      if (state.phase === "user_turn_open" && wantsMic(state, config)) effects.push({ type: "mic.discard" });
      return {
        state: {
          ...state,
          phase: "ai_responding",
          messages: [...kept, { ...original, text, edited: true }],
          draft: "",
          interim: "",
          ready: null,
          error: null,
          sceneClosed: false,
          reply: { text: "", spokenUpTo: 0, complete: false, muted: false, aside: false, closing: false },
        },
        effects: [...effects, { type: "partner.request" }, { type: "persist" }],
      };
    }

    case "DISMISS_ERROR":
      return same({ ...state, error: null });
  }

  return same(state);
}

/** Count of turns the person has taken. */
export function userTurns(state: Pick<MachineState, "messages">): number {
  return state.messages.filter((m) => m.role === "user").length;
}
