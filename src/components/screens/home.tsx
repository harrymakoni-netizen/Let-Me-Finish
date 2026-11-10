"use client";

import { MessagesSquare, Route, Sprout, Sun } from "lucide-react";
import { useApp, useData, useTx } from "@/lib/hooks";
import { dayOf } from "@/lib/util";
import { getScenario } from "@/lib/content/scenarios";
import { ButtonLink } from "../ui/button";
import { Callout, LinkCard, PageHeader } from "../ui/layout";

export function HomeScreen() {
  const tx = useTx();
  const name = useData((d) => d.profile.preferredName);
  const daily = useData((d) => d.daily.find((s) => s.day === dayOf()));
  const active = useData((d) => d.activeConversation);
  const journeys = useData((d) => d.journeys);
  useApp();
  const open = journeys.filter((j) => j.stage !== "done");
  const done = daily ? Object.values(daily.steps).filter((v) => v !== "todo").length : 0;
  return (
    <div className="space-y-6">
      <PageHeader title={name ? `Hello, ${name}` : "Hello"} lead="Whatever today looks like, a few minutes is enough. You choose what to do." />
      {active ? (
        <Callout tone="info" title="You were part-way through a conversation">
          <p>{tx(active.custom?.title ?? getScenario(active.scenarioId)?.title ?? "Conversation")}</p>
          <ButtonLink href="/talk/session?resume=1" size="sm">Resume</ButtonLink>
        </Callout>
      ) : null}
      <LinkCard href="/today" icon={<Sun aria-hidden="true" className="size-5" />} title="Today’s practice"
        detail={daily?.completedAt ? "All done for today — nicely done." : daily ? `${done} of 5 steps done. Skip any you like.` : "Check in, one exercise, a conversation, plan something real, reflect."} />
      <LinkCard href="/talk" icon={<MessagesSquare aria-hidden="true" className="size-5" />} title="Start a conversation" detail="Rehearse with a partner who waits." />
      <LinkCard href="/practice" icon={<Sprout aria-hidden="true" className="size-5" />} title="Pick an exercise" detail="Short, optional, your choice." />
      <LinkCard href="/journeys" icon={<Route aria-hidden="true" className="size-5" />} title={open.length ? `Next challenge: ${open[0].title}` : "Plan a real-life challenge"} detail="Prepare, rehearse, do it, reflect." />
    </div>
  );
}
