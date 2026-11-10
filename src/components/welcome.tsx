"use client";

import { useRouter } from "next/navigation";
import { Accessibility, Lock, Mic } from "lucide-react";
import { useEffect } from "react";
import { useData, useHydrated } from "@/lib/hooks";
import { ButtonLink } from "./ui/button";
import { Card } from "./ui/layout";

export function Welcome() {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useData((d) => Boolean(d.onboardedAt));
  useEffect(() => {
    if (hydrated && onboarded) router.replace("/home");
  }, [hydrated, onboarded, router]);

  return (
    <div>
      <h1 className="text-4xl sm:text-5xl">Let Me Finish.</h1>
      <p className="mt-3 font-display text-2xl text-ink-soft">Your voice. Your words. Your pace.</p>
      <p className="mt-6 max-w-prose text-lg">
        A speech companion for adults who stammer. Practise real conversations with a partner that waits until you say
        you’ve finished — however long that takes.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/start" size="xl">Start as a guest</ButtonLink>
      </div>
      <p className="mt-2 text-[0.9375rem] text-ink-soft">No account needed. Takes under five minutes. No voice sample.</p>
      <ul className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          [Mic, "It waits", "Silence never ends your turn. Only you do."],
          [Lock, "It’s private", "Recording is off. Your data stays on your device unless you choose otherwise."],
          [Accessibility, "It’s accessible", "Type instead of speaking. Large text, high contrast, reduced motion."],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Mic;
          return (
            <li key={title as string}>
              <Card className="h-full">
                <I aria-hidden="true" className="size-6 text-teal" />
                <h2 className="mt-2 text-lg">{title as string}</h2>
                <p className="mt-1 text-[0.9375rem] text-ink-soft">{text as string}</p>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 max-w-prose text-[0.9375rem] text-ink-soft">
        Let Me Finish doesn’t diagnose, treat or promise fluency, and it isn’t a replacement for a speech and language
        therapist. It’s a working concept that hasn’t been clinically validated.{" "}
        <a className="underline" href="/privacy">Privacy</a>
      </p>
    </div>
  );
}
