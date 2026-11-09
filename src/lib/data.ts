import { hasConsent } from "./consent";
import type {
  AppData,
  ISO,
  Profile,
  RatingKey,
  RegionId,
  SelfRatings,
  Settings,
  Term,
} from "./types";
import { daysBetween, nowIso } from "./util";

/**
 * Pure functions over the person's data: defaults, retention, export, import.
 * No browser APIs in here, so every privacy rule can be unit-tested.
 */

export const STORAGE_KEY = "lmf:data:v1";
export const UI_PREFS_KEY = "lmf:ui";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  fontScale: 1,
  motion: "system",
  contrast: "system",
  voice: {
    recognizer: "browser",
    speakReplies: true,
    voiceURI: null,
    rate: 0.95,
    autoListen: true,
    // Silence never ends a turn unless the person switches this on themselves.
    autoEnd: { enabled: false, seconds: 8 },
    liveTranscript: true,
    reviewBeforeSend: false,
    sounds: true,
  },
  partner: {
    manner: "warm",
    replyLength: "short",
    scriptedOnly: false,
  },
  retention: {
    transcriptDays: 30,
    historyDays: 0,
  },
};

export const DEFAULT_PROFILE: Profile = {
  term: "stammer",
  goalIds: [],
  situationIds: [],
  experienceIds: [],
  mode: "text",
  sessionLength: "standard",
  region: "other",
  personalWords: [],
};

export function initialData(now: Date = new Date()): AppData {
  return {
    schema: 1,
    createdAt: nowIso(now),
    account: { mode: "guest" },
    profile: { ...DEFAULT_PROFILE },
    settings: structuredCloneSafe(DEFAULT_SETTINGS),
    consents: [],
    goals: [],
    checkIns: [],
    practice: [],
    roleplays: [],
    journeys: [],
    reflections: [],
    daily: [],
    feedback: [],
    audit: [],
    activeConversation: null,
    savedModuleIds: [],
  };
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Best first guess from the browser's language; always editable. */
export function guessLocaleDefaults(language: string | undefined): {
  term: Term;
  region: RegionId;
} {
  const tag = (language ?? "").toLowerCase();
  const country = tag.split("-")[1] ?? "";
  const regionByCountry: Record<string, RegionId> = {
    gb: "uk",
    ie: "ie",
    us: "us",
    ca: "ca",
    au: "au",
    nz: "nz",
    za: "za",
    in: "in",
  };
  const region = regionByCountry[country] ?? "other";
  const stammerRegions: RegionId[] = ["uk", "ie", "za", "in"];
  const term: Term = stammerRegions.includes(region) ? "stammer" : region === "other" ? "stammer" : "stutter";
  return { term, region };
}

/**
 * Fill any missing fields from defaults so data saved by an older build (or
 * imported from an export) is always complete.
 */
export function normalise(input: unknown, now: Date = new Date()): AppData {
  const base = initialData(now);
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<AppData>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    schema: 1,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : base.createdAt,
    ageConfirmedAt: typeof raw.ageConfirmedAt === "string" ? raw.ageConfirmedAt : undefined,
    onboardedAt: typeof raw.onboardedAt === "string" ? raw.onboardedAt : undefined,
    account:
      raw.account && (raw.account.mode === "guest" || raw.account.mode === "account")
        ? { ...raw.account }
        : base.account,
    profile: {
      ...base.profile,
      ...(raw.profile ?? {}),
      goalIds: arr<string>(raw.profile?.goalIds),
      situationIds: arr<string>(raw.profile?.situationIds),
      experienceIds: arr<string>(raw.profile?.experienceIds),
      personalWords: arr(raw.profile?.personalWords),
    },
    settings: {
      ...base.settings,
      ...(raw.settings ?? {}),
      voice: {
        ...base.settings.voice,
        ...(raw.settings?.voice ?? {}),
        autoEnd: { ...base.settings.voice.autoEnd, ...(raw.settings?.voice?.autoEnd ?? {}) },
      },
      partner: { ...base.settings.partner, ...(raw.settings?.partner ?? {}) },
      retention: { ...base.settings.retention, ...(raw.settings?.retention ?? {}) },
    },
    consents: arr(raw.consents),
    goals: arr(raw.goals),
    checkIns: arr(raw.checkIns),
    practice: arr(raw.practice),
    roleplays: arr(raw.roleplays),
    journeys: arr(raw.journeys),
    reflections: arr(raw.reflections),
    daily: arr(raw.daily),
    feedback: arr(raw.feedback),
    audit: arr(raw.audit),
    activeConversation: raw.activeConversation ?? null,
    savedModuleIds: arr<string>(raw.savedModuleIds),
  };
}

// --- Retention ---------------------------------------------------------------

export interface PruneResult {
  data: AppData;
  transcriptsRemoved: number;
  recordsRemoved: number;
  changed: boolean;
}

const STALE_CONVERSATION_HOURS = 24;
const MAX_AUDIT_EVENTS = 500;
const MAX_DAILY_SESSIONS = 120;

/**
 * Apply the person's retention choices. Runs when the app opens and after any
 * change to those choices.
 */
export function pruneExpired(data: AppData, now: Date = new Date()): PruneResult {
  let transcriptsRemoved = 0;
  let recordsRemoved = 0;
  const keepTranscripts = hasConsent(data.consents, "transcripts");
  const tDays = data.settings.retention.transcriptDays;
  const hDays = data.settings.retention.historyDays;
  const tooOld = (at: ISO, days: number) => days > 0 && daysBetween(at, now) > days;

  let roleplays = data.roleplays.map((r) => {
    if (!r.transcript) return r;
    if (!keepTranscripts || tooOld(r.endedAt, tDays)) {
      transcriptsRemoved++;
      const rest = { ...r };
      delete rest.transcript;
      return rest;
    }
    return r;
  });

  let { practice, checkIns, reflections, daily, journeys } = data;
  if (hDays > 0) {
    const before = roleplays.length + practice.length + checkIns.length + reflections.length;
    roleplays = roleplays.filter((r) => !tooOld(r.endedAt, hDays));
    practice = practice.filter((p) => !tooOld(p.completedAt, hDays));
    checkIns = checkIns.filter((c) => !tooOld(c.at, hDays));
    reflections = reflections.filter((r) => !tooOld(r.at, hDays));
    const beforeJ = journeys.length;
    // Journeys still in progress are never pruned out from under the person.
    journeys = journeys.filter((j) => !(j.stage === "done" && tooOld(j.updatedAt, hDays)));
    recordsRemoved =
      before -
      (roleplays.length + practice.length + checkIns.length + reflections.length) +
      (beforeJ - journeys.length);
    daily = daily.filter((d) => !tooOld(d.startedAt, hDays));
  }
  if (daily.length > MAX_DAILY_SESSIONS) daily = daily.slice(-MAX_DAILY_SESSIONS);

  let activeConversation = data.activeConversation;
  if (
    activeConversation &&
    daysBetween(activeConversation.updatedAt, now) * 24 > STALE_CONVERSATION_HOURS
  ) {
    activeConversation = null;
    transcriptsRemoved++;
  }

  const audit =
    data.audit.length > MAX_AUDIT_EVENTS ? data.audit.slice(-MAX_AUDIT_EVENTS) : data.audit;

  const changed =
    transcriptsRemoved > 0 ||
    recordsRemoved > 0 ||
    daily.length !== data.daily.length ||
    audit.length !== data.audit.length;

  if (!changed) return { data, transcriptsRemoved, recordsRemoved, changed };
  return {
    data: { ...data, roleplays, practice, checkIns, reflections, daily, journeys, audit, activeConversation },
    transcriptsRemoved,
    recordsRemoved,
    changed,
  };
}

// --- Export / import ---------------------------------------------------------

export interface ExportBundle {
  app: "Let Me Finish";
  format: 1;
  exportedAt: ISO;
  note: string;
  data: AppData;
}

export function buildExport(data: AppData, now: Date = new Date()): ExportBundle {
  return {
    app: "Let Me Finish",
    format: 1,
    exportedAt: nowIso(now),
    note:
      "This file contains everything Let Me Finish holds about you on this device. It is yours: keep it, share it with someone you trust, or import it on another device.",
    data: structuredCloneSafe(data),
  };
}

export function parseImport(text: string, now: Date = new Date()): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const bundle = parsed as Partial<ExportBundle>;
  if (!bundle || bundle.app !== "Let Me Finish" || !bundle.data) {
    throw new Error("That doesn't look like a Let Me Finish export.");
  }
  if ((bundle.data as AppData).schema !== 1) {
    throw new Error("That export was made by a newer version of the app.");
  }
  return normalise(bundle.data, now);
}

// --- Derived views used by Home and Progress ---------------------------------

export interface RatedMoment {
  at: ISO;
  ratings: SelfRatings;
  source: "checkin" | "conversation" | "reflection";
}

/** Every moment the person chose to rate something, oldest first. */
export function ratedMoments(data: AppData): RatedMoment[] {
  const out: RatedMoment[] = [];
  for (const c of data.checkIns) out.push({ at: c.at, ratings: c.ratings, source: "checkin" });
  for (const r of data.roleplays)
    if (r.ratings && hasAnyRating(r.ratings))
      out.push({ at: r.endedAt, ratings: r.ratings, source: "conversation" });
  for (const r of data.reflections) out.push({ at: r.at, ratings: r.ratings, source: "reflection" });
  return out.filter((m) => hasAnyRating(m.ratings)).sort((a, b) => a.at.localeCompare(b.at));
}

export function hasAnyRating(r: SelfRatings): boolean {
  return (
    r.confidence !== undefined ||
    r.participation !== undefined ||
    r.effort !== undefined ||
    r.avoidance !== undefined
  );
}

export function seriesFor(moments: RatedMoment[], key: RatingKey): { at: ISO; value: number }[] {
  return moments
    .filter((m) => m.ratings[key] !== undefined)
    .map((m) => ({ at: m.at, value: m.ratings[key] as number }));
}

/** Real-world situations the person went into, however they went. */
export function situationsAttempted(data: AppData): number {
  return data.journeys.filter((j) => j.attempt && j.attempt.outcome !== "not_yet").length;
}
