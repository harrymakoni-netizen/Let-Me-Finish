/**
 * The partner's voice, using the speech synthesis built into the browser.
 * Runs on the device; nothing is sent anywhere to produce it.
 *
 * Lines are queued one sentence at a time so speech can begin while the rest
 * of a reply is still arriving, and `cancel()` silences it instantly — the
 * person can always take the floor.
 */

export interface Speaker {
  speak(text: string): void;
  cancel(): void;
  /** Call inside a tap or key press so browsers allow speech later on. */
  unlock(): void;
  /** True when nothing is being spoken or waiting to be. */
  readonly idle: boolean;
  /** Called each time the queue runs dry. */
  onIdle: (() => void) | null;
}

export interface VoiceChoice {
  voiceURI: string | null;
  rate: number;
  lang: string;
}

export function speechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Voices load asynchronously in most browsers; wait briefly for them. */
export function loadVoices(timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> {
  if (!speechSynthesisAvailable()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", finish);
    setTimeout(finish, timeoutMs);
  });
}

/** English voices, with ones that run on the device first. */
export function englishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith("en"))
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
}

export function pickVoice(voices: SpeechSynthesisVoice[], choice: VoiceChoice): SpeechSynthesisVoice | null {
  if (choice.voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === choice.voiceURI);
    if (chosen) return chosen;
  }
  const english = englishVoices(voices);
  const wanted = choice.lang.toLowerCase();
  return (
    english.find((v) => v.lang.toLowerCase() === wanted && v.default) ??
    english.find((v) => v.lang.toLowerCase() === wanted) ??
    english.find((v) => v.default) ??
    english[0] ??
    null
  );
}

export class BrowserSpeaker implements Speaker {
  onIdle: (() => void) | null = null;
  private queue: string[] = [];
  private current: SpeechSynthesisUtterance | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly synth: SpeechSynthesis,
    private readonly choice: () => VoiceChoice,
  ) {}

  get idle(): boolean {
    return this.current === null && this.queue.length === 0;
  }

  unlock(): void {
    try {
      // A silent utterance inside the gesture satisfies Safari's autoplay rule.
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      this.synth.speak(u);
    } catch {
      /* speech simply stays unavailable */
    }
  }

  speak(text: string): void {
    const clean = text.trim();
    if (!clean) return;
    this.queue.push(clean);
    this.pump();
  }

  cancel(): void {
    this.queue = [];
    this.current = null;
    this.clearWatchdog();
    try {
      this.synth.cancel();
    } catch {
      /* nothing was speaking */
    }
  }

  private pump(): void {
    if (this.current) return;
    const text = this.queue.shift();
    if (text === undefined) {
      this.onIdle?.();
      return;
    }
    const choice = this.choice();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(this.synth.getVoices(), choice);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = choice.lang;
    }
    utterance.rate = choice.rate;

    const finished = () => {
      if (this.current !== utterance) return;
      this.current = null;
      this.clearWatchdog();
      this.pump();
    };
    utterance.onend = finished;
    utterance.onerror = finished;

    this.current = utterance;
    try {
      this.synth.speak(utterance);
    } catch {
      finished();
      return;
    }
    // Some browsers occasionally never report the end of an utterance.
    // Never let that strand the conversation: move on after a generous wait.
    const expectedMs = 3500 + (text.length * 110) / Math.max(0.5, choice.rate);
    this.watchdog = setTimeout(finished, expectedMs);
  }

  private clearWatchdog() {
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }
}
