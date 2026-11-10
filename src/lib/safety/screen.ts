/**
 * Safety checks that must not depend on a language model.
 *
 * Two jobs:
 *  - notice when someone may be telling us they are in crisis, so we can step
 *    out of the practice and point to real help (a fixed, reviewed message —
 *    never an improvised one);
 *  - check every line the partner is about to say against the behaviour
 *    contract (no hurrying, no remarks on fluency, no imitation).
 *
 * Both run in the browser and again on the server.
 */

import { ASIDE_PREFIX } from "../conversation/machine";

// --- Crisis ------------------------------------------------------------------

const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid(e|al)\b/i,
  /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+my\s?self\b/i,
  /\b(end|ending|take|taking)\s+my\s+(own\s+)?life\b/i,
  /\b(want|wanted|wanting|wish|going)\s+to\s+die\b/i,
  /\bwish\s+i\s+(was|were)\s+dead\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\b(don'?t|do\s+not|dont)\s+want\s+to\s+(be\s+here|live|be\s+alive|exist|wake\s+up)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|go\s+on|going\s+on)\b/i,
  /\bcan'?t\s+go\s+on\s+(living|any\s?more|like\s+this)\b/i,
  /\bself[-\s]?harm/i,
  /\bend\s+it\s+all\b/i,
];

/** True when the words suggest the person may be at risk of harming themselves. */
export function suggestsCrisis(text: string): boolean {
  const normal = text.replace(/[’‘]/g, "'");
  return CRISIS_PATTERNS.some((p) => p.test(normal));
}

/**
 * What the partner says when a crisis phrase is noticed. Fixed wording: it
 * makes no promises, no diagnosis, and no claim that anyone is watching.
 */
export const CRISIS_REPLY =
  `${ASIDE_PREFIX} thank you for telling me — what you’re feeling matters. ` +
  "I’m a practice partner inside an app, so I can’t help the way a person can, and nobody is monitoring this conversation. " +
  "If you might act on these thoughts, or you’re in danger, please contact your local emergency number now. " +
  "You deserve real support: a crisis line or someone you trust can listen today, and the Support page has numbers for where you live. " +
  "We can carry on practising whenever you want, or stop here.";

// --- The behaviour contract, applied to the partner's own lines ---------------

export type ContractRule = "pace" | "fluency" | "imitation";

const PACE: RegExp[] = [
  /\bslow\s+(it\s+)?down\b/i,
  /\bspeed\s+(it\s+)?up\b/i,
  /\bhurry\s+up\b/i,
  /\bspit\s+it\s+out\b/i,
  /\bget\s+(it|the\s+words?)\s+out\b/i,
  /\b(don'?t|do\s+not|haven'?t)\s+(have|got)\s+all\s+day\b/i,
  /\btake\s+your\s+time\b/i,
  /\btake\s+a\s+(deep\s+|big\s+)?breath\b/i,
  /\b(just|try\s+to|please)\s+(relax|breathe|calm\s+down)\b/i,
  /\bcalm\s+down\b/i,
  /\bno\s+rush\b/i,
];

const FLUENCY: RegExp[] = [
  /\b(so|very|really|perfectly|more|much|sound(ed|s)?|spoke|speaking|were|was)\s+(fluent(ly)?|smooth(ly)?)\b/i,
  /\b(didn'?t|did\s+not|don'?t|do\s+not|barely|hardly|never)\s+(even\s+)?(stammer|stutter)/i,
  /\b(no|without\s+(a|any)?)\s*(stammer|stutter)(ing)?\b/i,
  /\bperfect(ly)?\s+(fluent|fluency|speech)\b/i,
  /\byour\s+(speech|fluency|stammer|stutter)\s+(is|was|sounds?|sounded|seems?)\s+(better|great|good|fine|improv)/i,
];

// "c-c-coffee", "w-w-what": written imitation of repeated sounds.
const IMITATION = /\b([a-z]{1,3})-\1-/i;

/** The rule a line breaks, or null when it is fine to say. */
export function brokenRule(line: string): ContractRule | null {
  const normal = line.replace(/[’‘]/g, "'");
  if (IMITATION.test(normal)) return "imitation";
  if (PACE.some((p) => p.test(normal))) return "pace";
  if (FLUENCY.some((p) => p.test(normal))) return "fluency";
  return null;
}

/** A line that is safe in any scene, used if a reply has to be withheld. */
export const NEUTRAL_LINE = "Okay — go on.";

/** Said in place of a reply the AI service declined to give. */
export const DECLINED_REPLY = `${ASIDE_PREFIX} I can’t respond to that here. We can carry on with the practice whenever you like.`;
