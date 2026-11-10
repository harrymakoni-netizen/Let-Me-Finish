"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useApp, useData } from "@/lib/hooks";
import { RATING_ITEMS, RATING_ORDER } from "@/lib/content/options";
import { dayOf } from "@/lib/util";
import type { DailyStepId, SelfRatings } from "@/lib/types";
import { Button, ButtonLink } from "../ui/button";
import { RatingScale } from "../ui/form";
import { Card, PageHeader } from "../ui/layout";

const STEPS: { id: DailyStepId; title: string; mins: number; href?: string; std: boolean }[] = [
  { id: "checkin", title: "Check in", mins: 1, std: false },
  { id: "exercise", title: "One exercise", mins: 4, href: "/practice?daily=1", std: false },
  { id: "talk", title: "A conversation", mins: 7, href: "/talk?daily=1", std: false },
  { id: "plan", title: "Plan something real", mins: 3, href: "/journeys", std: true },
  { id: "reflect", title: "Reflect", mins: 2, std: true },
];

export function TodayScreen() {
  const store = useApp();
  const length = useData((d) => d.profile.sessionLength);
  const session = useData((d) => d.daily.find((s) => s.day === dayOf()));
  const [r, setR] = useState<SelfRatings>({});
  if (!session) {
    return (
      <div>
        <PageHeader title="Today’s practice" lead="Five small steps. Skip any. Stop any time." />
        <div className="flex gap-3">
          <Button size="lg" onClick={() => store.startDaily("standard")}>Standard, 15–20 min</Button>
          <Button size="lg" variant="secondary" onClick={() => store.startDaily("short")}>Short, 5–10 min</Button>
        </div>
        <p className="mt-3 text-ink-soft">You usually choose: {length === "short" ? "short" : "standard"}.</p>
      </div>
    );
  }
  const steps = STEPS.filter((s) => session.length === "standard" || !s.std);
  return (
    <div>
      <PageHeader title="Today’s practice" lead="Any step can be skipped. There’s no streak to keep." />
      <ol className="space-y-3">
        {steps.map((s) => {
          const st = session.steps[s.id];
          return (
            <li key={s.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl">{s.title} <span className="text-base font-normal text-ink-faint">· about {s.mins} min</span></h2>
                    {st !== "todo" ? <p className="flex items-center gap-1.5 text-teal"><Check aria-hidden="true" className="size-4" />{st === "done" ? "Done" : "Skipped"}</p> : null}
                  </div>
                  {st === "todo" ? (
                    <div className="flex gap-2">
                      {s.href ? <ButtonLink href={s.href} size="sm" onClick={() => {}}>Open</ButtonLink> : null}
                      {s.href ? <Button size="sm" variant="secondary" onClick={() => store.setDailyStep(s.id, "done")}>Mark done</Button> : null}
                      <Button size="sm" variant="quiet" onClick={() => store.setDailyStep(s.id, "skipped")}>Skip</Button>
                    </div>
                  ) : <Button size="sm" variant="quiet" onClick={() => store.setDailyStep(s.id, "todo")}>Undo</Button>}
                </div>
                {st === "todo" && (s.id === "checkin" || s.id === "reflect") ? (
                  <div className="mt-4 space-y-5">
                    {RATING_ORDER.map((k) => (
                      <RatingScale key={k} legend={RATING_ITEMS[k].question} low={RATING_ITEMS[k].low} high={RATING_ITEMS[k].high}
                        value={r[k]} onChange={(v) => setR((x) => { const n = { ...x }; if (v === undefined) delete n[k]; else n[k] = v; return n; })} />
                    ))}
                    <Button onClick={() => { if (Object.keys(r).length) store.addCheckIn(r); store.setDailyStep(s.id, "done"); setR({}); }}>Save</Button>
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
