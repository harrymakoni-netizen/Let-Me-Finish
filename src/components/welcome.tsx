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
