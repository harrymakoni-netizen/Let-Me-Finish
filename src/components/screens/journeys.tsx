"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RATING_ITEMS, RATING_ORDER, SUPPORT_OPTIONS } from "@/lib/content/options";
import { SCENARIOS, getScenario } from "@/lib/content/scenarios";
import { suggestNextSteps } from "@/lib/journey";
import { useApp, useData, useTx } from "@/lib/hooks";
import type { Journey, SelfRatings } from "@/lib/types";
import { formatDay } from "@/lib/util";
import { Button, ButtonLink } from "../ui/button";
import { ChoiceCards, ChoiceChips, RatingScale, Select, TextArea, TextInput } from "../ui/form";
import { Card, EmptyState, LinkCard, PageHeader, StepProgress, Tag } from "../ui/layout";

const STAGES = ["prepare", "rehearse", "attempt", "reflect", "done"] as const;
const LABEL = { prepare: "Prepare", rehearse: "Rehearse", attempt: "Do it", reflect: "Reflect", done: "Done" };

export function JourneyList() {
  const router = useRouter();
  const store = useApp();
  const journeys = useData((d) => d.journeys);
  const [title, setTitle] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [date, setDate] = useState("");
  return (
    <div className="space-y-6">
      <PageHeader title="Speaking journeys" lead="Choose a real conversation that matters to you. Prepare, rehearse, do it in your own time, then reflect. Success is taking part, not sounding a certain way." />
      <Card>
        <h2 className="text-xl">Start a new journey</h2>
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return;
          const id = store.createJourney({ title, scenarioId: scenarioId || undefined, targetDate: date || undefined }); router.push(`/journeys/view?id=${id}`); }}>
          <TextInput label="What’s the challenge?" hint="For example: ask a question in Thursday’s seminar" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          <Select label="A scene to rehearse it with" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
            <option value="">I’ll describe it myself</option>
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title.replace("{stammer}", "stammer")}</option>)}
          </Select>
          <TextInput label="Target date" optional type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button type="submit" size="lg" disabled={!title.trim()}>Start</Button>
        </form>
      </Card>
      {journeys.length === 0 ? <EmptyState title="No journeys yet">Pick something small and real to begin.</EmptyState> : (
        <ul className="grid gap-3">
          {[...journeys].reverse().map((j) => (
            <li key={j.id}><LinkCard href={`/journeys/view?id=${j.id}`} title={j.title} detail={LABEL[j.stage]} meta={j.targetDate ? `Target ${formatDay(j.targetDate)}` : undefined} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function JourneyView() {
  const id = useSearchParams().get("id") ?? "";
  const j = useData((d) => d.journeys.find((x) => x.id === id));
  if (!j) return <p>That journey isn’t here. <ButtonLink href="/journeys" variant="quiet">Back</ButtonLink></p>;
  return <JourneyFlow key={j.id} j={j} />;
}

function JourneyFlow({ j }: { j: Journey }) {
  const store = useApp();
  const router = useRouter();
  const tx = useTx();
  const [plan, setPlan] = useState(j.plan);
  const [ratings, setRatings] = useState<SelfRatings>({});
  const [happened, setHappened] = useState("");
  const [helped, setHelped] = useState<string[]>([]);
  const rehearsals = j.rehearsalIds.length;
  const idx = STAGES.indexOf(j.stage);
  const scenario = j.scenarioId ? getScenario(j.scenarioId) : undefined;
  return (
    <div className="space-y-6">
      <PageHeader title={j.title} back={{ href: "/journeys", label: "Journeys" }} actions={<Tag tone="teal">{LABEL[j.stage]}</Tag>}
        lead={scenario ? `Rehearsal scene: ${tx(scenario.title)}` : undefined} />
      <StepProgress current={Math.min(idx + 1, 4)} total={4} label={LABEL[j.stage]} />

      {j.stage === "prepare" ? (
        <Card className="space-y-4">
          <h2 className="text-xl">Prepare</h2>
          <TextArea label="What do you want to say or get across?" value={plan.message} onChange={(e) => setPlan({ ...plan, message: e.target.value })} />
          <TextArea label="Why does it matter to you?" optional value={plan.why} onChange={(e) => setPlan({ ...plan, why: e.target.value })} />
          <TextArea label="What do you expect will happen?" optional value={plan.prediction} onChange={(e) => setPlan({ ...plan, prediction: e.target.value })} />
          <ChoiceChips legend="Anything you’d like to lean on?" hint="All optional." options={SUPPORT_OPTIONS.map((o) => ({ ...o, label: tx(o.label) }))}
            value={plan.supports} onChange={(supports) => setPlan({ ...plan, supports })} columns />
          <Button size="lg" onClick={() => { store.updateJourney(j.id, { plan }); store.setJourneyStage(j.id, "rehearse"); }}>Save and continue</Button>
        </Card>
      ) : null}

      {j.stage === "rehearse" ? (
        <Card className="space-y-4">
          <h2 className="text-xl">Rehearse</h2>
          <p>{rehearsals ? `${rehearsals} rehearsal${rehearsals > 1 ? "s" : ""} so far.` : "Rehearse as many times as feels useful — or skip straight to doing it."}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/talk/session?journey=${j.id}`} size="lg">Rehearse now</ButtonLink>
            <Button size="lg" variant="secondary" onClick={() => store.setJourneyStage(j.id, "attempt")}>I’m ready to do it</Button>
          </div>
        </Card>
      ) : null}

      {j.stage === "attempt" ? (
        <Card className="space-y-4">
          <h2 className="text-xl">Do it</h2>
          <p>{j.plan.message ? <>Your aim: “{j.plan.message}”. </> : null}Do this in your own time. Come back when you’re ready — or not yet, which is fine.</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => store.recordAttempt(j.id, "did")}>I did it</Button>
            <Button size="lg" variant="secondary" onClick={() => store.recordAttempt(j.id, "partly")}>I did part of it</Button>
            <Button size="lg" variant="quiet" onClick={() => store.recordAttempt(j.id, "not_yet")}>Not yet</Button>
          </div>
        </Card>
      ) : null}

      {j.stage === "reflect" ? (
        <Card className="space-y-5">
          <h2 className="text-xl">Reflect</h2>
          <TextArea label="What happened, compared with what you expected?" optional value={happened} onChange={(e) => setHappened(e.target.value)} />
          {RATING_ORDER.map((k) => (
            <RatingScale key={k} legend={RATING_ITEMS[k].momentQuestion} low={RATING_ITEMS[k].low} high={RATING_ITEMS[k].high} value={ratings[k]}
              onChange={(v) => setRatings((r) => { const n = { ...r }; if (v === undefined) delete n[k]; else n[k] = v; return n; })} />
          ))}
          <ChoiceChips legend="What helped?" options={SUPPORT_OPTIONS.map((o) => ({ ...o, label: tx(o.label) }))} value={helped} onChange={setHelped} columns />
          <Button size="lg" onClick={() => store.saveReflection(j.id, { ratings, whatHappened: happened, helped })}>Save reflection</Button>
        </Card>
      ) : null}

      {j.stage === "done" ? (
        <Card className="space-y-4">
          <h2 className="text-xl">What next?</h2>
          <p className="text-ink-soft">These come from what you chose and told us — never from how you sounded.</p>
          <ChoiceCards legend="Pick a next step" value={j.nextStep?.kind} onChange={(kind) => {
            const s = suggestNextSteps(j).find((x) => x.kind === kind)!; store.chooseNextStep(j.id, { kind, label: s.label, href: s.href });
          }} options={suggestNextSteps(j).map((s) => ({ id: s.kind, label: s.label, detail: s.detail }))} />
          {j.nextStep?.href ? <ButtonLink href={j.nextStep.href} size="lg">Go</ButtonLink> : null}
          <Button variant="quiet" onClick={() => { store.deleteJourney(j.id); router.push("/journeys"); }}>Delete this journey</Button>
        </Card>
      ) : null}
    </div>
  );
}
