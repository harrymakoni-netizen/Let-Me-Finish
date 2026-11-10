import type { CustomScenario } from "../types";

/**
 * Role-play scenarios.
 *
 * Each one works two ways:
 *  - with the AI partner, which is given `brief` and plays the character freely;
 *  - with the scripted partner (offline, or when AI is switched off), which
 *    walks through `beats` and never needs a network connection.
 *
 * Neither partner ever comments on how someone speaks.
 */

export type RoleId = "friend" | "lecturer" | "recruiter" | "cashier" | "colleague" | "phone_agent" | "stranger" | "guide";

export interface Scenario {
  id: string;
  title: string;
  role: RoleId;
  channel: "in_person" | "phone";
  /** One line for the picker. */
  summary: string;
  /** Where we are, told to the person before they start. */
  setting: string;
  /** e.g. "Sam, a barista". */
  partner: string;
  whoStarts: "partner" | "user";
  /** The partner's first line when they start (also beat 0 of the script). */
  opener?: string;
  /** A nudge for the person when they speak first. */
  userOpensWith?: string;
  /** Optional ideas. Never requirements. `{stammer}` placeholders allowed. */
  tryThis: string[];
  /** Character notes for the AI partner. */
  brief: string;
  /** Lines for the scripted partner, in order, after the opener. */
  beats: string[];
  closing: string;
  /** Situation ids this helps with (see SITUATION_OPTIONS). */
  situations: string[];
  /** Roughly how long the scripted version runs. */
  minutes: number;
}

export const ROLE_LABELS: Record<RoleId, string> = {
  friend: "Friend",
  lecturer: "Lecturer",
  recruiter: "Recruiter",
  cashier: "Cashier",
  colleague: "Colleague",
  phone_agent: "Telephone agent",
  stranger: "Someone new",
  guide: "Practice partner",
};

export const SCENARIOS: Scenario[] = [
  {
    id: "coffee-order",
    title: "Ordering a coffee",
    role: "cashier",
    channel: "in_person",
    summary: "Order what you actually want at a café counter, and give your name for the cup.",
    setting: "You’re at the counter of a café. There’s no queue behind you.",
    partner: "Sam, a barista",
    whoStarts: "partner",
    opener: "Hi there! What can I get for you?",
    tryThis: [
      "Order the drink you really want, not an easier word",
      "Give your own name when asked",
      "Let a pause just be a pause",
    ],
    brief:
      "You are Sam, a friendly barista at an independent café. Take the order: drink, size, have in or take away, a name for the cup, anything to eat, then payment. Make up ordinary prices. One question at a time.",
    beats: [
      "Sure. What size would you like — small, medium or large?",
      "And is that to have in, or to take away?",
      "Lovely. Can I take a name for the order?",
      "Thanks. Would you like anything to eat with that? We’ve got pastries and toasties.",
      "No problem. That comes to four twenty. Card or cash?",
      "That’s gone through. It’ll be ready at the end of the counter in a couple of minutes.",
    ],
    closing: "Here you go. Enjoy — have a good one!",
    situations: ["ordering", "introductions"],
    minutes: 3,
  },
  {
    id: "job-interview",
    title: "A job interview",
    role: "recruiter",
    channel: "in_person",
    summary: "Answer the questions most interviews open with, and ask some of your own.",
    setting: "You’re in a first interview for a role you want. The interviewer has your CV in front of them.",
    partner: "Morgan, a hiring manager",
    whoStarts: "partner",
    opener:
      "Hello, thanks for coming in. I’m Morgan — I lead the team you’d be joining. Before we start, what would you like me to call you?",
    tryThis: [
      "Decide beforehand whether you’d like to mention that you {stammer}",
      "Say the full answer you planned, even the hard words",
      "Ask one question of your own at the end",
    ],
    brief:
      "You are Morgan, a hiring manager running a first interview. You are professional and interested. Ask about their background, a piece of work they are proud of, a setback, what they want to learn, then invite their questions and answer them with plausible details about the team. Ask one question at a time and respond briefly to each answer before moving on.",
    beats: [
      "Good to meet you. To begin, could you tell me a little about yourself and what drew you to this role?",
      "Thank you. Can you tell me about a piece of work you’re proud of, and what your part in it was?",
      "And when something didn’t go to plan — a setback or a disagreement — how did you handle it?",
      "What would you most like to learn or get better at in your first six months here?",
      "That’s helpful. What questions do you have for me about the role or the team?",
      "Good question. The team is six people, we plan in two-week cycles, and you’d have a mentor for the first few months. Is there anything else you’d like to ask?",
    ],
    closing: "Thank you — I’ve enjoyed talking with you. We’ll be in touch within the week.",
    situations: ["interviews", "authority", "introductions"],
    minutes: 7,
  },
  {
    id: "phone-appointment",
    title: "Booking an appointment by phone",
    role: "phone_agent",
    channel: "phone",
    summary: "Ring a dental surgery, give your details and choose a time.",
    setting: "You’re calling your dental surgery to book a check-up. They pick up after a couple of rings.",
    partner: "Priya, a receptionist",
    whoStarts: "partner",
    opener: "Good morning, Riverside Dental, Priya speaking. How can I help?",
    tryThis: [
      "Say your full name rather than spelling it straight away",
      "Open with “I {stammer}, so I may need a moment” if you’d like to",
      "Stay on the line through a block — nobody will hang up",
    ],
    brief:
      "You are Priya, a receptionist at Riverside Dental, answering the phone. Find out what they need, take their full name and date of birth, ask whether it is routine or a problem, offer two appointment times, take a contact number, and confirm. One question at a time, as on a real call.",
    beats: [
      "Of course. Can I take your full name, please?",
      "Thank you. And your date of birth?",
      "Got it. Is this for a routine check-up, or is something bothering you?",
      "Okay. I have Tuesday at ten fifteen, or Thursday at three forty. Which would suit you better?",
      "That’s booked for you. Can I take a phone number in case we need to reach you?",
      "Thanks. Is there anything else I can help you with today?",
    ],
    closing: "You’re all set. We’ll see you then — goodbye!",
    situations: ["phone_calls", "appointments", "introductions"],
    minutes: 4,
  },
  {
    id: "friend-catchup",
    title: "Catching up with a friend",
    role: "friend",
    channel: "in_person",
    summary: "An easy, unhurried chat with someone who is glad to see you.",
    setting: "You’ve met a friend you haven’t seen for a while. Neither of you is in a hurry.",
    partner: "Alex, a friend",
    whoStarts: "partner",
    opener: "Hey! It’s been ages. How have you been?",
    tryThis: [
      "Tell one story with all the details you’d usually skip",
      "Ask a question back",
      "Try a technique here first, where nothing rides on it",
    ],
    brief:
      "You are Alex, a warm, easy-going friend catching up after a while apart. Be curious, react to what they say, share a little about yourself when it fits, and suggest meeting up. Keep it light and natural.",
    beats: [
      "Oh nice. What’s been keeping you busy lately?",
      "Ha, I know that feeling. Have you watched or read anything good recently? I need recommendations.",
      "I’ll look that up. Any plans coming up — this weekend, or a trip?",
      "That sounds great. We should do something soon. What do you fancy — food, or a walk?",
      "Deal. When are you free?",
    ],
    closing: "Perfect. It’s really good to catch up — see you then!",
    situations: ["friends_family", "small_talk"],
    minutes: 4,
  },
  {
    id: "seminar-question",
    title: "Asking a question in class",
    role: "lecturer",
    channel: "in_person",
    summary: "Put your hand up at the end of a lecture and ask what you wanted to ask.",
    setting: "A lecture has just finished and the lecturer has asked for questions. You have one.",
    partner: "Dr Okafor, a lecturer",
    whoStarts: "partner",
    opener: "That’s where we’ll stop for today. Does anyone have a question?",
    tryThis: [
      "Ask the question in your own words, at your own length",
      "Add a follow-up when you get an answer",
      "Notice that the room waits — that is what rooms do",
    ],
    brief:
      "You are Dr Okafor, a university lecturer taking questions at the end of a session. You like questions. Answer genuinely and briefly on whatever subject they raise, check you have understood, and invite a follow-up. If their subject is unclear, ask which topic they mean.",
    beats: [
      "That’s a good question. Before I answer — what’s your own thinking on it so far?",
      "Interesting. I’d say it depends on the context and on the evidence you have. Which part would you like me to go into?",
      "Sure. In short: start from the simplest explanation, then test it against a counter-example. Does that get at what you were asking?",
      "Good. While we’re here, is there anything about the assignment or the reading you’d like to check?",
    ],
    closing: "You’re welcome. Thanks for asking — see you next week.",
    situations: ["classes", "authority"],
    minutes: 4,
  },
  {
    id: "team-meeting",
    title: "Giving an update in a meeting",
    role: "colleague",
    channel: "in_person",
    summary: "Take your turn in a team meeting and say what you’ve been working on.",
    setting: "It’s the weekly team meeting. Five colleagues are in the room and it’s your turn to speak.",
    partner: "Jordan, a colleague running the meeting",
    whoStarts: "partner",
    opener: "Morning, everyone. Let’s go round — would you like to start? What have you been working on?",
    tryThis: [
      "Give the update you’d give if speaking were easy",
      "Raise one thing you’d normally keep to yourself",
      "Say yes or no to the request because you mean it, not to get the turn over with",
    ],
    brief:
      "You are Jordan, a colleague chairing a relaxed weekly team meeting. Ask for their update, whether anything is blocking them, and their plan for the week; then ask whether they would present part of a client update on Friday, and accept either answer gracefully. Keep it collegial.",
    beats: [
      "Thanks. Is anything blocking you or slowing things down?",
      "Got it. What’s your plan for the rest of the week?",
      "Sounds good. One more thing — we need someone to walk the client through the update on Friday. Would you be up for presenting part of it?",
      "Okay, thanks. Is there anything you’d like from the rest of us before we wrap up?",
    ],
    closing: "Thanks — that’s really clear. Let’s catch up again tomorrow.",
    situations: ["meetings", "authority"],
    minutes: 4,
  },
  {
    id: "introductions",
    title: "Meeting someone new",
    role: "stranger",
    channel: "in_person",
    summary: "Say your name and a little about yourself to someone you’ve just met.",
    setting: "You’re at a gathering where you only know a couple of people. Someone friendly comes over.",
    partner: "Taylor, someone you’ve just met",
    whoStarts: "partner",
    opener: "Hi, I don’t think we’ve met — I’m Taylor. What’s your name?",
    tryThis: [
      "Say your name without a run-up or a filler word",
      "If you {stammer} on it, finish the name anyway",
      "Ask Taylor something about themselves",
    ],
    brief:
      "You are Taylor, a friendly person at a social gathering who has just introduced yourself. Ask their name, how they know people here, what they do, and what they enjoy about it; share a little about yourself. Wait for their name however long it takes and then use it once, naturally.",
    beats: [
      "Nice to meet you. How do you know the people here?",
      "Oh right. And what do you do — are you working, studying?",
      "That sounds interesting. What do you enjoy most about it?",
      "Nice. Whereabouts are you based?",
    ],
    closing: "Well, it was really nice to meet you. I’m going to grab a drink — see you around!",
    situations: ["introductions", "small_talk"],
    minutes: 3,
  },
  {
    id: "customer-service-call",
    title: "Calling customer service",
    role: "phone_agent",
    channel: "phone",
    summary: "Explain a problem with your broadband and arrange for it to be fixed.",
    setting: "Your internet has been dropping out. You’ve rung your provider and just come off hold.",
    partner: "Dev, a customer service adviser",
    whoStarts: "partner",
    opener: "Thank you for calling Northline Broadband, you’re through to Dev. Can I start with your name, please?",
    tryThis: [
      "Explain the problem fully instead of the shortest version",
      "Ask Dev to repeat something, just to practise asking",
      "Give your address without rushing the hard part",
    ],
    brief:
      "You are Dev, a helpful customer service adviser at Northline Broadband. Take their name, find out the problem, ask when it started, confirm the first line of their address and postcode, offer two engineer slots, offer a text reminder, and close the call. Calm and practical. One question at a time.",
    beats: [
      "Thanks. And how can I help today?",
      "I’m sorry about that. Can you tell me when the problem started?",
      "Okay. Can I confirm the first line of your address and your postcode?",
      "Thank you. I can see a fault on our side. I can book an engineer for Wednesday morning or Friday afternoon — which would you prefer?",
      "That’s booked. Would you like a text reminder the day before?",
    ],
    closing: "All sorted. Thanks for calling Northline — goodbye!",
    situations: ["phone_calls", "appointments"],
    minutes: 4,
  },
  {
    id: "incoming-call",
    title: "Answering the phone",
    role: "phone_agent",
    channel: "phone",
    summary: "Pick up an unexpected call and say the first word yourself.",
    setting: "Your phone rings with a number you don’t recognise. You decide to answer it.",
    partner: "Jamie, a delivery driver",
    whoStarts: "user",
    userOpensWith: "You speak first — answer however you normally would.",
    tryThis: [
      "Answer with the greeting you’d choose, not the easiest one",
      "Give your name when Jamie asks",
      "If the first word blocks, stay with it — Jamie will still be there",
    ],
    brief:
      "You are Jamie, a delivery driver for Swift Parcels phoning to arrange a drop-off. They have just answered the phone. Say who you are, confirm their name, say you are about ten minutes away, ask whether someone will be in or where to leave the parcel, and check for anything you should know about finding the address. Cheerful and brief.",
    beats: [
      "Oh hi, it’s Jamie from Swift Parcels — I’ve got a delivery for you. Could you confirm your name for me?",
      "Great, thanks. I’m about ten minutes away. Will someone be in?",
      "No problem. If not, is there a safe place I can leave it, or a neighbour?",
      "Okay, got that. Is there anything I should know about finding the address?",
    ],
    closing: "Perfect, thanks. See you shortly — bye!",
    situations: ["phone_calls", "introductions"],
    minutes: 3,
  },
  {
    id: "presentation-qa",
    title: "A short presentation and questions",
    role: "lecturer",
    channel: "in_person",
    summary: "Give a few minutes of a talk you’re preparing, then take questions.",
    setting: "You’re presenting to a small group. They’re ready when you are.",
    partner: "A small, attentive audience",
    whoStarts: "user",
    userOpensWith: "You start. Give your opening or a few minutes of your talk — as long as you like.",
    tryThis: [
      "Deliver your real opening line",
      "Pause on purpose after your main point",
      "Answer a question with “let me think about that” and take the time",
    ],
    brief:
      "You are a member of a small, attentive audience (a tutor or colleague) who has just listened to part of their presentation. Thank them, then ask genuine, specific questions about what they actually said, one at a time: their main point, something surprising, a possible objection, and what they want the audience to take away. Engage with their content.",
    beats: [
      "Thank you — that was clear. Could you say a little more about your main point?",
      "What was the most surprising thing you came across while preparing this?",
      "If someone disagreed with you, what do you think they would say?",
      "And what’s the one thing you’d like us to take away?",
    ],
    closing: "Thanks very much — that gives us plenty to think about.",
    situations: ["presentations", "classes", "meetings"],
    minutes: 6,
  },
  {
    id: "disclosure-manager",
    title: "Telling your manager you {stammer}",
    role: "colleague",
    channel: "in_person",
    summary: "Have the conversation about your speech and what would help at work.",
    setting: "You asked your manager for ten minutes. You’re in a quiet room and they have time.",
    partner: "Robin, your manager",
    whoStarts: "partner",
    opener: "Hi, come in. You said you wanted to talk about something — what’s on your mind?",
    tryThis: [
      "Say it plainly, without apologising: “I {stammer}”",
      "Name one thing that would actually help you",
      "Decide what you’d like the team to know",
    ],
    brief:
      "You are Robin, a decent, practical line manager. The person has asked for a private chat and is going to tell you that they stammer. Listen, thank them plainly without fuss or pity, ask what would be useful for you to know and what would help in meetings, calls or presentations, ask whether they want the team told, and agree to what they ask. Follow their lead; do not offer advice about speech.",
    beats: [
      "Thank you for telling me — I appreciate it. What would be useful for me to know?",
      "That makes sense. Are there situations here where something different would help — meetings, calls, presentations?",
      "We can do that. Would you like me to mention anything to the team, or keep this between us?",
      "Okay. Is there anything else that would make things easier?",
    ],
    closing: "Thanks for trusting me with this. My door’s open if anything changes.",
    situations: ["authority", "meetings"],
    minutes: 4,
  },
];

/** A gentle first conversation used during setup. Short, low stakes, no name needed. */
export const FIRST_HELLO: Scenario = {
  id: "first-hello",
  title: "A first hello",
  role: "guide",
  channel: "in_person",
  summary: "Ninety seconds to see how a conversation works here.",
  setting: "This is just to show you how conversations work here. Nothing is measured or kept.",
  partner: "Your practice partner",
  whoStarts: "partner",
  opener:
    "Hello, and welcome. I only reply when you press “I’m finished”, so there’s no rush at all. Here’s an easy one to start: what’s something you enjoy doing?",
  tryThis: [],
  brief:
    "You are a friendly practice partner welcoming someone to the app for the first time. This is a ninety-second demonstration. Ask what they enjoy doing, respond with real interest to what they say, ask one follow-up, then close by saying that every conversation here works the same way: their words, their pace. Do not ask for their name.",
  beats: ["That sounds good. What do you like most about it?"],
  closing: "Thanks for telling me. That’s how every conversation here works — your words, at your pace.",
  situations: [],
  minutes: 2,
};

export const ALL_SCENARIOS: Scenario[] = [...SCENARIOS, FIRST_HELLO];

export const CUSTOM_SCENARIO_ID = "custom";

export function getScenario(id: string): Scenario | undefined {
  return ALL_SCENARIOS.find((s) => s.id === id);
}

/** Turn a scene the person described into something both partners can play. */
export function scenarioFromCustom(custom: CustomScenario): Scenario {
  const partner = custom.partner.trim() || "the other person";
  return {
    id: CUSTOM_SCENARIO_ID,
    title: custom.title.trim() || "My own scene",
    role: "stranger",
    channel: custom.channel,
    summary: custom.aim,
    setting: custom.setting.trim() || "A situation you chose.",
    partner,
    whoStarts: custom.whoStarts,
    opener: custom.whoStarts === "partner" ? "Hello. What can I do for you?" : undefined,
    userOpensWith: custom.whoStarts === "user" ? "You speak first, whenever you’re ready." : undefined,
    tryThis: [],
    brief: "",
    beats: [
      "Okay. Tell me a bit more about that.",
      "I see. What would you like to happen next?",
      "That sounds fine to me. Is there anything else you wanted to say?",
    ],
    closing: "Alright — thank you. That’s everything from me.",
    situations: [],
    minutes: 4,
  };
}

/** Scenarios that fit the situations someone said matter to them, most relevant first. */
export function scenariosFor(situationIds: string[]): Scenario[] {
  if (situationIds.length === 0) return SCENARIOS;
  const score = (s: Scenario) => s.situations.filter((id) => situationIds.includes(id)).length;
  return [...SCENARIOS].sort((a, b) => score(b) - score(a));
}
