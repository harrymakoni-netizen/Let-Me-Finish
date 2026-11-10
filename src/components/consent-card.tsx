"use client";

import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { CONSENTS } from "@/lib/consent";
import { useApp, useConsent, useTx } from "@/lib/hooks";
import type { ConsentPurpose } from "@/lib/types";
import { Button } from "./ui/button";

/** The plain-language wording for one consent: summary first, specifics on request. */
export function ConsentText({ purpose }: { purpose: ConsentPurpose }) {
  const tx = useTx();
  const def = CONSENTS[purpose];
  return (
    <>
      <p>{tx(def.summary)}</p>
      <details className="mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-teal underline underline-offset-4">
          What this means
        </summary>
        <ul className="mt-1 list-disc space-y-1.5 pl-5 text-[0.9375rem] text-ink-soft">
          {def.details.map((d) => (
            <li key={d}>{tx(d)}</li>
          ))}
          <li>If you switch it off later: {tx(def.whenOff)}</li>
        </ul>
      </details>
    </>
  );
}

/**
 * Asks for one consent at the moment it is needed, with a real alternative.
 * Renders nothing once the consent is in place.
 */
export function ConsentCard({
  purpose,
  allowLabel,
  alternative,
}: {
  purpose: ConsentPurpose;
  allowLabel: string;
  alternative?: ReactNode;
}) {
  const granted = useConsent(purpose);
  const setConsent = useApp((s) => s.setConsent);
  if (granted) return null;
  const def = CONSENTS[purpose];
  return (
    <section
      aria-label={def.title}
      className="rounded-card border border-line-strong bg-surface p-4 sm:p-5"
    >
      <h3 className="flex items-center gap-2 text-lg">
        <ShieldCheck aria-hidden="true" className="size-5 text-teal" />
        {def.title}
      </h3>
      <div className="mt-2">
        <ConsentText purpose={purpose} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => setConsent(purpose, true)}>{allowLabel}</Button>
        {alternative}
      </div>
    </section>
  );
}
