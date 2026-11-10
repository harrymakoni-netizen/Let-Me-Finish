"use client";

import { consentSnapshot, hasConsent } from "../consent";
import { CUSTOM_SCENARIO_ID, getScenario, scenarioFromCustom, type Scenario } from "../content/scenarios";
import { BrowserRecognizer, browserRecognitionCtor, isAndroid, recognitionLanguage } from "../speech/recognizer";
import { BrowserSpeaker, type Speaker } from "../speech/speaker";
import { useApp } from "../store";
import { makeTx } from "../terms";
import type { AppData, ConversationSnapshot, CustomScenario, RoleplaySession } from "../types";
import { newId } from "../util";
import { ConversationController } from "./controller";
import type { MachineConfig } from "./machine";

/** Everything needed to begin (or pick up) one conversation. */
export interface Launch {
  scenario: Scenario;
  custom?: CustomScenario;
  journeyId?: string;
  fromDaily?: boolean;
  restore?: ConversationSnapshot | null;
}

export interface LaunchChoices {
  mode: "voice" | "text";
  partner: "ai" | "scripted";
  /** Whether the browser has a voice to speak replies with. */
  voiceAvailable: boolean;
}

/** Work out what to launch from the address bar and the person's saved data. */
export function resolveLaunch(
  params: { scenario?: string | null; scene?: string | null; journey?: string | null; resume?: string | null; daily?: string | null },
  data: AppData,
): Launch | null {
  if (params.resume && data.activeConversation) {
    const snap = data.activeConversation;
    const scenario = snap.custom ? scenarioFromCustom(snap.custom) : getScenario(snap.scenarioId);
    if (!scenario) return null;
    return { scenario, custom: snap.custom, journeyId: snap.journeyId, fromDaily: snap.fromDaily, restore: snap };
  }
  const fromDaily = Boolean(params.daily);
  if (params.journey) {
    const journey = data.journeys.find((j) => j.id === params.journey);
    if (!journey) return null;
    if (journey.custom) return { scenario: scenarioFromCustom(journey.custom), custom: journey.custom, journeyId: journey.id };
    const scenario = journey.scenarioId ? getScenario(journey.scenarioId) : undefined;
    if (scenario) return { scenario, journeyId: journey.id };
    // A journey with no scene yet: build a simple one from what they wrote.
    const custom: CustomScenario = {
      title: journey.title,
      partner: "the person you’ll be speaking to",
      setting: journey.title,
      aim: journey.plan.message,
      channel: "in_person",
      whoStarts: "partner",
    };
    return { scenario: scenarioFromCustom(custom), custom, journeyId: journey.id };
  }
  if (params.scene) {
    const scene = data.scenes.find((s) => s.id === params.scene);
    if (!scene) return null;
    return { scenario: scenarioFromCustom(scene), custom: scene, fromDaily };
  }
  if (params.scenario && params.scenario !== CUSTOM_SCENARIO_ID) {
    const scenario = getScenario(params.scenario);
    return scenario ? { scenario, fromDaily } : null;
  }
  return null;
}

function debounce<T>(fn: (value: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;
  const run = (value: T) => {
    pending = { value };
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (pending) fn(pending.value);
      pending = null;
    }, ms);
  };
  run.flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending) fn(pending.value);
    pending = null;
  };
  run.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return run;
}

export interface LiveSession {
  controller: ConversationController;
  speaker: Speaker | null;
  /** Stop saving progress (call before recording the finished session). */
  stopSaving: () => void;
  /** Write any unsaved progress now (the page is being hidden). */
  saveNow: () => void;
}

/** Build a controller wired to the real microphone, voice and store. Call from a tap. */
export function beginSession(launch: Launch, choices: LaunchChoices): LiveSession {
  const { settings, profile } = useApp.getState().data;
  const tx = makeTx(profile.term);
  const language = recognitionLanguage();

  const speaker =
    settings.voice.speakReplies && choices.voiceAvailable && typeof window !== "undefined"
      ? new BrowserSpeaker(window.speechSynthesis, () => {
          const v = useApp.getState().data.settings.voice;
          return { voiceURI: v.voiceURI, rate: v.rate, lang: language };
        })
      : null;
  // Must happen inside the tap that starts the conversation.
  speaker?.unlock();

  const scenario: Scenario = {
    ...launch.scenario,
    opener: launch.scenario.opener ? tx(launch.scenario.opener) : undefined,
  };
  // A scene the person wrote has no scripted first line when the AI is playing it.
  const opener = launch.custom && choices.partner === "ai" ? undefined : scenario.opener;

  const config: MachineConfig = {
    mode: choices.mode,
    whoStarts: scenario.whoStarts,
    opener,
    autoListen: settings.voice.autoListen,
    autoEnd: { ...settings.voice.autoEnd },
    reviewBeforeSend: settings.voice.reviewBeforeSend,
    speakReplies: Boolean(speaker),
  };

  const save = debounce((snapshot: ConversationSnapshot) => useApp.getState().saveConversation(snapshot), 300);
  const Recognition = browserRecognitionCtor();

  const controller = new ConversationController(
    {
      sessionId: launch.restore?.sessionId ?? newId(),
      scenario,
      custom: launch.custom,
      journeyId: launch.journeyId,
      fromDaily: launch.fromDaily,
      config,
      partner: choices.partner,
      manner: settings.partner.manner,
      replyLength: settings.partner.replyLength,
      term: profile.term,
      restore: launch.restore,
    },
    {
      createRecognizer:
        choices.mode === "voice" && Recognition
          ? (handlers) => new BrowserRecognizer(Recognition, language, handlers, !isAndroid())
          : null,
      speaker,
      persist: save,
    },
  );

  return { controller, speaker, stopSaving: save.cancel, saveNow: save.flush };
}

/** Kick a freshly built controller into motion, new or restored. */
export function startOrResume(controller: ConversationController, restored: boolean): void {
  const state = controller.getView().machine;
  if (!restored || state.messages.length === 0) {
    controller.dispatch({ type: "START" });
    return;
  }
  const last = state.messages[state.messages.length - 1];
  if (last.role === "user") controller.dispatch({ type: "RETRY_REPLY" });
  else controller.dispatch({ type: "OPEN_TURN" });
}

/** Turn a conversation (finished, or abandoned mid-way) into a history record. */
export function sessionRecord(
  snapshot: ConversationSnapshot,
  title: string,
  data: AppData,
  endedAt: string = new Date().toISOString(),
): RoleplaySession | null {
  const turns = snapshot.messages.filter((m) => m.role === "user").length;
  if (turns === 0) return null;
  const keepText = hasConsent(data.consents, "transcripts");
  return {
    id: snapshot.sessionId,
    scenarioId: snapshot.scenarioId,
    title,
    custom: snapshot.custom,
    journeyId: snapshot.journeyId,
    mode: snapshot.mode,
    partner: snapshot.partner,
    startedAt: snapshot.startedAt,
    endedAt,
    userTurns: turns,
    consentSnapshot: consentSnapshot(data.consents),
    // The words themselves are kept only if the person has asked for that.
    ...(keepText ? { transcript: snapshot.messages } : {}),
  };
}
