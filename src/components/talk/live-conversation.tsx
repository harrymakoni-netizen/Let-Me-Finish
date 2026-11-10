"use client";

import {
  Check,
  Flag,
  Keyboard,
  Mic,
  Pause,
  Pencil,
  Phone,
  Play,
  RotateCcw,
  SkipForward,
  Square,
} from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ReportDialog } from "@/components/report-dialog";
import { SupportPanel } from "@/components/support-panel";
import { Button } from "@/components/ui/button";
import { Callout, Tag } from "@/components/ui/layout";
import type { Scenario } from "@/lib/content/scenarios";
import type { ConversationController } from "@/lib/conversation/controller";
import type { MachineState } from "@/lib/conversation/machine";
import { ASIDE_PREFIX } from "@/lib/conversation/machine";
import { useApp, useData, useTx } from "@/lib/hooks";
import type { ChatMessage } from "@/lib/types";
import { cx } from "@/lib/util";

/**
 * The live conversation.
 *
 * One rule shapes this screen: the large button at the bottom is always the
 * person's next move, and while their turn is open that move is "I'm
 * finished". Nothing else on the page can end their turn.
 */
export function LiveConversation({
  controller,
  scenario,
  voiceCapable,
  spoken,
}: {
  controller: ConversationController;
  scenario: Scenario;
  /** A microphone is in play for this session. */
  voiceCapable: boolean;
  /** Replies are being read aloud by the partner's voice. */
  spoken: boolean;
}) {
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const m = view.machine;
  const tx = useTx();
  const showWords = useData((d) => d.settings.voice.liveTranscript);
  const updateVoice = useApp((s) => s.updateVoice);
  const [report, setReport] = useState<{ open: boolean; context?: string }>({ open: false });
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const partnerName = scenario.partner.split(",")[0];

  usePauseWhenHidden(controller);
  useKeepAwake(m.phase !== "ended" && !m.paused);

  // Keep the newest words in view, just above the turn panel.
  const lastCount = m.messages.length + (m.reply?.text ? 1 : 0);
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [lastCount, m.reply?.text, m.phase, view.supportSuggested]);

  let lastUserIndex = -1;
  for (let i = m.messages.length - 1; i >= 0; i--) {
    if (m.messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  const canEditLast = !m.paused && (m.phase === "idle" || (m.phase === "user_turn_open" && !m.draft && !m.interim));
  const streaming = m.phase === "ai_responding" && m.reply && !m.reply.complete ? m.reply.text : "";

  return (
    <div className="flex flex-1 flex-col">
      {/* Pause and End stay within reach however long the conversation gets. */}
      <header className="sticky top-0 z-10 -mx-4 -mt-4 flex items-start justify-between gap-3 border-b border-line bg-paper px-4 pb-3 pt-4 sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-lg leading-snug sm:text-2xl">{tx(scenario.title)}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.9375rem] text-ink-soft">
            {scenario.channel === "phone" ? <Phone aria-hidden="true" className="size-4" /> : null}
            <span>With {scenario.partner}</span>
            <Tag tone={view.partner === "ai" ? "violet" : "plain"}>
              {view.partner === "ai" ? "AI partner" : "Scripted partner"}
            </Tag>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {m.paused ? null : (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pause aria-hidden="true" className="size-4" />}
              onClick={() => controller.dispatch({ type: "PAUSE" })}
            >
              Pause
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Square aria-hidden="true" className="size-4" />}
            onClick={() => controller.dispatch({ type: "STOP" })}
          >
            End
          </Button>
        </div>
      </header>

      {view.notice ? (
        <Callout tone="note" role="status" className="mt-3">
          <p>{view.notice}</p>
        </Callout>
      ) : null}

      <div
        role="log"
        aria-label="Conversation"
        // When the partner's voice is reading replies aloud, a screen reader
        // announcing them as well would say everything twice.
        aria-live={spoken ? "off" : "polite"}
        className="mt-4 min-h-40 flex-1 space-y-3 pb-4"
      >
        {m.messages.length === 0 && !streaming ? (
          <p className="pt-6 text-center text-ink-soft">
            {scenario.whoStarts === "user" ? scenario.userOpensWith : `${partnerName} will speak first.`}
          </p>
        ) : null}
        {m.messages.map((message, index) => (
          <Bubble
            key={message.id}
            message={message}
            partnerName={partnerName}
            onFlag={() => setReport({ open: true, context: message.text })}
            onEdit={
              canEditLast && index === lastUserIndex
                ? () => setEditing({ id: message.id, text: message.text })
                : undefined
            }
            editing={editing?.id === message.id ? editing.text : null}
            onEditChange={(text) => setEditing((e) => (e ? { ...e, text } : e))}
            onEditCancel={() => setEditing(null)}
            onEditSave={() => {
              if (editing) controller.dispatch({ type: "EDIT_LAST", text: editing.text });
              setEditing(null);
            }}
          />
        ))}
        {streaming ? (
          <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3" aria-hidden="true">
            <p className="text-sm font-semibold text-ink-faint">{partnerName}</p>
            <p>{streaming}</p>
          </div>
        ) : null}
        {view.supportSuggested ? <SupportPanel /> : null}
      </div>

      <TurnPanel
        controller={controller}
        state={m}
        partnerName={partnerName}
        voiceCapable={voiceCapable}
        showWords={showWords}
        onToggleWords={() => updateVoice({ liveTranscript: !showWords })}
        onUseScripted={() => controller.useScriptedPartner("Carrying on with the scripted partner.")}
        isAi={view.partner === "ai"}
      />

      <ReportDialog
        open={report.open}
        onClose={() => setReport({ open: false })}
        defaultKind="partner_reply"
        context={report.context}
      />
    </div>
  );
}

function Bubble({
  message,
  partnerName,
  onFlag,
  onEdit,
  editing,
  onEditChange,
  onEditCancel,
  onEditSave,
}: {
  message: ChatMessage;
  partnerName: string;
  onFlag: () => void;
  onEdit?: () => void;
  editing: string | null;
  onEditChange: (text: string) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
}) {
  const editId = useId();
  if (message.role === "partner") {
    const text = message.aside ? message.text.replace(ASIDE_PREFIX, "").trim() : message.text;
    return (
      <div
        className={cx(
          "group max-w-[88%] rounded-2xl rounded-tl-md border px-4 py-3",
          message.aside ? "border-teal/50 bg-teal-wash" : "border-line bg-surface",
        )}
      >
        <p className="text-sm font-semibold text-ink-faint">
          {message.aside ? "Stepping out of the scene" : partnerName}
        </p>
        <p className="whitespace-pre-wrap">{message.aside ? text.charAt(0).toUpperCase() + text.slice(1) : text}</p>
        <button
          type="button"
          onClick={onFlag}
          className="-mb-1 -ml-1.5 mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-control px-1.5 text-sm text-ink-faint hover:bg-sunk hover:text-ink"
        >
          <Flag aria-hidden="true" className="size-3.5" />
          Report this reply
        </button>
      </div>
    );
  }
  return (
    <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-teal-wash px-4 py-3">
      <p className="text-sm font-semibold text-ink-faint">You{message.edited ? " · corrected" : ""}</p>
      {editing !== null ? (
        <div>
          <label htmlFor={editId} className="sr-only">
            Correct what you said
          </label>
          <textarea
            id={editId}
            autoFocus
            rows={3}
            value={editing}
            onChange={(e) => onEditChange(e.target.value)}
            className="mt-1 w-full rounded-control border border-line-strong bg-surface px-3 py-2"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={onEditSave} disabled={!editing.trim()}>
              Save and ask again
            </Button>
            <Button size="sm" variant="secondary" onClick={onEditCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{message.text}</p>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="-mb-1 -ml-1.5 mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-control px-1.5 text-sm text-ink-soft hover:bg-surface hover:text-ink"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              That’s not what I said — correct it
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function TurnPanel({
  controller,
  state: m,
  partnerName,
  voiceCapable,
  showWords,
  onToggleWords,
  onUseScripted,
  isAi,
}: {
  controller: ConversationController;
  state: MachineState;
  partnerName: string;
  voiceCapable: boolean;
  showWords: boolean;
  onToggleWords: () => void;
  onUseScripted: () => void;
  isAi: boolean;
}) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const draftId = useId();
  const hintId = useId();

  // When the main action changes, keep the keyboard on it: Space or Enter is
  // then always "the next thing", including "I'm finished".
  const focusKey = `${m.phase}:${m.paused}:${m.inputVia}:${m.ready?.awaitingTranscript}:${m.ready?.empty}`;
  useEffect(() => {
    const active = document.activeElement;
    const adrift = !active || active === document.body || active.closest("[data-turn-panel]") !== null;
    if (!adrift) return;
    if (m.phase === "user_turn_open" && m.inputVia === "text" && !m.paused) textRef.current?.focus();
    else primaryRef.current?.focus();
  }, [focusKey, m.phase, m.inputVia, m.paused]);

  const wrap = "safe-bottom sticky bottom-0 -mx-4 -mb-8 border-t border-line bg-paper px-4 pt-3 sm:-mx-6 sm:px-6";

  if (m.paused) {
    return (
      <section data-turn-panel aria-label="Your turn" className={wrap}>
        <p role="status" className="font-semibold">
          Paused. The microphone is off and nothing is being listened to.
        </p>
        <p className="text-[0.9375rem] text-ink-soft">Everything you’ve said so far is still here.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            ref={primaryRef}
            size="lg"
            icon={<Play aria-hidden="true" className="size-5" />}
            onClick={() => controller.dispatch({ type: "RESUME" })}
          >
            Resume
          </Button>
          <Button variant="secondary" size="lg" onClick={() => controller.dispatch({ type: "STOP" })}>
            End conversation
          </Button>
        </div>
      </section>
    );
  }

  if (m.phase === "ai_responding") {
    const arriving = !m.reply?.complete;
    return (
      <section data-turn-panel aria-label="Your turn" className={wrap}>
        <p role="status" className="font-semibold">
          {arriving ? `${partnerName} is replying…` : `${partnerName} is speaking.`}
        </p>
        <div className="mt-3">
          <Button
            ref={primaryRef}
            variant="secondary"
            size="lg"
            icon={<SkipForward aria-hidden="true" className="size-5" />}
            onClick={() => controller.dispatch({ type: "OPEN_TURN" })}
          >
            Skip to my turn
          </Button>
        </div>
      </section>
    );
  }

  if (m.phase === "user_turn_ready") {
    if (m.ready?.awaitingTranscript) {
      return (
        <section data-turn-panel aria-label="Your turn" className={wrap}>
          <p role="status" className="font-semibold">
            Gathering your words…
          </p>
        </section>
      );
    }
    return (
      <section data-turn-panel aria-label="Your turn" className={wrap}>
        {m.ready?.empty ? (
          <p role="status" className="font-semibold">
            No words were picked up that time. That’s the software’s miss, not yours.
          </p>
        ) : (
          <p role="status" className="font-semibold">
            Here’s what was heard. Change anything that’s wrong.
          </p>
        )}
        <label htmlFor={draftId} className="mt-2 block text-[0.9375rem] text-ink-soft">
          {m.ready?.empty ? "Type what you said, or have another go." : "Your words"}
        </label>
        <textarea
          id={draftId}
          ref={textRef}
          rows={3}
          value={m.draft}
          onChange={(e) => controller.dispatch({ type: "DRAFT_EDIT", text: e.target.value })}
          className="mt-1 w-full rounded-control border border-line-strong bg-surface px-4 py-3"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            ref={primaryRef}
            size="lg"
            icon={<Check aria-hidden="true" className="size-5" />}
            disabled={!m.draft.trim()}
            onClick={() => controller.dispatch({ type: "CONFIRM_SEND" })}
          >
            Send
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<Mic aria-hidden="true" className="size-5" />}
            onClick={() => controller.dispatch({ type: "KEEP_TALKING" })}
          >
            {m.ready?.empty ? "Try again" : "I wasn’t finished"}
          </Button>
        </div>
      </section>
    );
  }

  if (m.phase === "user_turn_open") {
    const typing = m.inputVia === "text";
    const heard = [m.draft, m.interim].filter(Boolean).join(" ");
    return (
      <section data-turn-panel aria-label="Your turn" className={wrap}>
        {m.error?.kind === "mic" ? (
          <Callout tone="warn" role="status" className="mb-3">
            <p>{m.error.message}</p>
          </Callout>
        ) : null}

        {typing ? (
          <>
            <label htmlFor={draftId} className="block font-semibold">
              Your turn. Type what you’d like to say.
            </label>
            <p id={hintId} className="text-[0.9375rem] text-ink-soft">
              {partnerName} waits until you press “I’m finished”.
            </p>
            <textarea
              id={draftId}
              ref={textRef}
              rows={3}
              aria-describedby={hintId}
              value={m.draft}
              onChange={(e) => controller.dispatch({ type: "DRAFT_EDIT", text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  controller.dispatch({ type: "FINISH_TURN" });
                }
              }}
              className="mt-2 w-full rounded-control border border-line-strong bg-surface px-4 py-3"
            />
          </>
        ) : (
          <>
            <p role="status" className="flex items-center gap-2.5 font-semibold">
              <span aria-hidden="true" className="relative flex size-3">
                <span className="absolute inset-0 rounded-full bg-teal" />
              </span>
              Your turn. Listening — for as long as you need.
            </p>
            <p id={hintId} className="text-[0.9375rem] text-ink-soft">
              Silence never ends your turn. Only “I’m finished” does.
            </p>
            <div className="mt-2 min-h-[4.5rem] rounded-control border border-line bg-surface px-4 py-3">
              {showWords ? (
                heard ? (
                  <p>
                    {m.draft}
                    {m.draft && m.interim ? " " : ""}
                    <span className="text-ink-faint">{m.interim}</span>
                  </p>
                ) : (
                  <p className="text-ink-faint">Your words will appear here as you speak.</p>
                )
              ) : (
                <p className="text-ink-faint">Your words are being heard, and are hidden while you speak.</p>
              )}
            </div>
          </>
        )}

        <div className="mt-3">
          <Button
            ref={primaryRef}
            size="xl"
            block
            icon={<Check aria-hidden="true" className="size-6" />}
            aria-describedby={hintId}
            aria-disabled={typing && !m.draft.trim() ? true : undefined}
            onClick={() => {
              if (typing && !m.draft.trim()) {
                textRef.current?.focus();
                return;
              }
              controller.dispatch({ type: "FINISH_TURN" });
            }}
          >
            I’m finished
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
          {voiceCapable ? (
            typing ? (
              <Button
                variant="quiet"
                size="sm"
                icon={<Mic aria-hidden="true" className="size-4" />}
                onClick={() => controller.dispatch({ type: "SWITCH_INPUT", via: "voice" })}
              >
                Use my voice
              </Button>
            ) : (
              <>
                <Button
                  variant="quiet"
                  size="sm"
                  icon={<Keyboard aria-hidden="true" className="size-4" />}
                  onClick={() => controller.dispatch({ type: "SWITCH_INPUT", via: "text" })}
                >
                  Type instead
                </Button>
                <Button variant="quiet" size="sm" onClick={onToggleWords} aria-pressed={!showWords}>
                  {showWords ? "Hide my words" : "Show my words"}
                </Button>
              </>
            )
          ) : (
            <p className="text-sm text-ink-faint">Ctrl or ⌘ + Enter also sends.</p>
          )}
        </div>
      </section>
    );
  }

  // Idle: between turns, or after something went wrong.
  return (
    <section data-turn-panel aria-label="Your turn" className={wrap}>
      {m.error?.kind === "partner" ? (
        <Callout tone="warn" role="alert" className="mb-3" title="The partner couldn’t reply">
          <p>{m.error.message} Your words are safe.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {m.error.canRetry ? (
              <Button
                size="sm"
                icon={<RotateCcw aria-hidden="true" className="size-4" />}
                onClick={() => controller.dispatch({ type: "RETRY_REPLY" })}
              >
                Try again
              </Button>
            ) : null}
            {isAi ? (
              <Button size="sm" variant="secondary" onClick={onUseScripted}>
                Carry on with the scripted partner
              </Button>
            ) : null}
          </div>
        </Callout>
      ) : null}
      {m.sceneClosed ? (
        <p className="mb-2 text-[0.9375rem] text-ink-soft">
          That’s the end of this scene. Finish whenever you like, or keep going.
        </p>
      ) : null}
      {m.error?.kind === "partner" ? null : (
        <>
          <p role="status" className="font-semibold">
            Ready when you are.
          </p>
          <div className="mt-3">
            <Button
              ref={primaryRef}
              size="xl"
              block
              icon={voiceCapable ? <Mic aria-hidden="true" className="size-6" /> : undefined}
              onClick={() => controller.dispatch({ type: "OPEN_TURN" })}
            >
              Start my turn
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

/** Leaving the tab or the screen pauses everything: no microphone runs unseen. */
function usePauseWhenHidden(controller: ConversationController) {
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") controller.suspend();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
      // The screen itself is going away (navigation): same rule. React's
      // development-mode rehearsal remounts at once, so wait a tick to be sure.
      shown.current = false;
      setTimeout(() => {
        if (!shown.current) controller.suspend();
      }, 0);
    };
  }, [controller]);
}

/** Stop the screen dimming mid-pause; a sleeping phone would cut the microphone. */
function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock
      .request("screen")
      .then((sentinel) => {
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      })
      .catch(() => {
        /* not allowed right now; carry on without it */
      });
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
