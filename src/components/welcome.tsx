"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { useEffect } from "react";
import { useData, useHydrated } from "@/lib/hooks";
import { Wordmark } from "./brand";
import { SkipLink } from "./app-shell";
import { ButtonLink } from "./ui/button";

/** A still of the product's central promise: the partner waits, the person decides when they are done. */
function ConversationStill() {
  return (
    <figure className="relative">
      <div
        role="img"
        aria-label="Example: Sam asks what you would like. You begin to answer, pause, and Sam waits. You finish your sentence and press I'm finished."
        className="relative overflow-hidden rounded-[1.25rem] border border-panel-line bg-[#0c1b2e]/80 p-5 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)] backdrop-blur sm:p-7"
      >
        <div aria-hidden="true" className="space-y-4 text-[1.0625rem] leading-snug">
          <p className="max-w-[17rem] rounded-2xl rounded-tl-sm border border-panel-line px-4 py-3 text-on-panel">
            <span className="mb-0.5 block text-sm text-on-panel-soft">Sam</span>
            Hi there! What can I get for you?
          </p>
          <p className="ml-auto max-w-[17rem] rounded-2xl rounded-tr-sm bg-on-panel px-4 py-3 text-panel">
            <span className="mb-0.5 block text-sm opacity-70">You</span>
            I’d like a…
            <span className="mx-1 inline-block h-px w-10 translate-y-[-0.25em] bg-current opacity-40" />
            flat white, please.
          </p>
          <p className="flex items-center gap-2.5 pl-1 text-sm text-on-panel-soft">
            <span className="size-1.5 rounded-full bg-[#7ee0e6]" />
            Sam is waiting. Take as long as you need.
          </p>
          <div className="flex h-14 items-center justify-center rounded-control bg-[#7ee0e6] font-semibold text-[#06202a]">
            I’m finished
          </div>
        </div>
      </div>
    </figure>
  );
}

export function Welcome() {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useData((d) => Boolean(d.onboardedAt));
  useEffect(() => {
    if (hydrated && onboarded) router.replace("/home");
  }, [hydrated, onboarded, router]);

  return (
    <div className="min-h-dvh bg-paper">
      <SkipLink />
      <section className="glow relative isolate overflow-hidden bg-panel text-on-panel">
        <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
          <header className="flex items-center justify-between py-3">
            <Wordmark href="/" className="[&_span]:text-on-panel" />
            <Link
              href="/support"
              className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-[0.9375rem] font-semibold text-on-panel-soft hover:text-on-panel"
            >
              <LifeBuoy aria-hidden="true" className="size-4" />
              Support
            </Link>
          </header>
          <main id="main" tabIndex={-1} className="grid items-center gap-12 pb-16 pt-10 outline-none sm:pb-24 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <p className="mb-5 text-[0.9375rem] font-semibold text-[#7ee0e6]">A speech companion for adults who stammer</p>
              <h1 className="text-[3.25rem] leading-[0.98] text-on-panel sm:text-7xl">Let me finish.</h1>
              <p className="mt-6 max-w-md font-display text-2xl leading-snug text-on-panel-soft sm:text-[1.75rem]">
                Your voice. Your words. Your pace.
              </p>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-on-panel-soft">
                Rehearse the conversations that matter with a partner that waits — through every pause and every
                block — until <em className="not-italic text-on-panel">you</em> say you’re done.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                <ButtonLink href="/start" variant="light" size="lg">
                  Start as a guest
                </ButtonLink>
                <Link href="/privacy" className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-on-panel underline decoration-panel-line underline-offset-[6px] hover:decoration-on-panel">
                  How your data is handled
                </Link>
              </div>
              <p className="mt-4 text-sm text-on-panel-soft">No account. No voice sample. Under five minutes.</p>
            </div>
            <ConversationStill />
          </main>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="how">
        <h2 id="how" className="max-w-xl text-[2rem] leading-tight sm:text-5xl">
          Built around one idea: you set the pace.
        </h2>
        <div className="mt-12 grid gap-10 border-t border-line pt-10 md:grid-cols-3 md:gap-12">
          {[
            ["It waits.", "A pause, a repetition or a long block is never treated as the end of your turn. Only you end it, with one clear button. Nothing is hurried, finished for you or graded."],
            ["It’s yours.", "Recording is off. What you add stays on your device unless you choose otherwise, and you can export or delete all of it, any time. No adverts, no tracking, no scores."],
            ["It’s for real life.", "Prepare for the conversation, rehearse it, go and do it, then look back on what you wanted to say. Success here means taking part — not sounding a certain way."],
          ].map(([title, text]) => (
            <div key={title}>
              <h3 className="text-2xl">{title}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="scenes">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="scenes" className="max-w-xl text-[2rem] leading-tight sm:text-5xl">
              Rehearse the moments you usually avoid.
            </h2>
            <p className="max-w-sm text-ink-soft">
              Eleven everyday scenes to start with — or write your own for the conversation you actually have coming up.
            </p>
          </div>
          <ul className="mt-12 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Ordering a coffee", "Say the drink you really want, and your name for the cup.", "Face to face"],
              ["Booking by phone", "Ring a surgery, give your details, choose a time.", "Phone call"],
              ["A job interview", "The questions every interview opens with — and yours.", "Face to face"],
              ["Asking in class", "Put your hand up and ask what you wanted to ask.", "Face to face"],
              ["Answering the phone", "Pick up an unexpected call and say the first word.", "Phone call"],
              ["Telling your manager", "Say it plainly, and name what would help at work.", "Face to face"],
            ].map(([title, text, channel]) => (
              <li key={title} className="border-b border-r border-line p-6 sm:p-8">
                <p className="text-sm font-semibold text-teal">{channel}</p>
                <h3 className="mt-2 text-2xl">{title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-panel text-on-panel" aria-labelledby="loop">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 id="loop" className="max-w-2xl text-[2rem] leading-tight text-on-panel sm:text-5xl">
            From rehearsal to the real thing.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-on-panel-soft">
            Pick one conversation that matters to you, and take it one step at a time. Nothing is ever marked as passed
            or failed.
          </p>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-[1.25rem] bg-panel-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Prepare", "Decide what you want to get across, and what you might lean on."],
              ["Rehearse", "Practise it with a partner that waits, as many times as you like."],
              ["Do it", "Have the real conversation, in your own time. “Not yet” is fine."],
              ["Reflect", "Look back on whether you said what you wanted — not how it sounded."],
            ].map(([title, text], i) => (
              <li key={title} className="bg-panel p-7">
                <span aria-hidden="true" className="font-display text-sm text-[#7ee0e6]">
                  Step {i + 1}
                </span>
                <h3 className="mt-3 text-2xl text-on-panel">{title}</h3>
                <p className="mt-2 leading-relaxed text-on-panel-soft">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="faq">
        <div className="grid gap-10 md:grid-cols-[1fr_1.6fr]">
          <h2 id="faq" className="text-[2rem] leading-tight sm:text-5xl">Straight answers.</h2>
          <div className="border-t border-line">
            {[
              ["Will this cure my stammer?", "No, and we won’t pretend otherwise. Let Me Finish is a place to practise taking part in the conversations that matter to you. It never measures or scores how you speak."],
              ["Do I have to speak out loud?", "No. Every part of the app works by typing, and you can switch between speaking and typing in the middle of a turn."],
              ["Is my voice recorded?", "No. Audio is never saved. Your words are turned into text only while you practise, and transcripts are kept only if you choose to keep them."],
              ["Do I need an account?", "No. Start as a guest — everything stays on your device, and you can export or delete it whenever you like."],
              ["Does it replace speech therapy?", "No. It’s a practice companion. A qualified speech and language therapist can assess and support you in ways an app can’t, and the Support page lists organisations that can help."],
            ].map(([q, a]) => (
              <details key={q} className="group border-b border-line">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-xl [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden="true" className="text-2xl text-ink-faint transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-xl pb-5 leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="glow relative isolate overflow-hidden bg-panel text-on-panel">
        <div className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="max-w-xl text-[2rem] leading-tight text-on-panel sm:text-5xl">Take your time. We’ll wait.</h2>
          <ButtonLink href="/start" variant="light" size="xl">
            Start as a guest
          </ButtonLink>
        </div>
      </section>

      <section className="border-t border-line bg-sunk">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-[1fr_1.4fr]">
          <h2 className="text-[1.75rem] leading-tight sm:text-4xl">Honest about what it is.</h2>
          <p className="max-w-xl leading-relaxed text-ink-soft">
            Let Me Finish is a practice companion. It doesn’t diagnose, treat or promise fluency, and it isn’t a
            replacement for a speech and language therapist. It’s an early concept that hasn’t been clinically
            validated, and its lessons are still waiting for review by a qualified therapist. Every technique is
            optional, and what suits one person may not suit another.
          </p>
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-ink-faint sm:px-8">
        <span>Your voice. Your words. Your pace.</span>
        <nav aria-label="Footer" className="flex gap-5">
          <Link className="underline underline-offset-4" href="/privacy">Privacy</Link>
          <Link className="underline underline-offset-4" href="/support">Support</Link>
        </nav>
      </footer>
    </div>
  );
}
