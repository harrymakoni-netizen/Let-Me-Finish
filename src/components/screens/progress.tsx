"use client";

import { RATING_ITEMS, RATING_ORDER } from "@/lib/content/options";
import { ratedMoments, seriesFor, situationsAttempted } from "@/lib/data";
import { useData } from "@/lib/hooks";
import { formatDay } from "@/lib/util";
import { Card, EmptyState, PageHeader } from "../ui/layout";

/** Simple SVG trend. A table below carries the same numbers for screen readers. */
function Trend({ points }: { points: { at: string; value: number }[] }) {
  const w = 300, h = 70, pad = 6;
  const x = (i: number) => (points.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (points.length - 1));
  const y = (v: number) => h - pad - ((v - 1) * (h - 2 * pad)) / 4;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Trend over ${points.length} entries, from ${points[0].value} to ${points.at(-1)!.value} out of 5`} className="h-20 w-full max-w-sm">
      <line x1={pad} x2={w - pad} y1={y(3)} y2={y(3)} stroke="var(--line)" strokeDasharray="3 4" />
      <path d={d} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="3.5" fill="var(--teal)" />)}
    </svg>
  );
}

export function ProgressScreen() {
  const data = useData((d) => d);
  const moments = ratedMoments(data);
  const attempted = situationsAttempted(data);
  return (
    <div className="space-y-6">
      <PageHeader title="Progress" lead="What you tell us, over time. No scores, no streaks, no comparison with anyone. Numbers can go up and down — that’s normal." />
      <Card className="grid gap-4 sm:grid-cols-3">
        <div><p className="font-display text-3xl font-semibold">{attempted}</p><p className="text-ink-soft">real situations you went into</p></div>
        <div><p className="font-display text-3xl font-semibold">{data.roleplays.length}</p><p className="text-ink-soft">rehearsals</p></div>
        <div><p className="font-display text-3xl font-semibold">{data.practice.length}</p><p className="text-ink-soft">exercises tried</p></div>
      </Card>
      {moments.length === 0 ? <EmptyState title="Nothing to show yet">When you rate how things felt, trends appear here.</EmptyState> : RATING_ORDER.map((k) => {
        const s = seriesFor(moments, k);
        if (s.length === 0) return null;
        return (
          <Card key={k}>
            <h2 className="text-xl">{RATING_ITEMS[k].title}</h2>
            <p className="text-sm text-ink-faint">1 = {RATING_ITEMS[k].low.toLowerCase()} · 5 = {RATING_ITEMS[k].high.toLowerCase()}</p>
            <Trend points={s} />
            <details className="mt-2"><summary className="min-h-11 cursor-pointer font-semibold text-teal">View as a table</summary>
              <table className="mt-2 w-full text-left"><thead><tr><th>Date</th><th>Rating</th></tr></thead>
                <tbody>{s.map((p, i) => <tr key={i}><td>{formatDay(p.at)}</td><td>{p.value} of 5</td></tr>)}</tbody></table></details>
          </Card>
        );
      })}
    </div>
  );
}
