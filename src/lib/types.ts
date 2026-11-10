/**
 * Core data types.
 *
 * Everything here lives on the user's own device by default. The shapes mirror
 * the blueprint's data model (profiles, consents, practice and role-play
 * sessions, journeys, reflections, audit events) so they map one-to-one onto
 * the Supabase schema when an account is used.
 */

export type ID = string;
/** ISO 8601 timestamp. */
export type ISO = string;
/** Local calendar day, YYYY-MM-DD. */
export type Day = string;

/** Which word the person uses for their own speech. */
export type Term = "stammer" | "stutter";

export type Rating = 1 | 2 | 3 | 4 | 5;

/**
 * The four self-reported measures. Nothing is ever inferred from audio — these
 * are only ever what the person chooses to tell us.
 */
export interface SelfRatings {
  /** How confident did I feel speaking? */
  confidence?: Rating;
  /** How much did I say what I wanted to say? */
  participation?: Rating;
  /** How much physical effort or struggle was there? */
  effort?: Rating;
  /** How much did I hold back, swap words or avoid? */
  avoidance?: Rating;
}

export type RatingKey = keyof SelfRatings;

// --- Consent -----------------------------------------------------------------

export type ConsentPurpose = "core" | "voice" | "ai" | "transcripts";

export interface ConsentRecord {
  id: ID;
  purpose: ConsentPurpose;
  /** Version of the consent wording the person agreed to. */
  version: string;
  grantedAt: ISO;
  revokedAt?: ISO;
}

// --- Profile and settings ----------------------------------------------------

export type RegionId = "uk" | "ie" | "us" | "ca" | "au" | "nz" | "za" | "in" | "other";

export interface PersonalWord {
  id: ID;
  text: string;
  kind: "name" | "word" | "phrase";
  addedAt: ISO;
}

export interface Goal {
  id: ID;
  text: string;
  createdAt: ISO;
  status: "active" | "paused" | "reached";
  note?: string;
  updatedAt: ISO;
}

export interface Profile {
  preferredName?: string;
  term: Term;
  /** Ids from the goal options the person picked while setting up. */
  goalIds: string[];
  situationIds: string[];
  experienceIds: string[];
  mode: "voice" | "text";
  sessionLength: "short" | "standard";
  region: RegionId;
  personalWords: PersonalWord[];
}

export type ListenerManner = "warm" | "neutral" | "brisk";

export interface VoiceSettings {
  /** "browser" uses the browser's speech service; "ondevice" never sends audio anywhere. */
  recognizer: "browser" | "ondevice";
  speakReplies: boolean;
  voiceURI: string | null;
  /** Speaking rate of the partner's voice, 0.6 – 1.3. */
  rate: number;
  /** Open my turn automatically once the partner has finished speaking. */
  autoListen: boolean;
  /** Opt-in only. Off by default: silence never ends a turn. */
  autoEnd: { enabled: boolean; seconds: number };
  liveTranscript: boolean;
  reviewBeforeSend: boolean;
  sounds: boolean;
}

export interface PartnerSettings {
  manner: ListenerManner;
  replyLength: "short" | "medium";
  /** Never send conversation text to the AI service; use the scripted partner. */
  scriptedOnly: boolean;
}

export interface RetentionSettings {
  /** Days to keep saved transcripts. 0 keeps them until deleted by hand. */
  transcriptDays: 0 | 7 | 30 | 90;
  /** Days to keep session history and reflections. 0 keeps them until deleted. */
  historyDays: 0 | 90 | 365;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  fontScale: 1 | 1.125 | 1.25 | 1.5;
  motion: "system" | "reduce";
  contrast: "system" | "more";
  voice: VoiceSettings;
  partner: PartnerSettings;
  retention: RetentionSettings;
}

// --- Conversation ------------------------------------------------------------

export type ChatRole = "user" | "partner";

export interface ChatMessage {
  id: ID;
  role: ChatRole;
  text: string;
  at: ISO;
  /** The partner stepped out of the role-play (safety or limits). */
  aside?: boolean;
  /** The person corrected the transcript by hand. */
  edited?: boolean;
  /** How this turn was entered. */
  via?: "voice" | "text";
  /** Which line of the script this was, when the scripted partner is speaking. */
  beat?: number;
}

export interface CustomScenario {
  title: string;
  /** Who the partner is, in the person's words. */
  partner: string;
  /** Where / when this happens. */
  setting: string;
  /** What the person wants to say or get done. */
  aim: string;
  channel: "in_person" | "phone";
  whoStarts: "partner" | "user";
}

/** A scene the person wrote for themselves and kept to use again. */
export interface SavedScene extends CustomScenario {
  id: ID;
  createdAt: ISO;
}

export interface ConversationSnapshot {
  sessionId: ID;
  scenarioId: string;
  custom?: CustomScenario;
  journeyId?: ID;
  fromDaily?: boolean;
  startedAt: ISO;
  updatedAt: ISO;
  mode: "voice" | "text";
  partner: "ai" | "scripted";
  messages: ChatMessage[];
  draft: string;
}

export interface RoleplaySession {
  id: ID;
  scenarioId: string;
  title: string;
  custom?: CustomScenario;
  journeyId?: ID;
  mode: "voice" | "text";
  partner: "ai" | "scripted";
  startedAt: ISO;
  endedAt: ISO;
  userTurns: number;
  /** Consent versions in force when the session ran. */
  consentSnapshot: Partial<Record<ConsentPurpose, string>>;
  ratings?: SelfRatings;
  note?: string;
  /** Present only when the person has opted in to keeping transcripts. */
  transcript?: ChatMessage[];
}

// --- Practice ----------------------------------------------------------------

export interface PracticeSession {
  id: ID;
  moduleId: string;
  startedAt: ISO;
  completedAt: ISO;
  durationSec: number;
  /** The person's own verdict, used to shape future suggestions. */
  verdict?: "useful" | "unsure" | "not_for_me";
  note?: string;
}

export interface CheckIn {
  id: ID;
  at: ISO;
  ratings: SelfRatings;
  note?: string;
}

// --- Journeys ----------------------------------------------------------------

export type JourneyStage = "prepare" | "rehearse" | "attempt" | "reflect" | "done";

export interface JourneyPlan {
  /** What I want to say or get across. */
  message: string;
  /** Why this matters to me. */
  why: string;
  /** What I expect will happen. */
  prediction: string;
  /** Ids of the supports I plan to lean on. */
  supports: string[];
  ownSupport?: string;
}

export interface Reflection {
  id: ID;
  journeyId?: ID;
  at: ISO;
  ratings: SelfRatings;
  /** What actually happened, next to what I predicted. */
  whatHappened?: string;
  helped: string[];
  notes?: string;
}

export interface NextStep {
  kind: "repeat" | "smaller" | "bigger" | "rehearse" | "module" | "rest" | "new";
  label: string;
  href?: string;
  chosenAt: ISO;
}

export interface Journey {
  id: ID;
  title: string;
  situationId?: string;
  scenarioId?: string;
  custom?: CustomScenario;
  targetDate?: Day;
  stage: JourneyStage;
  createdAt: ISO;
  updatedAt: ISO;
  plan: JourneyPlan;
  rehearsalIds: ID[];
  attempt?: { outcome: "did" | "partly" | "not_yet"; at: ISO };
  reflection?: Reflection;
  nextStep?: NextStep;
}

// --- Daily session -----------------------------------------------------------

export type DailyStepId = "checkin" | "exercise" | "talk" | "plan" | "reflect";
export type StepStatus = "todo" | "done" | "skipped";

export interface DailySession {
  id: ID;
  day: Day;
  length: "short" | "standard";
  steps: Record<DailyStepId, StepStatus>;
  moduleId?: string;
  scenarioId?: string;
  startedAt: ISO;
  completedAt?: ISO;
}

// --- Safety, feedback, audit -------------------------------------------------

export interface FeedbackReport {
  id: ID;
  at: ISO;
  kind: "partner_reply" | "content" | "safety" | "bug" | "other";
  detail: string;
  /** Short context the person chose to attach, e.g. the reply they flagged. */
  context?: string;
  delivered: boolean;
}

export type AuditAction =
  | "consent.granted"
  | "consent.revoked"
  | "data.exported"
  | "data.deleted"
  | "transcripts.deleted"
  | "history.pruned"
  | "account.signed_in"
  | "account.signed_out";

export interface AuditEvent {
  id: ID;
  at: ISO;
  action: AuditAction;
  resource?: string;
}

// --- Whole persisted state ---------------------------------------------------

export interface AppData {
  schema: 1;
  createdAt: ISO;
  /** Set when the person confirmed they are 18 or over. */
  ageConfirmedAt?: ISO;
  onboardedAt?: ISO;
  account: { mode: "guest" | "account"; userId?: string; email?: string };
  profile: Profile;
  settings: Settings;
  consents: ConsentRecord[];
  goals: Goal[];
  checkIns: CheckIn[];
  practice: PracticeSession[];
  roleplays: RoleplaySession[];
  journeys: Journey[];
  reflections: Reflection[];
  daily: DailySession[];
  feedback: FeedbackReport[];
  audit: AuditEvent[];
  /** An unfinished conversation, kept so it can be resumed after a reload. */
  activeConversation: ConversationSnapshot | null;
  /** Lessons the person has saved to come back to. */
  savedModuleIds: string[];
  /** Scenes the person has written for their own real situations. */
  scenes: SavedScene[];
}
