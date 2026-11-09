"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { applyRevocation, grant, revoke } from "./consent";
import { STORAGE_KEY, UI_PREFS_KEY, initialData, normalise, pruneExpired } from "./data";
import type {
  AppData,
  AuditAction,
  CheckIn,
  ConsentPurpose,
  ConversationSnapshot,
  DailySession,
  DailyStepId,
  FeedbackReport,
  Goal,
  ID,
  Journey,
  JourneyStage,
  NextStep,
  PartnerSettings,
  PersonalWord,
  PracticeSession,
  Profile,
  Reflection,
  RetentionSettings,
  RoleplaySession,
  SelfRatings,
  Settings,
  StepStatus,
  VoiceSettings,
} from "./types";
import { dayOf, newId, nowIso, tidy } from "./util";

/**
 * The one place the person's data is read and written.
 *
 * Local-first: everything is kept in this browser's storage. Nothing in here
 * talks to a server.
 */

let storageFailed = false;
const storageListeners = new Set<() => void>();

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      if (storageFailed) {
        storageFailed = false;
        storageListeners.forEach((l) => l());
      }
    } catch {
      // Private browsing or a full disk. The app keeps working in memory and
      // Settings tells the person their changes may not be saved.
      if (!storageFailed) {
        storageFailed = true;
        storageListeners.forEach((l) => l());
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* nothing to remove */
    }
  },
};

export interface NewJourneyInput {
  title: string;
  situationId?: string;
  scenarioId?: string;
  custom?: Journey["custom"];
  targetDate?: string;
}

export interface AppStore {
  data: AppData;

  // setup
  confirmAge: () => void;
  setConsent: (purpose: ConsentPurpose, granted: boolean) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  completeOnboarding: () => void;

  // settings
  updateSettings: (patch: Partial<Pick<Settings, "theme" | "fontScale" | "motion" | "contrast">>) => void;
  updateVoice: (patch: Partial<VoiceSettings>) => void;
  updatePartner: (patch: Partial<PartnerSettings>) => void;
  updateRetention: (patch: Partial<RetentionSettings>) => void;

  // goals and personal words
  addGoal: (text: string) => ID;
  updateGoal: (id: ID, patch: Partial<Pick<Goal, "text" | "status" | "note">>) => void;
  removeGoal: (id: ID) => void;
  addPersonalWord: (text: string, kind: PersonalWord["kind"]) => void;
  removePersonalWord: (id: ID) => void;

  // check-ins and practice
  addCheckIn: (ratings: SelfRatings, note?: string) => ID;
  logPractice: (entry: Omit<PracticeSession, "id">) => ID;
  setPracticeVerdict: (id: ID, verdict: PracticeSession["verdict"], note?: string) => void;
  toggleSavedModule: (moduleId: string) => void;

  // conversations
  saveConversation: (snapshot: ConversationSnapshot | null) => void;
  finishRoleplay: (session: RoleplaySession) => void;
  rateRoleplay: (id: ID, ratings: SelfRatings, note?: string) => void;
  deleteTranscripts: () => void;

  // journeys
  createJourney: (input: NewJourneyInput) => ID;
  updateJourney: (id: ID, patch: Partial<Omit<Journey, "id" | "createdAt">>) => void;
  setJourneyStage: (id: ID, stage: JourneyStage) => void;
  recordAttempt: (id: ID, outcome: NonNullable<Journey["attempt"]>["outcome"]) => void;
  saveReflection: (journeyId: ID, reflection: Omit<Reflection, "id" | "at" | "journeyId">) => void;
  chooseNextStep: (id: ID, step: Omit<NextStep, "chosenAt">) => void;
  deleteJourney: (id: ID) => void;

  // daily session
  startDaily: (length: DailySession["length"]) => DailySession;
  setDailyStep: (step: DailyStepId, status: StepStatus) => void;
  setDailyChoice: (patch: Pick<DailySession, "moduleId" | "scenarioId">) => void;

  // safety and records
  addFeedback: (report: Omit<FeedbackReport, "id" | "at" | "delivered">) => ID;
  markFeedbackDelivered: (id: ID) => void;
  logAudit: (action: AuditAction, resource?: string) => void;

  // privacy
  prune: () => void;
  importData: (data: AppData) => void;
  deleteEverything: () => void;
}

function audit(data: AppData, action: AuditAction, resource?: string): AppData {
  return {
    ...data,
    audit: [...data.audit, { id: newId(), at: nowIso(), action, resource }],
  };
}

export const useApp = create<AppStore>()(
  persist(
    (set, get) => {
      const mutate = (fn: (d: AppData) => AppData) => set((s) => ({ data: fn(s.data) }));
      const today = () => dayOf(new Date());

      return {
        data: initialData(),

        confirmAge: () => mutate((d) => ({ ...d, ageConfirmedAt: d.ageConfirmedAt ?? nowIso() })),

        setConsent: (purpose, granted) =>
          mutate((d) => {
            if (granted) {
              const consents = grant(d.consents, purpose);
              if (consents === d.consents) return d;
              return audit({ ...d, consents }, "consent.granted", purpose);
            }
            const consents = revoke(d.consents, purpose);
            const next = applyRevocation({ ...d, consents }, purpose);
            return audit(next, "consent.revoked", purpose);
          }),

        updateProfile: (patch) => mutate((d) => ({ ...d, profile: { ...d.profile, ...patch } })),

        completeOnboarding: () => mutate((d) => ({ ...d, onboardedAt: d.onboardedAt ?? nowIso() })),

        updateSettings: (patch) => mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
        updateVoice: (patch) =>
          mutate((d) => ({
            ...d,
            settings: { ...d.settings, voice: { ...d.settings.voice, ...patch } },
          })),
        updatePartner: (patch) =>
          mutate((d) => ({
            ...d,
            settings: { ...d.settings, partner: { ...d.settings.partner, ...patch } },
          })),
        updateRetention: (patch) => {
          mutate((d) => ({
            ...d,
            settings: { ...d.settings, retention: { ...d.settings.retention, ...patch } },
          }));
          get().prune();
        },

        addGoal: (text) => {
          const id = newId();
          const at = nowIso();
          mutate((d) => ({
            ...d,
            goals: [...d.goals, { id, text: tidy(text, 200), createdAt: at, updatedAt: at, status: "active" }],
          }));
          return id;
        },
        updateGoal: (id, patch) =>
          mutate((d) => ({
            ...d,
            goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: nowIso() } : g)),
          })),
        removeGoal: (id) => mutate((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) })),

        addPersonalWord: (text, kind) =>
          mutate((d) => {
            const clean = tidy(text, 80);
            if (!clean) return d;
            if (d.profile.personalWords.some((w) => w.text.toLowerCase() === clean.toLowerCase())) return d;
            return {
              ...d,
              profile: {
                ...d.profile,
                personalWords: [
                  ...d.profile.personalWords,
                  { id: newId(), text: clean, kind, addedAt: nowIso() },
                ],
              },
            };
          }),
        removePersonalWord: (id) =>
          mutate((d) => ({
            ...d,
            profile: {
              ...d.profile,
              personalWords: d.profile.personalWords.filter((w) => w.id !== id),
            },
          })),

        addCheckIn: (ratings, note) => {
          const entry: CheckIn = { id: newId(), at: nowIso(), ratings, note: note ? tidy(note, 1000) : undefined };
          mutate((d) => ({ ...d, checkIns: [...d.checkIns, entry] }));
          return entry.id;
        },

        logPractice: (entry) => {
          const id = newId();
          mutate((d) => ({ ...d, practice: [...d.practice, { ...entry, id }] }));
          return id;
        },
        setPracticeVerdict: (id, verdict, note) =>
          mutate((d) => ({
            ...d,
            practice: d.practice.map((p) =>
              p.id === id ? { ...p, verdict, note: note ? tidy(note, 1000) : p.note } : p,
            ),
          })),
        toggleSavedModule: (moduleId) =>
          mutate((d) => ({
            ...d,
            savedModuleIds: d.savedModuleIds.includes(moduleId)
              ? d.savedModuleIds.filter((m) => m !== moduleId)
              : [...d.savedModuleIds, moduleId],
          })),

        saveConversation: (snapshot) => mutate((d) => ({ ...d, activeConversation: snapshot })),

        finishRoleplay: (session) =>
          mutate((d) => {
            if (d.roleplays.some((r) => r.id === session.id)) {
              return { ...d, activeConversation: null };
            }
            const journeys = session.journeyId
              ? d.journeys.map((j) =>
                  j.id === session.journeyId && !j.rehearsalIds.includes(session.id)
                    ? { ...j, rehearsalIds: [...j.rehearsalIds, session.id], updatedAt: nowIso() }
                    : j,
                )
              : d.journeys;
            return {
              ...d,
              journeys,
              roleplays: [...d.roleplays, session],
              activeConversation: null,
            };
          }),
        rateRoleplay: (id, ratings, note) =>
          mutate((d) => ({
            ...d,
            roleplays: d.roleplays.map((r) =>
              r.id === id ? { ...r, ratings, note: note ? tidy(note, 1000) : r.note } : r,
            ),
          })),
        deleteTranscripts: () =>
          mutate((d) =>
            audit(
              {
                ...d,
                activeConversation: null,
                roleplays: d.roleplays.map((r) => {
                  if (!r.transcript) return r;
                  const rest = { ...r };
                  delete rest.transcript;
                  return rest;
                }),
              },
              "transcripts.deleted",
            ),
          ),

        createJourney: (input) => {
          const id = newId();
          const at = nowIso();
          const journey: Journey = {
            id,
            title: tidy(input.title, 140),
            situationId: input.situationId,
            scenarioId: input.scenarioId,
            custom: input.custom,
            targetDate: input.targetDate,
            stage: "prepare",
            createdAt: at,
            updatedAt: at,
            plan: { message: "", why: "", prediction: "", supports: [] },
            rehearsalIds: [],
          };
          mutate((d) => ({ ...d, journeys: [...d.journeys, journey] }));
          return id;
        },
        updateJourney: (id, patch) =>
          mutate((d) => ({
            ...d,
            journeys: d.journeys.map((j) => (j.id === id ? { ...j, ...patch, updatedAt: nowIso() } : j)),
          })),
        setJourneyStage: (id, stage) =>
          mutate((d) => ({
            ...d,
            journeys: d.journeys.map((j) => (j.id === id ? { ...j, stage, updatedAt: nowIso() } : j)),
          })),
        recordAttempt: (id, outcome) =>
          mutate((d) => ({
            ...d,
            journeys: d.journeys.map((j) =>
              j.id === id
                ? {
                    ...j,
                    attempt: { outcome, at: nowIso() },
                    // "Not yet" keeps the door open rather than recording a failure.
                    stage: outcome === "not_yet" ? "attempt" : "reflect",
                    updatedAt: nowIso(),
                  }
                : j,
            ),
          })),
        saveReflection: (journeyId, reflection) =>
          mutate((d) => {
            const entry: Reflection = { ...reflection, id: newId(), at: nowIso(), journeyId };
            return {
              ...d,
              reflections: [...d.reflections.filter((r) => r.journeyId !== journeyId), entry],
              journeys: d.journeys.map((j) =>
                j.id === journeyId ? { ...j, reflection: entry, stage: "done", updatedAt: nowIso() } : j,
              ),
            };
          }),
        chooseNextStep: (id, step) =>
          mutate((d) => ({
            ...d,
            journeys: d.journeys.map((j) =>
              j.id === id ? { ...j, nextStep: { ...step, chosenAt: nowIso() }, updatedAt: nowIso() } : j,
            ),
          })),
        deleteJourney: (id) =>
          mutate((d) => ({
            ...d,
            journeys: d.journeys.filter((j) => j.id !== id),
            reflections: d.reflections.filter((r) => r.journeyId !== id),
          })),

        startDaily: (length) => {
          const existing = get().data.daily.find((s) => s.day === today());
          if (existing) {
            if (existing.length !== length) {
              mutate((d) => ({
                ...d,
                daily: d.daily.map((s) => (s.id === existing.id ? { ...s, length } : s)),
              }));
            }
            return { ...existing, length };
          }
          const session: DailySession = {
            id: newId(),
            day: today(),
            length,
            steps: { checkin: "todo", exercise: "todo", talk: "todo", plan: "todo", reflect: "todo" },
            startedAt: nowIso(),
          };
          mutate((d) => ({ ...d, daily: [...d.daily, session] }));
          return session;
        },
        setDailyStep: (step, status) =>
          mutate((d) => ({
            ...d,
            daily: d.daily.map((s) => {
              if (s.day !== today()) return s;
              const steps = { ...s.steps, [step]: status };
              const finished = Object.values(steps).every((v) => v !== "todo");
              return { ...s, steps, completedAt: finished ? (s.completedAt ?? nowIso()) : undefined };
            }),
          })),
        setDailyChoice: (patch) =>
          mutate((d) => ({
            ...d,
            daily: d.daily.map((s) => (s.day === today() ? { ...s, ...patch } : s)),
          })),

        addFeedback: (report) => {
          const id = newId();
          mutate((d) => ({
            ...d,
            feedback: [
              ...d.feedback,
              {
                id,
                at: nowIso(),
                delivered: false,
                kind: report.kind,
                detail: tidy(report.detail, 2000),
                context: report.context ? tidy(report.context, 1000) : undefined,
              },
            ],
          }));
          return id;
        },
        markFeedbackDelivered: (id) =>
          mutate((d) => ({
            ...d,
            feedback: d.feedback.map((f) => (f.id === id ? { ...f, delivered: true } : f)),
          })),

        logAudit: (action, resource) => mutate((d) => audit(d, action, resource)),

        prune: () =>
          mutate((d) => {
            const result = pruneExpired(d);
            if (!result.changed) return d;
            return result.recordsRemoved > 0 || result.transcriptsRemoved > 0
              ? audit(result.data, "history.pruned")
              : result.data;
          }),

        importData: (data) => set({ data: normalise(data) }),

        deleteEverything: () => {
          set({ data: initialData() });
          safeStorage.removeItem(STORAGE_KEY);
          safeStorage.removeItem(UI_PREFS_KEY);
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ data: state.data }),
      merge: (persisted, current) => ({
        ...current,
        data: normalise((persisted as { data?: unknown } | undefined)?.data),
      }),
      // The server render and the first client render must match, so stored
      // data is only read after hydration (see StoreBoot).
      skipHydration: true,
    },
  ),
);

/** True once the person's saved data has been loaded from this device. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useApp.persist.onFinishHydration(onChange),
    () => useApp.persist.hasHydrated(),
    () => false,
  );
}

/** True when the browser refused to save (private mode, storage full). */
export function useStorageFailed(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      storageListeners.add(onChange);
      return () => storageListeners.delete(onChange);
    },
    () => storageFailed,
    () => false,
  );
}

/** Convenience selector over the data only. Select primitives or stored references. */
export function useData<T>(selector: (data: AppData) => T): T {
  return useApp((s) => selector(s.data));
}
