import type { RatingKey, RegionId } from "../types";

/**
 * The choices offered while setting up and planning. Every list is optional
 * and nothing here is a diagnosis: these are just words people use for their
 * own experience. `{stammer}` placeholders become the person's own term.
 */

export interface Option {
  id: string;
  label: string;
  detail?: string;
}

export const GOAL_OPTIONS: Option[] = [
  { id: "say_what_i_want", label: "Say what I want to say, even if I {stammer}" },
  { id: "less_avoiding", label: "Stop swapping words and dodging situations" },
  { id: "phone", label: "Feel easier about phone calls" },
  { id: "work_study", label: "Speak up more at work or in class" },
  { id: "interviews", label: "Get ready for an interview or presentation" },
  { id: "introductions", label: "Introduce myself and say my name" },
  { id: "less_struggle", label: "{Stammer} with less tension and struggle" },
  { id: "techniques", label: "Learn speech techniques I can choose to use" },
  { id: "openness", label: "Be more open about my {stammering}" },
  { id: "everyday", label: "Enjoy everyday conversations more" },
];

export const SITUATION_OPTIONS: Option[] = [
  { id: "phone_calls", label: "Phone calls" },
  { id: "ordering", label: "Ordering food and drink" },
  { id: "introductions", label: "Introductions and saying my name" },
  { id: "meetings", label: "Meetings at work" },
  { id: "classes", label: "Classes and seminars" },
  { id: "presentations", label: "Presentations" },
  { id: "interviews", label: "Interviews" },
  { id: "small_talk", label: "Small talk and meeting new people" },
  { id: "authority", label: "Talking to managers, lecturers or officials" },
  { id: "appointments", label: "Appointments and customer service" },
  { id: "friends_family", label: "With friends and family" },
];

export const EXPERIENCE_OPTIONS: Option[] = [
  { id: "blocks", label: "Getting stuck with no sound coming out" },
  { id: "repetitions", label: "Repeating sounds or parts of words" },
  { id: "prolongations", label: "Stretching sounds out" },
  { id: "tension", label: "Tension or pushing when I speak" },
  { id: "word_swapping", label: "Swapping words to avoid getting stuck" },
  { id: "avoiding_situations", label: "Staying quiet or avoiding situations" },
  { id: "hiding", label: "Working hard to hide it" },
  { id: "anticipation", label: "Dreading certain words or moments" },
  { id: "own_name", label: "Trouble saying my own name" },
  { id: "variability", label: "It changes a lot from day to day" },
];

/** Things a person might choose to lean on in a real conversation. */
export const SUPPORT_OPTIONS: Option[] = [
  { id: "disclose", label: "Mention that I {stammer}" },
  { id: "pause", label: "Give myself permission to pause" },
  { id: "say_word", label: "Say the word I mean, not a swap" },
  { id: "easy_start", label: "Start my first word gently" },
  { id: "slow_first", label: "Take my first few words slowly" },
  { id: "eye_contact", label: "Keep eye contact if I {stammer}" },
  { id: "voluntary", label: "{Stammer} on purpose once, early on" },
  { id: "breath", label: "Let one slow breath out before I start" },
  { id: "notes", label: "Bring notes or key points" },
  { id: "kind", label: "Be kind to myself whatever happens" },
];

export const REGION_OPTIONS: { id: RegionId; label: string }[] = [
  { id: "uk", label: "United Kingdom" },
  { id: "ie", label: "Ireland" },
  { id: "us", label: "United States" },
  { id: "ca", label: "Canada" },
  { id: "au", label: "Australia" },
  { id: "nz", label: "New Zealand" },
  { id: "za", label: "South Africa" },
  { id: "in", label: "India" },
  { id: "other", label: "Somewhere else" },
];

/**
 * The four self-reported measures. Wording is deliberately neutral: a higher
 * or lower number is information for the person, never a grade.
 */
export const RATING_ITEMS: Record<
  RatingKey,
  { title: string; question: string; momentQuestion: string; low: string; high: string }
> = {
  confidence: {
    title: "Confidence",
    question: "How confident do you feel about speaking today?",
    momentQuestion: "How confident did you feel speaking?",
    low: "Not at all",
    high: "Very",
  },
  participation: {
    title: "Saying what I wanted",
    question: "Lately, how much have you been saying what you want to say?",
    momentQuestion: "How much did you say what you wanted to say?",
    low: "None of it",
    high: "All of it",
  },
  effort: {
    title: "Physical effort",
    question: "How much physical effort is speaking taking at the moment?",
    momentQuestion: "How much physical effort or struggle was there?",
    low: "None",
    high: "A great deal",
  },
  avoidance: {
    title: "Holding back",
    question: "How much are you holding back, swapping words or avoiding?",
    momentQuestion: "How much did you hold back, swap words or avoid?",
    low: "Not at all",
    high: "A lot",
  },
};

export const RATING_ORDER: RatingKey[] = ["confidence", "participation", "effort", "avoidance"];

export function labelFor(options: Option[], id: string): string {
  return options.find((o) => o.id === id)?.label ?? id;
}
