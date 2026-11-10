import type { Scenario } from "../content/scenarios";
import { CRISIS_REPLY, suggestsCrisis } from "../safety/screen";
import { makeTx } from "../terms";
import type { ChatMessage, Term } from "../types";
import { ASIDE_PREFIX } from "./machine";

/**
 * The scripted partner.
 *
 * It needs no network and sends nothing anywhere. It walks through the
 * scenario's lines in order, with a few human touches: it will repeat itself
 * if asked, takes a mention of stammering in its stride, and never says a
 * word about how someone speaks.
 */

export interface PartnerLine {
  text: string;
  closing: boolean;
  aside: boolean;
  beat: number;
}

const ASKS_TO_REPEAT =
  /\b(pardon|say\s+that\s+again|repeat\s+that|can\s+you\s+repeat|could\s+you\s+repeat|didn'?t\s+(catch|hear)|come\s+again|what\s+was\s+that)\b|^\s*(sorry|what)\s*\?*\s*$/i;
const SAYS_GOODBYE = /\b(bye|goodbye|see\s+you|that'?s\s+(all|everything|it)|nothing\s+else|no\s+thanks?,?\s+that'?s)\b/i;
const MENTIONS_STAMMER = /\b(stammer|stutter)/i;
const ASKS_CLINICAL =
  /\b(diagnos\w*|cure[ds]?|treatment|medication|therap(y|ist)|patholog\w+)\b.*\?|\b(do|did|does)\s+i\s+(stammer|stutter)\b|\bhow\s+(bad|severe)\b/i;

const ACKNOWLEDGEMENT = "No problem at all.";
const AFTER_SCENE = ["Is there anything else you’d like to say?", "Okay.", "Alright."];

function lastBeat(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "partner" && typeof m.beat === "number") return m.beat;
  }
  return 0;
}

export function scriptedReply(scenario: Scenario, messages: ChatMessage[], term: Term): PartnerLine {
  const tx = makeTx(term);
  const said = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";
  const previousLine = [...messages].reverse().find((m) => m.role === "partner" && !m.aside);
  const beat = lastBeat(messages);

  if (suggestsCrisis(said)) {
    return { text: CRISIS_REPLY, closing: false, aside: true, beat };
  }

  if (ASKS_CLINICAL.test(said)) {
    return {
      text: tx(
        `${ASIDE_PREFIX} I’m a scripted practice partner, so I can’t assess or advise on speech. A qualified {therapist} can, and the Library here has general information. Shall we carry on?`,
      ),
      closing: false,
      aside: true,
      beat,
    };
  }

  if (previousLine && ASKS_TO_REPEAT.test(said)) {
    const again = previousLine.text.replace(/^Of course\.\s+/, "");
    return { text: `Of course. ${again}`, closing: false, aside: false, beat };
  }

  const closingBeat = scenario.beats.length + 1;
  let next = beat + 1;
  // A goodbye skips ahead to the scene's closing line.
  if (SAYS_GOODBYE.test(said) && next < closingBeat && messages.some((m) => m.role === "partner")) {
    next = closingBeat;
  }

  let text: string;
  let closing = false;
  if (next <= scenario.beats.length) {
    text = scenario.beats[next - 1];
  } else if (next === closingBeat) {
    text = scenario.closing;
    closing = true;
  } else {
    text = AFTER_SCENE[(next - closingBeat - 1) % AFTER_SCENE.length];
    closing = true;
  }

  // Someone mentioning their stammer gets a brief, matter-of-fact reply — once.
  const alreadyAcknowledged = messages.some((m) => m.role === "partner" && m.text.startsWith(ACKNOWLEDGEMENT));
  if (MENTIONS_STAMMER.test(said) && !alreadyAcknowledged) {
    text = `${ACKNOWLEDGEMENT} ${text}`;
  }

  return { text: tx(text), closing, aside: false, beat: next };
}
