import type { Term } from "./types";

/**
 * People call their own speech different things. Copy is written once with
 * placeholders — "{stammer}", "{stammering}", "{therapist}" — and rendered in
 * the person's own words.
 */

const WORDS: Record<Term, Record<string, string>> = {
  stammer: {
    stammer: "stammer",
    stammers: "stammers",
    stammering: "stammering",
    stammered: "stammered",
    Stammer: "Stammer",
    Stammers: "Stammers",
    Stammering: "Stammering",
    therapist: "speech and language therapist",
    therapists: "speech and language therapists",
    Therapist: "Speech and language therapist",
    therapy: "speech and language therapy",
  },
  stutter: {
    stammer: "stutter",
    stammers: "stutters",
    stammering: "stuttering",
    stammered: "stuttered",
    Stammer: "Stutter",
    Stammers: "Stutters",
    Stammering: "Stuttering",
    therapist: "speech-language pathologist",
    therapists: "speech-language pathologists",
    Therapist: "Speech-language pathologist",
    therapy: "speech therapy",
  },
};

export type Tx = (text: string) => string;

export function makeTx(term: Term): Tx {
  const words = WORDS[term];
  return (text) => text.replace(/\{([A-Za-z]+)\}/g, (whole, key: string) => words[key] ?? whole);
}

export const TERM_KEYS = Object.keys(WORDS.stammer);
