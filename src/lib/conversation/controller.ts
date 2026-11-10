import type { Scenario } from "../content/scenarios";
import { CRISIS_REPLY, suggestsCrisis } from "../safety/screen";
import type { RecognizerHandlers, TurnRecognizer } from "../speech/recognizer";
import type { Speaker } from "../speech/speaker";
import type { ChatMessage, ConversationSnapshot, CustomScenario, ListenerManner, Term } from "../types";
import {
  initialState,
  transition,
  type Effect,
  type MachineConfig,
  type MachineEvent,
  type MachineState,
} from "./machine";
import { PartnerError, UNREACHABLE, requestAiReply, type AiReply, type AiReplyRequest } from "./partner-client";
import { scriptedReply } from "./scripted";

/**
 * Runs a conversation: feeds events to the state machine and carries out the
 * effects it asks for (microphone, voice, partner). All the rules live in the
 * machine; this class only does what it is told.
 */

export interface ConversationSetup {
  sessionId: string;
  scenario: Scenario;
  custom?: CustomScenario;
  journeyId?: string;
  fromDaily?: boolean;
  config: MachineConfig;
  partner: "ai" | "scripted";
  manner: ListenerManner;
  replyLength: "short" | "medium";
  term: Term;
  restore?: ConversationSnapshot | null;
}

export interface ConversationDeps {
  /** Builds a recogniser bound to these handlers, or null when speech input is unavailable. */
  createRecognizer: ((handlers: RecognizerHandlers) => TurnRecognizer | null) | null;
  speaker: Speaker | null;
  persist: (snapshot: ConversationSnapshot) => void;
  /** Swappable for tests. */
  requestAi?: (request: AiReplyRequest) => Promise<AiReply>;
  /** Pause before a scripted line, so it lands like a reply rather than a reflex. */
  scriptedDelayMs?: number;
}

export interface ConversationView {
  machine: MachineState;
  partner: "ai" | "scripted";
  /** A short, calm line about something that changed (e.g. the partner switched). */
  notice: string | null;
  /** Show the support panel alongside the conversation. */
  supportSuggested: boolean;
  startedAt: string;
}

const QUICK_STOP_MS = 1500;
const MAX_QUICK_STOPS = 6;
const MAX_NETWORK_STOPS = 2;

export class ConversationController {
  private state: MachineState;
  private partner: "ai" | "scripted";
  private notice: string | null = null;
  private supportSuggested = false;
  private view: ConversationView;
  private listeners = new Set<() => void>();

  private recognizer: TurnRecognizer | null = null;
  private micGeneration = 0;
  private micStartedAt = 0;
  private quickStops = 0;
  private networkStops = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restarting = false;
  private silenceTimer: ReturnType<typeof setInterval> | null = null;
  private lastSpeechAt = 0;

  private requestSeq = 0;
  private abortPartner: AbortController | null = null;
  private scriptedTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly startedAt: string;
  private disposed = false;

  constructor(
    private readonly setup: ConversationSetup,
    private readonly deps: ConversationDeps,
  ) {
    this.partner = setup.partner;
    const restore = setup.restore;
    this.state = initialState(restore?.messages ?? [], restore?.draft ?? "");
    this.startedAt = restore?.startedAt ?? new Date().toISOString();
    this.supportSuggested = (restore?.messages ?? []).some((m) => m.text === CRISIS_REPLY);
    this.view = this.buildView();

    if (deps.speaker) {
      deps.speaker.onIdle = () => this.afterSpeech();
    }
  }

  // --- reading -----------------------------------------------------------------

  getView = (): ConversationView => this.view;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get config(): MachineConfig {
    return this.setup.config;
  }

  // --- acting ------------------------------------------------------------------

  dispatch = (event: MachineEvent): void => {
    if (this.disposed) return;
    const before = this.state;
    const { state, effects } = transition(before, event, this.setup.config);
    this.state = state;
    if (state !== before) this.publish();
    for (const effect of effects) this.run(effect);
    // The reply may be complete with nothing (left) to say aloud; never strand the turn.
    if (this.state.phase === "ai_responding" && this.state.reply?.complete) this.afterSpeech();
  };

  /** Carry on with the scripted partner (after the AI could not be reached, or by choice). */
  useScriptedPartner(notice?: string): void {
    this.partner = "scripted";
    this.notice = notice ?? null;
    this.publish();
    if (this.state.error?.kind === "partner") this.dispatch({ type: "RETRY_REPLY" });
  }

  dismissNotice(): void {
    if (!this.notice) return;
    this.notice = null;
    this.publish();
  }

  /** Called when the screen is hidden or left: silence everything, keep the words. */
  suspend(): void {
    if (this.state.phase !== "ended") this.dispatch({ type: "PAUSE" });
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
    this.abortPartner?.abort();
    this.recognizer?.dispose();
    this.recognizer = null;
    this.deps.speaker?.cancel();
    if (this.deps.speaker) this.deps.speaker.onIdle = null;
    this.listeners.clear();
  }

  // --- effects -----------------------------------------------------------------

  private run(effect: Effect): void {
    switch (effect.type) {
      case "mic.start":
        return this.micStart();
      case "mic.stop":
        return this.micStop(effect.finalize);
      case "mic.discard":
        return this.micDiscard();
      case "tts.speak":
        this.deps.speaker?.speak(effect.text);
        return;
      case "tts.cancel":
        this.deps.speaker?.cancel();
        return;
      case "partner.request":
        return this.askPartner();
      case "partner.abort":
        this.abortPartner?.abort();
        this.abortPartner = null;
        if (this.scriptedTimer) clearTimeout(this.scriptedTimer);
        return;
      case "persist":
        return this.persist();
    }
  }

  private ensureRecognizer(): TurnRecognizer | null {
    if (this.recognizer) return this.recognizer;
    if (!this.deps.createRecognizer) return null;
    this.recognizer = this.deps.createRecognizer({
      onInterim: (text) => {
        if (text) this.heardSomething();
        this.dispatch({ type: "SPEECH_INTERIM", text });
      },
      onFinal: (text) => {
        this.heardSomething();
        this.dispatch({ type: "SPEECH_FINAL", text });
      },
      onStopped: (reason) => this.engineStopped(reason),
      onError: (code) => {
        this.stopSilenceClock();
        this.dispatch({ type: "MIC_ERROR", code });
      },
    });
    return this.recognizer;
  }

  private micStart(): void {
    const recognizer = this.ensureRecognizer();
    if (!recognizer) {
      this.dispatch({ type: "MIC_ERROR", code: "unavailable" });
      return;
    }
    this.micGeneration += 1;
    this.micStartedAt = Date.now();
    // A fresh engine after a timeout is the same turn: the quiet keeps counting.
    if (!this.restarting) this.lastSpeechAt = Date.now();
    this.restarting = false;
    recognizer.start();
    this.startSilenceClock();
  }

  private micStop(finalize: boolean): void {
    this.stopSilenceClock();
    if (this.restartTimer) clearTimeout(this.restartTimer);
    const generation = ++this.micGeneration;
    const recognizer = this.recognizer;
    const done = (tail: string) => {
      // If listening has been restarted since, these words belong to the past.
      if (generation !== this.micGeneration) return;
      if (finalize) {
        this.dispatch({ type: "TRANSCRIPT_READY", text: tail });
      } else {
        if (tail.trim()) this.dispatch({ type: "SPEECH_FINAL", text: tail });
        this.dispatch({ type: "SPEECH_SETTLED" });
      }
    };
    if (!recognizer) {
      done("");
      return;
    }
    recognizer.stop().then(done, () => done(""));
  }

  private micDiscard(): void {
    this.stopSilenceClock();
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.micGeneration += 1;
    this.recognizer?.abort();
  }

  private heardSomething(): void {
    this.lastSpeechAt = Date.now();
    this.quickStops = 0;
    this.networkStops = 0;
  }

  /**
   * The engine gave up by itself. The turn is still open, so we start a new
   * engine — with a little patience if it keeps failing straight away, and a
   * graceful fall back to typing if it clearly cannot work.
   */
  private engineStopped(reason: "engine" | "no-speech" | "network"): void {
    const livedMs = Date.now() - this.micStartedAt;
    if (reason === "network") this.networkStops += 1;
    this.quickStops = livedMs < QUICK_STOP_MS ? this.quickStops + 1 : 0;

    if (this.networkStops >= MAX_NETWORK_STOPS) {
      this.stopSilenceClock();
      this.dispatch({ type: "MIC_ERROR", code: "network" });
      return;
    }
    if (this.quickStops >= MAX_QUICK_STOPS) {
      this.stopSilenceClock();
      this.dispatch({ type: "MIC_ERROR", code: "unavailable" });
      return;
    }
    const wait = Math.min(1500, this.quickStops * 250);
    if (this.restartTimer) clearTimeout(this.restartTimer);
    const generation = this.micGeneration;
    this.restartTimer = setTimeout(() => {
      if (generation !== this.micGeneration) return;
      this.restarting = true;
      this.dispatch({ type: "RECOGNIZER_STOPPED", reason });
      this.restarting = false;
    }, wait);
  }

  /** Only runs when the person has switched automatic end-of-turn on. */
  private startSilenceClock(): void {
    this.stopSilenceClock();
    if (!this.setup.config.autoEnd.enabled) return;
    this.silenceTimer = setInterval(() => {
      this.dispatch({ type: "SILENCE_ELAPSED", seconds: (Date.now() - this.lastSpeechAt) / 1000 });
    }, 500);
  }

  private stopSilenceClock(): void {
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private askPartner(): void {
    this.abortPartner?.abort();
    if (this.scriptedTimer) clearTimeout(this.scriptedTimer);
    const seq = ++this.requestSeq;
    const messages = this.state.messages;
    const said = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";

    // Checked on the device first, so it works offline and with either partner.
    if (suggestsCrisis(said)) {
      this.supportSuggested = true;
      this.publish();
      this.scriptedTimer = setTimeout(() => {
        if (seq !== this.requestSeq) return;
        this.dispatch({ type: "REPLY_DONE", text: CRISIS_REPLY, aside: true });
      }, 300);
      return;
    }

    if (this.partner === "scripted") {
      this.askScripted(seq, messages);
      return;
    }

    const controller = new AbortController();
    this.abortPartner = controller;
    const request = this.deps.requestAi ?? requestAiReply;
    request({
      sessionId: this.setup.sessionId,
      scenarioId: this.setup.scenario.id,
      custom: this.setup.custom,
      manner: this.setup.manner,
      replyLength: this.setup.replyLength,
      term: this.setup.term,
      messages,
      idempotencyKey: `${messages.length}-${Date.now().toString(36)}-${seq}`,
      signal: controller.signal,
      onDelta: (text) => {
        if (seq !== this.requestSeq) return;
        this.dispatch({ type: "REPLY_DELTA", text });
      },
    }).then(
      (reply) => {
        if (seq !== this.requestSeq) return;
        if (reply.text === CRISIS_REPLY) this.supportSuggested = true;
        this.dispatch({ type: "REPLY_DONE", text: reply.text, aside: reply.aside });
      },
      (error: unknown) => {
        if (seq !== this.requestSeq) return;
        const failure =
          error instanceof PartnerError ? error : new PartnerError("server_error", "Something went wrong.", true);
        if (failure.code === "aborted") return;
        if (UNREACHABLE.has(failure.code)) {
          // No AI partner to reach: carry straight on rather than stalling the turn.
          this.partner = "scripted";
          this.notice =
            failure.code === "offline"
              ? "You’re offline, so the scripted partner has taken over. Your words are safe."
              : "The AI partner isn’t available, so the scripted partner has taken over.";
          this.publish();
          // The scripted line is complete text, so drop any half-arrived reply first.
          this.askScripted(seq, messages);
          return;
        }
        this.dispatch({ type: "REPLY_FAILED", message: failure.message, canRetry: failure.canRetry });
      },
    );
  }

  private askScripted(seq: number, messages: ChatMessage[]): void {
    const delay = this.deps.scriptedDelayMs ?? 500;
    this.scriptedTimer = setTimeout(() => {
      if (seq !== this.requestSeq) return;
      const line = scriptedReply(this.setup.scenario, messages, this.setup.term);
      if (line.text === CRISIS_REPLY) this.supportSuggested = true;
      this.dispatch({ type: "REPLY_DONE", text: line.text, aside: line.aside, closing: line.closing, beat: line.beat });
    }, delay);
  }

  /** The voice has gone quiet: if the reply is complete, it is the person's turn. */
  private afterSpeech(): void {
    const s = this.state;
    if (s.phase !== "ai_responding" || !s.reply?.complete || s.paused) return;
    const speaker = this.deps.speaker;
    if (speaker && this.setup.config.speakReplies && !speaker.idle) return;
    this.dispatch({ type: "SPEAKING_DONE" });
  }

  private persist(): void {
    if (this.state.phase === "ended") return;
    this.deps.persist(this.snapshot());
  }

  snapshot(): ConversationSnapshot {
    return {
      sessionId: this.setup.sessionId,
      scenarioId: this.setup.scenario.id,
      custom: this.setup.custom,
      journeyId: this.setup.journeyId,
      fromDaily: this.setup.fromDaily,
      startedAt: this.startedAt,
      updatedAt: new Date().toISOString(),
      mode: this.setup.config.mode,
      partner: this.partner,
      messages: this.state.messages,
      draft: this.state.draft,
    };
  }

  private buildView(): ConversationView {
    return {
      machine: this.state,
      partner: this.partner,
      notice: this.notice,
      supportSuggested: this.supportSuggested,
      startedAt: this.startedAt,
    };
  }

  private publish(): void {
    this.view = this.buildView();
    for (const listener of this.listeners) listener();
  }

  private clearTimers(): void {
    this.stopSilenceClock();
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.scriptedTimer) clearTimeout(this.scriptedTimer);
  }
}
