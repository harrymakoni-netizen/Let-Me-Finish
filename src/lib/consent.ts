import type { AppData, ConsentPurpose, ConsentRecord } from "./types";
import { newId, nowIso } from "./util";

/**
 * The consent ledger.
 *
 * Each purpose is asked for separately, in plain language, and can be taken
 * back at any time. Records are never edited or removed: granting adds a
 * record, revoking stamps it, and a changed wording (new version) asks again.
 */

export interface ConsentDefinition {
  purpose: ConsentPurpose;
  version: string;
  title: string;
  /** One or two plain sentences. `{stammer}` style placeholders are allowed. */
  summary: string;
  /** The specifics, as short bullet points. */
  details: string[];
  /** What changes when this is switched off. */
  whenOff: string;
  required: boolean;
}

export const CONSENTS: Record<ConsentPurpose, ConsentDefinition> = {
  core: {
    purpose: "core",
    version: "2026-11-09",
    title: "Using Let Me Finish",
    summary:
      "I am 18 or over, and I understand this is a practice companion — not a medical service, a diagnosis or a treatment.",
    details: [
      "What you add (goals, reflections, settings) is saved on this device only, unless you create an account.",
      "There are no adverts, no tracking and no selling of data.",
      "Nothing here replaces a qualified {therapist}. The learning content is still awaiting independent clinical review.",
      "You can export or delete everything at any time in Settings.",
    ],
    whenOff: "Withdrawing this ends your use of the app and deletes your data from this device.",
    required: true,
  },
  voice: {
    purpose: "voice",
    version: "2026-11-09",
    title: "Using my microphone",
    summary:
      "Let my speech be turned into text so I can practise out loud. My audio is never saved by Let Me Finish.",
    details: [
      "On-device mode: your speech is recognised on your own device and never leaves it. It needs a one-off download.",
      "Browser mode: your browser's speech service turns audio into text. In Chrome and Safari that usually means the audio is processed by Google or Apple while you speak.",
      "Either way we do not record, store or analyse your voice, and we never measure or score how you speak.",
      "You can always type instead.",
    ],
    whenOff: "The microphone is switched off everywhere. You can still practise by typing.",
    required: false,
  },
  ai: {
    purpose: "ai",
    version: "2026-11-09",
    title: "Talking with the AI partner",
    summary:
      "Send the words of my practice conversations to an AI service so it can reply in character.",
    details: [
      "Only the conversation text and the scenario are sent — never audio, your name, your profile or your reflections.",
      "The text is processed by the AI provider (Anthropic) to produce each reply. We do not use your conversations to train AI models.",
      "The AI is instructed never to interrupt, finish your words, or comment on how you speak. It can still make mistakes — you can flag any reply.",
      "Without this you still get a scripted partner that works offline.",
    ],
    whenOff: "Conversations use the scripted partner only. Nothing is sent to an AI service.",
    required: false,
  },
  transcripts: {
    purpose: "transcripts",
    version: "2026-11-09",
    title: "Keeping conversation transcripts",
    summary: "Save the text of my practice conversations on this device so I can read them back.",
    details: [
      "Off by default. When off, a conversation's text is removed as soon as you end it.",
      "Saved transcripts stay on this device and are deleted automatically after the period you choose.",
      "You can delete them all at any time.",
    ],
    whenOff: "Saved transcripts are deleted and no new ones are kept.",
    required: false,
  },
};

export const CONSENT_ORDER: ConsentPurpose[] = ["core", "voice", "ai", "transcripts"];

/** The record currently in force for a purpose, if any. */
export function activeConsent(
  consents: ConsentRecord[],
  purpose: ConsentPurpose,
): ConsentRecord | undefined {
  const current = CONSENTS[purpose].version;
  // Latest grant wins; it must be unrevoked and for the current wording.
  for (let i = consents.length - 1; i >= 0; i--) {
    const c = consents[i];
    if (c.purpose !== purpose) continue;
    if (c.revokedAt) return undefined;
    return c.version === current ? c : undefined;
  }
  return undefined;
}

export function hasConsent(consents: ConsentRecord[], purpose: ConsentPurpose): boolean {
  return activeConsent(consents, purpose) !== undefined;
}

/** A consent was given for older wording and needs asking again. */
export function needsReconsent(consents: ConsentRecord[], purpose: ConsentPurpose): boolean {
  for (let i = consents.length - 1; i >= 0; i--) {
    const c = consents[i];
    if (c.purpose !== purpose) continue;
    return !c.revokedAt && c.version !== CONSENTS[purpose].version;
  }
  return false;
}

export function grant(
  consents: ConsentRecord[],
  purpose: ConsentPurpose,
  at: string = nowIso(),
): ConsentRecord[] {
  if (hasConsent(consents, purpose)) return consents;
  // Close any stale grant (older wording) before adding the new one.
  const closed = consents.map((c) =>
    c.purpose === purpose && !c.revokedAt ? { ...c, revokedAt: at } : c,
  );
  return [...closed, { id: newId(), purpose, version: CONSENTS[purpose].version, grantedAt: at }];
}

export function revoke(
  consents: ConsentRecord[],
  purpose: ConsentPurpose,
  at: string = nowIso(),
): ConsentRecord[] {
  return consents.map((c) =>
    c.purpose === purpose && !c.revokedAt ? { ...c, revokedAt: at } : c,
  );
}

/** Versions in force right now — stored with each session as its consent snapshot. */
export function consentSnapshot(
  consents: ConsentRecord[],
): Partial<Record<ConsentPurpose, string>> {
  const out: Partial<Record<ConsentPurpose, string>> = {};
  for (const p of CONSENT_ORDER) {
    const c = activeConsent(consents, p);
    if (c) out[p] = c.version;
  }
  return out;
}

/**
 * Side effects of withdrawing a consent, applied to the data itself so that
 * "off" really means off.
 */
export function applyRevocation(data: AppData, purpose: ConsentPurpose): AppData {
  switch (purpose) {
    case "voice":
      return {
        ...data,
        profile: { ...data.profile, mode: "text" },
      };
    case "ai":
      // Nothing to erase: conversation text is never kept by the AI route, and
      // the consent check itself now routes every conversation to the scripted partner.
      return data;
    case "transcripts":
      return {
        ...data,
        roleplays: data.roleplays.map((r) => {
          if (!r.transcript) return r;
          const rest = { ...r };
          delete rest.transcript;
          return rest;
        }),
      };
    case "core":
      return data;
  }
}
