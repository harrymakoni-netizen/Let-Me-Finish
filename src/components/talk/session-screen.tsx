"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mic, Phone, PhoneIncoming } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ConsentCard } from "@/components/consent-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { RatingScale, Segmented, TextArea } from "@/components/ui/form";
import { Callout } from "@/components/ui/layout";
import { RATING_ITEMS, RATING_ORDER } from "@/lib/content/options";
import { ROLE_LABELS, type Scenario } from "@/lib/content/scenarios";
import {
  beginSession,
  resolveLaunch,
  sessionRecord,
  startOrResume,
  type Launch,
  type LiveSession,
} from "@/lib/conversation/launch";
import { fetchStatus } from "@/lib/conversation/partner-client";
import { useApp, useConsent, useData, useOnline, useTx } from "@/lib/hooks";
import { browserRecognitionAvailable } from "@/lib/speech/recognizer";
import { ring } from "@/lib/speech/ring";
import { englishVoices, loadVoices } from "@/lib/speech/speaker";
import { makeTx } from "@/lib/terms";
import type { ListenerManner, SelfRatings } from "@/lib/types";
import { LiveConversation } from "./live-conversation";

/** What this browser and this deployment can offer, discovered once on arrival. */
function useCapabilities() {
  const [caps, setCaps] = useState<{ ai: boolean | null; voices: boolean; recognition: boolean }>({
    ai: null,
    voices: false,
    recognition: false,
  });
  const online = useOnline();
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchStatus(), loadVoices()]).then(([status, voices]) => {
      if (cancelled) return;
      setCaps({ ai: status.ai, voices: englishVoices(voices).length > 0, recognition: browserRecognitionAvailable() });
    });
    return () => {
      cancelled = true;
    };
  }, [online]);
  return caps;
}

export function SessionScreen() {
  const params = useSearchParams();
  const data = useApp((s) => s.data);
  const key = params.toString();
  const launch = useMemo(
    () =>
      resolveLaunch(
        {
          scenario: params.get("scenario"),
          scene: params.get("scene"),
          journey: params.get("journey"),
          resume: params.get("resume"),
          daily: params.get("daily"),
        },
        data,
      ),
    // The launch is fixed for a visit: later saves to the store must not rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  if (!launch) {
    return (
      <div className="py-10">
        <h1 className="text-3xl">That conversation isn’t available</h1>
        <p className="mt-3 text-ink-soft">It may have been finished or removed. You can choose another scene.</p>
        <div className="mt-5">
          <ButtonLink href="/talk">Choose a scene</ButtonLink>
        </div>
      </div>
    );
  }
  return <Session key={key} launch={launch} />;
}

type Stage = "ready" | "connecting" | "live" | "wrapup";

function Session({ launch }: { launch: Launch }) {
  const router = useRouter();
  const caps = useCapabilities();
  const [stage, setStage] = useState<Stage>("ready");
  const [session, setSession] = useState<LiveSession | null>(null);
  const [recordedId, setRecordedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ turns: number; seconds: number } | null>(null);
  const stopRing = useRef<(() => void) | null>(null);
  const scenario = launch.scenario;
  const isPhone = scenario.channel === "phone";

  const backHref = launch.journeyId ? `/journeys/view?id=${launch.journeyId}` : launch.fromDaily ? "/today" : "/talk";

  // Make sure nothing keeps running if this screen is torn down.
  useEffect(() => {
    return () => {
      stopRing.current?.();
    };
  }, []);

  const begin = (choices: { mode: "voice" | "text"; partner: "ai" | "scripted" }) => {
    // Another unfinished conversation is closed and recorded before a new one begins.
    const state = useApp.getState();
    const other = state.data.activeConversation;
    if (other && other.sessionId !== launch.restore?.sessionId) {
      const record = sessionRecord(other, other.custom?.title || "Conversation", state.data);
      if (record) state.finishRoleplay(record);
      else state.saveConversation(null);
    }

    const live = beginSession(launch, { ...choices, voiceAvailable: caps.voices });
    setSession(live);
    const go = () => {
      setStage("live");
      startOrResume(live.controller, Boolean(launch.restore));
    };
    const sounds = useApp.getState().data.settings.voice.sounds;
    if (isPhone && !launch.restore && scenario.whoStarts === "partner") {
      setStage("connecting");
      if (sounds) stopRing.current = ring(2400);
      setTimeout(go, sounds ? 2400 : 900);
    } else if (isPhone && !launch.restore && scenario.whoStarts === "user") {
      setStage("connecting");
      if (sounds) stopRing.current = ring(12_000);
    } else {
      go();
    }
  };

  const answer = () => {
    stopRing.current?.();
    if (!session) return;
    setStage("live");
    startOrResume(session.controller, false);
  };

  if (stage === "ready") {
    return <ReadyPanel launch={launch} caps={caps} backHref={backHref} onBegin={begin} />;
  }

  if (stage === "connecting") {
    const incoming = scenario.whoStarts === "user";
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-teal-wash text-teal">
          {incoming ? <PhoneIncoming aria-hidden="true" className="size-9" /> : <Phone aria-hidden="true" className="size-9" />}
        </span>
        <h1 className="mt-5 text-3xl" role="status">
          {incoming ? "Your phone is ringing" : `Calling ${scenario.partner.split(",")[0]}…`}
        </h1>
        <p className="mt-2 max-w-sm text-ink-soft">
          {incoming ? "Answer when you’re ready. You’ll speak first." : "They’ll pick up in a moment and speak first."}
        </p>
        {incoming ? (
          <div className="mt-6">
            <Button size="xl" onClick={answer} icon={<Phone aria-hidden="true" className="size-6" />}>
              Answer
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (stage === "live" && session) {
    return (
      <LiveStage
        session={session}
        scenario={scenario}
        onEnded={(turns, seconds) => {
          // Record the conversation the moment it ends, so closing the tab loses nothing.
          session.stopSaving();
          const state = useApp.getState();
          const title = makeTx(state.data.profile.term)(scenario.title);
          const record = sessionRecord(session.controller.snapshot(), title, state.data);
          if (record) {
            state.finishRoleplay(record);
            setRecordedId(record.id);
            setSummary({ turns, seconds });
            setStage("wrapup");
          } else {
            state.saveConversation(null);
            router.push(backHref);
          }
          session.controller.dispose();
        }}
      />
    );
  }

  return (
    <WrapUp
      scenario={scenario}
      recordedId={recordedId}
      summary={summary}
      doneHref={backHref}
      againHref={
        launch.journeyId
          ? `/talk/session?journey=${launch.journeyId}`
          : launch.custom
            ? "/talk"
            : `/talk/session?scenario=${scenario.id}`
      }
      fromDaily={Boolean(launch.fromDaily)}
    />
  );
}

function LiveStage({
  session,
  scenario,
  onEnded,
}: {
  session: LiveSession;
  scenario: Scenario;
  onEnded: (turns: number, seconds: number) => void;
}) {
  const { controller } = session;
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const ended = view.machine.phase === "ended";
  const handled = useRef(false);

  useEffect(() => {
    if (!ended || handled.current) return;
    handled.current = true;
    const turns = view.machine.messages.filter((m) => m.role === "user").length;
    const seconds = (Date.now() - new Date(view.startedAt).getTime()) / 1000;
    onEnded(turns, seconds);
  }, [ended, onEnded, view.machine.messages, view.startedAt]);

  // Leaving the page mid-conversation: save what there is, at once.
  useEffect(() => {
    const save = () => session.saveNow();
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [session]);

  if (ended) return null;
  return (
    <LiveConversation
      controller={controller}
      scenario={scenario}
      voiceCapable={controller.config.mode === "voice"}
      spoken={controller.config.speakReplies}
    />
  );
}

function ReadyPanel({
  launch,
  caps,
  backHref,
  onBegin,
}: {
  launch: Launch;
  caps: { ai: boolean | null; voices: boolean; recognition: boolean };
  backHref: string;
  onBegin: (choices: { mode: "voice" | "text"; partner: "ai" | "scripted" }) => void;
}) {
  const tx = useTx();
  const scenario = launch.scenario;
  const profileMode = useData((d) => d.profile.mode);
  const manner = useData((d) => d.settings.partner.manner);
  const scriptedOnly = useData((d) => d.settings.partner.scriptedOnly);
  const speakReplies = useData((d) => d.settings.voice.speakReplies);
  const updatePartner = useApp((s) => s.updatePartner);
  const updateProfile = useApp((s) => s.updateProfile);
  const voiceConsent = useConsent("voice");
  const aiConsent = useConsent("ai");
  const online = useOnline();

  const [wanted, setWanted] = useState<"voice" | "text">(launch.restore?.mode ?? profileMode);
  const canSpeak = caps.recognition;
  const mode: "voice" | "text" = wanted === "voice" && canSpeak && voiceConsent ? "voice" : "text";
  const aiReachable = caps.ai === true && online;
  const partner: "ai" | "scripted" = aiReachable && aiConsent && !scriptedOnly ? "ai" : "scripted";
  const resuming = Boolean(launch.restore && launch.restore.messages.length > 0);
  const partnerName = scenario.partner.split(",")[0];

  return (
    <div className="pb-6">
      <Link
        href={backHref}
        className="-ml-2 mb-6 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-[0.9375rem] font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Link>
      <p className="text-sm font-semibold text-teal">
        {scenario.channel === "phone" ? "Phone call" : "Face to face"} · {ROLE_LABELS[scenario.role]} · about {scenario.minutes} min
      </p>
      <h1 className="mt-2 text-[2.5rem] leading-[1.02] sm:text-6xl">{tx(scenario.title)}</h1>
      <p className="mt-5 max-w-xl font-display text-xl leading-snug text-ink-soft sm:text-2xl">{tx(scenario.setting)}</p>

      <div className="mt-8 flex items-center gap-4 border-y border-line py-5">
        <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-panel font-display text-2xl text-on-panel">
          {scenario.channel === "phone" ? <Phone className="size-6" /> : partnerName.charAt(0)}
        </span>
        <div>
          <p className="text-sm text-ink-faint">You’ll be talking with</p>
          <p className="font-display text-xl">{scenario.partner}</p>
        </div>
      </div>

      {resuming ? (
        <Callout tone="info" className="mt-6" title="You were part-way through">
          <p>Everything said so far is still here. Carry on from where you stopped.</p>
        </Callout>
      ) : null}

      {scenario.tryThis.length > 0 && !resuming ? (
        <section className="mt-8" aria-labelledby="ideas">
          <h2 id="ideas" className="text-2xl">Ideas, if you want one</h2>
          <ul className="mt-3">
            {scenario.tryThis.map((idea) => (
              <li key={idea} className="border-t border-line py-3 first:border-t-0 text-[1.0625rem]">
                {tx(idea)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[0.9375rem] text-ink-faint">Only ideas. However the conversation goes is fine.</p>
        </section>
      ) : null}

      <section className="mt-10 space-y-6" aria-labelledby="how">
        <h2 id="how" className="text-2xl">How you’ll take part</h2>
        <Segmented
          legend="Speak or type"
          options={[
            { id: "voice", label: "Speak" },
            { id: "text", label: "Type" },
          ]}
          value={wanted}
          onChange={(next) => {
            setWanted(next);
            updateProfile({ mode: next });
          }}
        />
        {wanted === "voice" && !canSpeak ? (
          <Callout tone="note">
            <p>
              Speaking isn’t available in this browser yet, so this conversation will be typed. Chrome, Edge and
              Safari can all turn your speech into text.
            </p>
          </Callout>
        ) : null}
        {wanted === "voice" && canSpeak ? (
          <ConsentCard
            purpose="voice"
            allowLabel="Allow speech recognition"
            alternative={
              <Button variant="secondary" onClick={() => setWanted("text")}>
                I’ll type instead
              </Button>
            }
          />
        ) : null}
        {mode === "voice" ? (
          <p className="flex items-start gap-2 text-[0.9375rem] text-ink-soft">
            <Mic aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Your browser will ask for the microphone when you start. You can switch to typing at any point.
              {speakReplies && !caps.voices ? " This browser has no voice installed, so replies will be shown as text." : ""}
            </span>
          </p>
        ) : null}

        <Segmented<ListenerManner>
          legend={`How ${partnerName} comes across`}
          options={[
            { id: "warm", label: "Warm" },
            { id: "neutral", label: "Neutral" },
            { id: "brisk", label: "Brisk" },
          ]}
          value={manner}
          onChange={(next) => updatePartner({ manner: next })}
        />
        {manner === "brisk" ? (
          <p className="-mt-3 text-[0.9375rem] text-ink-soft">
            Brisk means short and businesslike, like a busy day. They still never hurry you.
          </p>
        ) : null}

        <div className="border-t border-line pt-5">
          <p className="font-semibold">Partner: {partner === "ai" ? "AI partner" : "scripted partner"}</p>
          <p className="mt-0.5 text-[0.9375rem] text-ink-soft">
            {partner === "ai"
              ? "Replies are written by an AI that responds to what you actually say."
              : !online
                ? "You’re offline, so this scene follows a script. It works without a connection and sends nothing anywhere."
                : caps.ai === null
                  ? "Checking whether the AI partner is available…"
                  : !caps.ai
                    ? "This scene follows a script. It sends nothing anywhere."
                    : scriptedOnly
                      ? "You’ve chosen to keep conversations on this device, so this scene follows a script."
                      : "This scene will follow a script unless you switch on the AI partner below."}
          </p>
          {aiReachable && !scriptedOnly ? (
            <div className="mt-3">
              <ConsentCard purpose="ai" allowLabel="Use the AI partner" />
            </div>
          ) : null}
        </div>
      </section>

      <div className="safe-bottom sticky bottom-0 -mx-4 mt-10 border-t border-line bg-paper/95 px-4 pt-4 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="mb-3 text-[0.9375rem] text-ink-soft">
          {partnerName} replies only after you press <strong className="font-semibold text-ink">I’m finished</strong>. Silence
          never ends your turn.
        </p>
        <Button size="xl" block onClick={() => onBegin({ mode, partner })}>
          {resuming ? "Carry on" : scenario.channel === "phone" ? (scenario.whoStarts === "user" ? "Wait for the call" : "Make the call") : "Start the conversation"}
        </Button>
      </div>
    </div>
  );
}

function WrapUp({
  scenario,
  recordedId,
  summary,
  doneHref,
  againHref,
  fromDaily,
}: {
  scenario: Scenario;
  recordedId: string | null;
  summary: { turns: number; seconds: number } | null;
  doneHref: string;
  againHref: string;
  fromDaily: boolean;
}) {
  const tx = useTx();
  const router = useRouter();
  const rateRoleplay = useApp((s) => s.rateRoleplay);
  const setDailyStep = useApp((s) => s.setDailyStep);
  const keepsText = useConsent("transcripts");
  const days = useData((d) => d.settings.retention.transcriptDays);
  const [ratings, setRatings] = useState<SelfRatings>({});
  const [note, setNote] = useState("");

  // Coming from today's session, this counts as its conversation step.
  useEffect(() => {
    if (fromDaily) setDailyStep("talk", "done");
  }, [fromDaily, setDailyStep]);

  const finish = (href: string) => {
    if (recordedId && (Object.keys(ratings).length > 0 || note.trim())) rateRoleplay(recordedId, ratings, note);
    router.push(href);
  };

  return (
    <div className="pb-8">
      <p className="text-sm font-semibold text-teal">Conversation complete</p>
      <h1 className="mt-2 text-[2.5rem] leading-[1.02] sm:text-6xl">You saw it through.</h1>
      <p className="mt-4 font-display text-xl text-ink-soft">{tx(scenario.title)}</p>
      {summary ? (
        <dl className="mt-8 grid grid-cols-2 border-y border-line">
          <div className="py-5 pr-4">
            <dt className="text-sm text-ink-faint">Turns you took</dt>
            <dd className="mt-1 font-display text-5xl font-medium tracking-[-0.03em]">{summary.turns}</dd>
          </div>
          <div className="border-l border-line py-5 pl-5">
            <dt className="text-sm text-ink-faint">Time, at your pace</dt>
            <dd className="mt-1 font-display text-5xl font-medium tracking-[-0.03em]">
              {Math.max(1, Math.round(summary.seconds / 60))}
              <span className="ml-1 text-2xl text-ink-soft">min</span>
            </dd>
          </div>
        </dl>
      ) : null}
      <p className="mt-4 text-[0.9375rem] text-ink-faint">
        {keepsText
          ? days === 0
            ? "The text of this conversation is saved on this device until you delete it."
            : `The text of this conversation is saved on this device for ${days} days.`
          : "The text of this conversation has not been kept."}
      </p>

      <section className="mt-12 space-y-7">
        <div>
          <h2 className="text-[1.75rem]">How was that for you?</h2>
          <p className="mt-1 text-[0.9375rem] text-ink-soft">
            Entirely optional, and only ever your own view. Nothing about your speech was measured.
          </p>
        </div>
        {RATING_ORDER.map((key) => (
          <RatingScale
            key={key}
            legend={RATING_ITEMS[key].momentQuestion}
            low={RATING_ITEMS[key].low}
            high={RATING_ITEMS[key].high}
            value={ratings[key]}
            onChange={(value) =>
              setRatings((r) => {
                const next = { ...r };
                if (value === undefined) delete next[key];
                else next[key] = value;
                return next;
              })
            }
          />
        ))}
        <TextArea
          label="Anything you’d like to remember?"
          optional
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
        />
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button size="lg" onClick={() => finish(doneHref)}>
          Done
        </Button>
        <Button size="lg" variant="secondary" onClick={() => finish(againHref)}>
          Have another go
        </Button>
      </div>
    </div>
  );
}
