"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getScenario } from "@/lib/content/scenarios";
import { useData, useTx } from "@/lib/hooks";
import { dayOf } from "@/lib/util";
import { ButtonLink } from "../ui/button";

function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Row({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-6 border-t border-line py-5 first:border-t-0">
      <span>
        <span className="block font-display text-2xl font-medium tracking-[-0.015em]">{title}</span>
        <span className="mt-1 block text-ink-soft">{detail}</span>
      </span>
      <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink" />
    </Link>
  );
}

export function HomeScreen() {
  const tx = useTx();
  const name = useData((d) => d.profile.preferredName);
  const daily = useData((d) => d.daily.find((s) => s.day === dayOf()));
  const active = useData((d) => d.activeConversation);
  const journeys = useData((d) => d.journeys);
  const open = journeys.filter((j) => j.stage !== "done");
  const steps = daily ? Object.values(daily.steps) : [];
  const done = steps.filter((v) => v !== "todo").length;
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-semibold text-ink-faint">{date}</p>
        <h1 className="mt-2 text-[2.5rem] leading-none sm:text-6xl">
          {greeting(now.getHours())}
          {name ? `, ${name}` : ""}.
        </h1>
      </header>

      {active ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-teal/40 bg-teal-wash px-5 py-4">
          <p>
            <span className="font-semibold">You were part-way through a conversation.</span>{" "}
            <span className="text-ink-soft">{tx(active.custom?.title ?? getScenario(active.scenarioId)?.title ?? "")}</span>
          </p>
          <ButtonLink href="/talk/session?resume=1" size="sm">Pick it up</ButtonLink>
        </div>
      ) : null}

      <section aria-labelledby="today" className="glow relative isolate overflow-hidden rounded-[1.25rem] bg-panel p-7 text-on-panel sm:p-10">
        <div className="relative z-10 max-w-lg">
          <p className="text-[0.9375rem] font-semibold text-[#7ee0e6]">Today</p>
          <h2 id="today" className="mt-2 text-[2rem] leading-tight text-on-panel sm:text-[2.5rem]">
            {daily?.completedAt ? "That’s today done." : daily ? "Pick up where you left off." : "A few minutes is enough."}
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-on-panel-soft">
            {daily
              ? `${done} of ${steps.length} steps. Any of them can be skipped.`
              : "Check in, try one exercise, have a conversation, plan something real. Skip anything, stop any time."}
          </p>
          {daily ? (
            <div className="mt-5 flex gap-1.5" role="img" aria-label={`${done} of ${steps.length} steps done`}>
              {steps.map((v, i) => (
                <span key={i} className={`h-1 w-9 rounded-full ${v === "todo" ? "bg-panel-line" : "bg-[#7ee0e6]"}`} />
              ))}
            </div>
          ) : null}
          <div className="mt-7">
            <ButtonLink href="/today" variant="light" size="lg">
              {daily ? "Continue" : "Begin"}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section aria-label="More ways in">
        <Row href="/talk" title="Start a conversation" detail="Rehearse something real with a partner who waits." />
        <Row href="/practice" title="Try an exercise" detail="Short, optional, and your choice." />
        <Row
          href={open[0] ? `/journeys/view?id=${open[0].id}` : "/journeys"}
          title={open[0] ? open[0].title : "Plan a real-life challenge"}
          detail={open[0] ? "Your next challenge." : "Prepare, rehearse, do it, reflect."}
        />
      </section>
    </div>
  );
}
