import type { Journey, NextStep } from "./types";

export interface Suggestion { kind: NextStep["kind"]; label: string; detail: string; href?: string }

/**
 * Next-step suggestions come only from what the person chose and reported
 * (whether they took part, how much they held back), never from fluency, and
 * never declare success or failure.
 */
export function suggestNextSteps(j: Journey): Suggestion[] {
  const outcome = j.attempt?.outcome;
  const avoid = j.reflection?.ratings.avoidance;
  const out: Suggestion[] = [];
  if (outcome === "did") out.push({ kind: "bigger", label: "Try something a step bigger", detail: "When you’re ready, not before.", href: "/journeys" });
  if (outcome === "partly" || (avoid !== undefined && avoid >= 4)) out.push({ kind: "smaller", label: "Try a smaller version first", detail: "A shorter or easier version of the same thing.", href: "/journeys" });
  out.push({ kind: "repeat", label: "Do the same again", detail: "Repetition in real life is how it gets familiar.", href: "/journeys" });
  out.push({ kind: "rehearse", label: "Rehearse something different", detail: "A different scene, just for practice.", href: "/talk" });
  out.push({ kind: "module", label: "Read something in the Library", detail: "Optional.", href: "/library" });
  out.push({ kind: "rest", label: "Rest for now", detail: "Stepping back is a valid choice." });
  return out;
}
