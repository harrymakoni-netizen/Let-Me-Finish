/**
 * Learning modules. IMPORTANT: none of this has yet been reviewed by a licensed
 * speech-language therapist. Each module carries its review record; the app
 * shows "Awaiting clinical review" until reviewer, date and evidence are filled
 * in. Do not remove that notice before a real review (blueprint §06).
 */
export interface ModuleReview {
  status: "awaiting" | "reviewed";
  reviewer?: string;
  reviewedOn?: string;
  evidence?: string;
}
export interface Module {
  id: string;
  title: string;
  version: string;
  kind: "technique" | "acceptance" | "participation" | "information";
  minutes: number;
  summary: string;
  steps: string[];
  notes: string[];
  contraindications: string;
  tags: string[];
  review: ModuleReview;
}

const NOT_FOR_EVERYONE =
  "Techniques suit different people and may not suit you. Skip anything that feels wrong, increases tension or makes speaking harder, and talk to a qualified {therapist} if you can.";
const awaiting: ModuleReview = { status: "awaiting" };

export const MODULES: Module[] = [
  {
    id: "gentle-onset",
    title: "Gentle starts",
    version: "0.1",
    kind: "technique",
    minutes: 4,
    summary: "Begin a phrase with a soft, easy breath of voice instead of a hard push.",
    steps: [
      "Let your shoulders drop. Breathe out gently.",
      "Say a short phrase such as “good morning”, letting the first sound start softly.",
      "Repeat with three more phrases you actually use.",
      "Notice what changed, if anything. No change is fine.",
    ],
    notes: ["This is a choice, not a rule. Many people never use it."],
    contraindications: NOT_FOR_EVERYONE,
    tags: ["technique", "voice", "easy"],
    review: awaiting,
  },
  {
    id: "light-contacts",
    title: "Light contacts",
    version: "0.1",
    kind: "technique",
    minutes: 4,
    summary: "Touch lips, tongue and teeth lightly when making sounds, rather than pressing hard.",
    steps: [
      "Say “pa pa pa” slowly with the lightest touch of the lips.",
      "Try “ta” and “ka” the same way.",
      "Put a light-contact word at the start of a real sentence.",
    ],
    notes: ["If you notice pressing or tension, that is useful to know, not a failure."],
    contraindications: NOT_FOR_EVERYONE,
    tags: ["technique", "tension"],
    review: awaiting,
  },
  {
    id: "easing-struggle",
    title: "Easing the struggle",
    version: "0.1",
    kind: "technique",
    minutes: 5,
    summary: "When you are stuck, soften instead of pushing: let go of tension and move on gently.",
    steps: [
      "Notice where you hold tension: jaw, neck, chest.",
      "Practise loosening that spot while saying a word you like.",
      "In a real moment, try releasing the tension rather than forcing the word.",
    ],
    notes: ["The aim is less struggle, not no {stammering}."],
    contraindications: NOT_FOR_EVERYONE,
    tags: ["technique", "tension", "blocks"],
    review: awaiting,
  },
  {
    id: "voluntary-stammering",
    title: "Voluntary {stammering}",
    version: "0.1",
    kind: "acceptance",
    minutes: 5,
    summary: "Choosing to {stammer} openly, on purpose, in a low-stakes moment. Some people find it takes the fear out.",
    steps: [
      "Pick a low-stakes moment, such as saying your name to a friend.",
      "Let one easy, open repetition or stretch happen on purpose.",
      "Carry on talking. Notice how it felt afterwards.",
    ],
    notes: ["Entirely optional. Many people say this feels frightening at first; go at your own pace."],
    contraindications: NOT_FOR_EVERYONE,
    tags: ["acceptance", "fear"],
    review: awaiting,
  },
  {
    id: "disclosure",
    title: "Telling people you {stammer}",
    version: "0.1",
    kind: "participation",
    minutes: 6,
    summary: "Write a short, plain sentence you could use to let someone know, if you want to.",
    steps: [
      "Write one factual sentence: “I {stammer}, so I may take a moment. Please bear with me.”",
      "Adjust it until it sounds like you. Avoid apologising if you would rather not.",
      "Rehearse it aloud, then in a Talk scene such as “Meeting someone new”.",
    ],
    notes: ["You decide whether, when and to whom. Never telling anyone is also fine."],
    contraindications: NOT_FOR_EVERYONE,
    tags: ["disclosure", "participation"],
    review: awaiting,
  },
  {
    id: "values-first",
    title: "Say what matters",
    version: "0.1",
    kind: "acceptance",
    minutes: 5,
    summary: "Notice what you want to say and why, before thinking about how it will sound.",
    steps: [
      "Think of a conversation you avoid. What did you want to get across?",
      "Write one sentence of it in your own words.",
      "Ask: what is one small step towards saying it?",
    ],
    notes: ["Communication is about getting your meaning across, not about perfect speech."],
    contraindications: NOT_FOR_EVERYONE,
    tags: ["acceptance", "participation", "avoidance"],
    review: awaiting,
  },
  {
    id: "about-stammering",
    title: "What stammering is, and isn't",
    version: "0.1",
    kind: "information",
    minutes: 3,
    summary: "A short, plain overview. Not a diagnosis, and not a substitute for a therapist.",
    steps: [],
    notes: [
      "Stammering (stuttering) is a natural variation in how people speak. It often includes repeated sounds, stretched sounds and silent blocks.",
      "It varies from person to person and from day to day. It is not caused by nervousness or lack of intelligence.",
      "Many people also feel tension, fear or the urge to avoid. Support exists for all of that, not only for speech.",
      "This app cannot assess your speech or tell you how it will change. A speech and language therapist can.",
    ],
    contraindications: "General information only.",
    tags: ["information"],
    review: awaiting,
  },
];

export function getModule(id: string) {
  return MODULES.find((m) => m.id === id);
}
export function searchModules(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return MODULES;
  return MODULES.filter((m) => [m.title, m.summary, ...m.tags].join(" ").toLowerCase().includes(q));
}
