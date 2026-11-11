"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONSENTS } from "@/lib/consent";
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS, REGION_OPTIONS, SITUATION_OPTIONS } from "@/lib/content/options";
import { guessLocaleDefaults } from "@/lib/data";
import { useApp, useData, useHydrated, useTx } from "@/lib/hooks";
import { Button } from "./ui/button";
import { ChoiceCards, ChoiceChips, Segmented, Select } from "./ui/form";
import { StepProgress } from "./ui/layout";

const STEPS = ["You and this app", "Your goals", "Your speech", "Ready"] as const;

export function Onboarding() {
  const router = useRouter();
  const hydrated = useHydrated();
  const store = useApp();
  const profile = useData((d) => d.profile);
  const tx = useTx();
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);

  if (!hydrated) return <p className="text-ink-soft">Loading…</p>;
  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () => {
    store.completeOnboarding();
    router.push("/home");
  };

  return (
    <div className="space-y-6">
      <StepProgress current={step + 1} total={STEPS.length} label={STEPS[step]} />
      {step === 0 ? (
        <section className="space-y-5" aria-labelledby="s0">
          <h1 id="s0" className="text-[2.5rem] leading-[1.02] sm:text-5xl">Before we begin.</h1>
          <p className="max-w-lg text-lg leading-relaxed text-ink-soft">
            Two quick things. There’s no voice sample, and nothing here is timed.
          </p>
          <div className="space-y-3">
            <CheckRow checked={adult} onChange={setAdult}>
              I’m 18 or over.
            </CheckRow>
            <CheckRow checked={agree} onChange={setAgree}>
              I understand Let Me Finish is a practice companion — not a medical service, a diagnosis or a treatment.
            </CheckRow>
          </div>
          <details className="group">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-teal underline underline-offset-4">
              What happens to my information
            </summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.9375rem] text-ink-soft">
              {CONSENTS.core.details.map((d) => (
                <li key={d}>{tx(d)}</li>
              ))}
              <li>The microphone and the AI partner are each asked about separately, only if you choose to use them.</li>
            </ul>
          </details>
          <Button
            size="lg"
            disabled={!adult || !agree}
            onClick={() => {
              store.confirmAge();
              store.setConsent("core", true);
              const g = guessLocaleDefaults(navigator.language);
              store.updateProfile({ term: g.term, region: g.region });
              next();
            }}
          >
            Continue
          </Button>
        </section>
      ) : null}
      {step === 1 ? (
        <section className="space-y-6">
          <ChoiceChips legend="What would you like from this?" hint="Pick any, or none. You can change this later."
            options={GOAL_OPTIONS.map((o) => ({ ...o, label: tx(o.label) }))} value={profile.goalIds}
            onChange={(goalIds) => store.updateProfile({ goalIds })} columns />
          <ChoiceChips legend="Which situations matter most?" options={SITUATION_OPTIONS} value={profile.situationIds}
            onChange={(situationIds) => store.updateProfile({ situationIds })} />
          <Nav onBack={back} onNext={next} skip />
        </section>
      ) : null}
      {step === 2 ? (
        <section className="space-y-6">
          <Segmented legend="Which word do you use?" options={[{ id: "stammer", label: "Stammer" }, { id: "stutter", label: "Stutter" }]}
            value={profile.term} onChange={(term) => store.updateProfile({ term })} />
          <ChoiceChips legend={tx("What is it like for you?")} hint="Optional. Nothing here is a diagnosis."
            options={EXPERIENCE_OPTIONS} value={profile.experienceIds} onChange={(experienceIds) => store.updateProfile({ experienceIds })} columns />
          <ChoiceCards legend="Speak or type?" layout="row" options={[{ id: "text", label: "Type" }, { id: "voice", label: "Speak" }]}
            value={profile.mode} onChange={(mode) => store.updateProfile({ mode })} />
          <ChoiceCards legend="Session length" layout="row" options={[{ id: "standard", label: "15–20 min" }, { id: "short", label: "Short, 5–10 min" }]}
            value={profile.sessionLength} onChange={(sessionLength) => store.updateProfile({ sessionLength })} />
          <Select label="Where are you? (for support numbers)" value={profile.region}
            onChange={(e) => store.updateProfile({ region: e.target.value as typeof profile.region })}>
            {REGION_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </Select>
          <Nav onBack={back} onNext={next} skip />
        </section>
      ) : null}
      {step === 3 ? (
        <section className="space-y-5">
          <h1 className="text-3xl">You’re set</h1>
          <p className="text-lg text-ink-soft">Try a ninety-second first hello — nothing is measured or kept — or go straight to Home.</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => { store.completeOnboarding(); router.push("/talk/session?scenario=first-hello"); }}>Try a first hello</Button>
            <Button size="lg" variant="secondary" onClick={finish}>Go to Home</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Nav({ onBack, onNext, skip }: { onBack: () => void; onNext: () => void; skip?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" size="lg" onClick={onBack}>Back</Button>
      <Button size="lg" onClick={onNext}>{skip ? "Continue" : "Next"}</Button>
    </div>
  );
}

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label
      className={`flex min-h-16 cursor-pointer items-start gap-4 rounded-card border px-5 py-4 text-[1.0625rem] leading-snug transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-focus ${
        checked ? "border-ink bg-surface" : "border-line-strong hover:border-ink"
      }`}
    >
      <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
