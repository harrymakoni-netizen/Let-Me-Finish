import type { MicErrorCode } from "../conversation/machine";

/**
 * Speech recognition for one open turn.
 *
 * The important design decision: a recogniser never decides when a turn is
 * over. It reports words, and it reports when the underlying engine has
 * stopped by itself (engines give up after a few seconds of quiet). The
 * conversation machine decides what happens next — which is always "keep
 * listening" until the person says they have finished.
 */

export type StopReason = "engine" | "no-speech" | "network";

export interface RecognizerHandlers {
  /** Words the engine is still weighing. Replaces the previous interim text. */
  onInterim(text: string): void;
  /** Words the engine has settled on. */
  onFinal(text: string): void;
  /** The engine stopped on its own while we still wanted it listening. */
  onStopped(reason: StopReason): void;
  /** Listening cannot continue (permission, hardware, service). */
  onError(code: MicErrorCode): void;
}

export interface TurnRecognizer {
  readonly kind: "browser" | "ondevice";
  /** Begin, or resume, listening. Safe to call repeatedly. */
  start(): void;
  /**
   * Stop listening. Resolves once the engine has delivered everything it is
   * going to, with any words that could not be delivered through `onFinal`.
   */
  stop(): Promise<string>;
  /** Stop at once and drop anything not yet delivered. */
  abort(): void;
  dispose(): void;
}

// --- Browser speech recognition (Web Speech API) -------------------------------

interface SpeechResultLike {
  isFinal: boolean;
  0?: { transcript: string; confidence?: number };
}
interface SpeechResultEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function browserRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserRecognitionAvailable(): boolean {
  return browserRecognitionCtor() !== null;
}

/** How long to wait for an engine to finish stopping before carrying on without it. */
const STOP_GRACE_MS = 1500;

export class BrowserRecognizer implements TurnRecognizer {
  readonly kind = "browser" as const;
  private engine: SpeechRecognitionLike | null = null;
  private wanted = false;
  private lastError: string | null = null;
  private interim = "";
  private waiters: Array<() => void> = [];
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly Ctor: SpeechRecognitionCtor,
    private readonly lang: string,
    private readonly handlers: RecognizerHandlers,
    /** Android Chrome mishandles continuous mode; there we take one phrase at a time. */
    private readonly continuous: boolean = true,
  ) {}

  start(): void {
    this.wanted = true;
    if (this.engine) return;
    this.lastError = null;
    this.interim = "";

    const engine = new this.Ctor();
    engine.continuous = this.continuous;
    engine.interimResults = true;
    engine.lang = this.lang;
    engine.maxAlternatives = 1;

    engine.onresult = (event) => {
      if (this.engine !== engine) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          if (text.trim()) this.handlers.onFinal(text.trim());
        } else {
          interim += text;
        }
      }
      this.interim = interim.trim();
      this.handlers.onInterim(this.interim);
    };

    engine.onerror = (event) => {
      if (this.engine !== engine) return;
      this.lastError = event.error;
    };

    engine.onend = () => {
      if (this.engine !== engine) return;
      this.engine = null;
      const error = this.lastError;
      this.settle();

      if (!this.wanted) return; // We asked it to stop.

      if (error === "not-allowed" || error === "service-not-allowed") {
        this.wanted = false;
        this.handlers.onError("not-allowed");
        return;
      }
      if (error === "audio-capture") {
        this.wanted = false;
        this.handlers.onError("audio");
        return;
      }
      if (error === "language-not-supported" || error === "bad-grammar") {
        this.wanted = false;
        this.handlers.onError("unavailable");
        return;
      }
      // It gave up by itself (usually after a few seconds of quiet). Any words
      // it was still weighing are kept, and the listener is told so it can
      // start a fresh engine straight away.
      if (this.interim) {
        this.handlers.onFinal(this.interim);
        this.interim = "";
        this.handlers.onInterim("");
      }
      this.handlers.onStopped(error === "network" ? "network" : error === "no-speech" ? "no-speech" : "engine");
    };

    try {
      this.engine = engine;
      engine.start();
    } catch {
      this.engine = null;
      this.wanted = false;
      // Report after the caller has finished its own bookkeeping.
      queueMicrotask(() => this.handlers.onError("unavailable"));
    }
  }

  stop(): Promise<string> {
    this.wanted = false;
    const engine = this.engine;
    if (!engine) return Promise.resolve("");
    return new Promise<string>((resolve) => {
      // The engine normally finalises its pending words and then ends. Those
      // words arrive through onFinal, so there is nothing extra to hand back.
      this.waiters.push(() => resolve(""));
      try {
        engine.stop();
      } catch {
        this.forget(engine);
        return;
      }
      if (this.graceTimer) clearTimeout(this.graceTimer);
      this.graceTimer = setTimeout(() => this.forget(engine), STOP_GRACE_MS);
    });
  }

  abort(): void {
    this.wanted = false;
    const engine = this.engine;
    this.interim = "";
    if (!engine) return;
    this.engine = null;
    engine.onresult = null;
    engine.onerror = null;
    engine.onend = null;
    try {
      engine.abort();
    } catch {
      /* already stopped */
    }
    this.settle();
  }

  dispose(): void {
    this.abort();
  }

  /** Stop waiting on an engine that never reported its end. */
  private forget(engine: SpeechRecognitionLike) {
    if (this.engine !== engine) return;
    this.engine = null;
    engine.onresult = null;
    engine.onerror = null;
    engine.onend = null;
    try {
      engine.abort();
    } catch {
      /* already stopped */
    }
    this.settle();
  }

  private settle() {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve();
  }
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

/** The language tag to recognise in, from the browser's own setting. */
export function recognitionLanguage(): string {
  if (typeof navigator === "undefined") return "en-GB";
  const tag = navigator.language || "en-GB";
  // English only at launch; other languages wait for proper local review.
  return tag.toLowerCase().startsWith("en") ? tag : "en-GB";
}
