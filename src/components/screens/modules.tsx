"use client";

import { Bookmark, BookmarkCheck, Play, Square } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MODULES, getModule, searchModules, type Module } from "@/lib/content/modules";
import { useApp, useData, useStopwatch, useTx } from "@/lib/hooks";
import { formatDuration } from "@/lib/util";
import { Button, ButtonLink } from "../ui/button";
import { Callout, LinkCard, PageHeader, Tag } from "../ui/layout";
import { TextInput } from "../ui/form";

function ReviewTag({ m }: { m: Module }) {
  return m.review.status === "reviewed" ? <Tag tone="teal">Reviewed {m.review.reviewedOn}</Tag> : <Tag tone="warn">Awaiting clinical review</Tag>;
}

export function ModuleList({ mode }: { mode: "practice" | "library" }) {
  const tx = useTx();
  const saved = useData((d) => d.savedModuleIds);
  const [q, setQ] = useState("");
  const list = mode === "library" ? searchModules(q) : MODULES.filter((m) => m.kind !== "information");
  return (
    <div>
      <PageHeader title={mode === "library" ? "Library" : "Practice"}
        lead="All techniques are optional, and different things suit different people. Content is awaiting review by a licensed speech and language therapist." />
      {mode === "library" ? <div className="mb-5"><TextInput label="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div> : null}
      <ul className="grid gap-3">
        {list.map((m) => (
          <li key={m.id}>
            <LinkCard href={`/practice/view?id=${m.id}`} title={tx(m.title)} detail={tx(m.summary)}
              meta={<>{m.minutes} min · {m.kind}{saved.includes(m.id) ? " · saved" : ""} · <ReviewTag m={m} /></>} />
          </li>
        ))}
        {list.length === 0 ? <li className="text-ink-soft">Nothing matches that search.</li> : null}
      </ul>
    </div>
  );
}

export function ModuleView() {
  const id = useSearchParams().get("id") ?? "";
  const m = getModule(id);
  const tx = useTx();
  const store = useApp();
  const saved = useData((d) => d.savedModuleIds.includes(id));
  const sw = useStopwatch();
  const [logged, setLogged] = useState<string | null>(null);
  if (!m) return <p>That lesson isn’t here. <ButtonLink href="/practice" variant="quiet">Back to Practice</ButtonLink></p>;
  const log = (verdict: "useful" | "unsure" | "not_for_me") => {
    const at = new Date().toISOString();
    const pid = store.logPractice({ moduleId: m.id, startedAt: at, completedAt: at, durationSec: sw.elapsed, verdict });
    void pid;
    store.setDailyStep("exercise", "done");
    setLogged(verdict);
  };
  return (
    <div className="prose-lmf">
      <PageHeader title={tx(m.title)} lead={tx(m.summary)} back={{ href: "/practice", label: "Practice" }}
        actions={<Button variant="secondary" size="sm" icon={saved ? <BookmarkCheck aria-hidden="true" className="size-4" /> : <Bookmark aria-hidden="true" className="size-4" />}
          onClick={() => store.toggleSavedModule(m.id)} aria-pressed={saved}>{saved ? "Saved" : "Save"}</Button>} />
      <p><ReviewTag m={m} /> <span className="text-ink-faint">Version {m.version}</span></p>
      <Callout tone="warn" title="Not for everyone"><p>{tx(m.contraindications)}</p></Callout>
      {m.steps.length ? <ol>{m.steps.map((s) => <li key={s}>{tx(s)}</li>)}</ol> : null}
      {m.notes.map((n) => <p key={n}>{tx(n)}</p>)}
      {m.kind !== "information" ? (
        <div className="not-prose mt-6 space-y-4 rounded-card border border-line bg-surface p-5">
          <p className="font-semibold">Optional timer {sw.elapsed > 0 ? `· ${formatDuration(sw.elapsed)}` : ""}</p>
          <div className="flex gap-2">
            {sw.running ? <Button variant="secondary" icon={<Square aria-hidden="true" className="size-4" />} onClick={sw.stop}>Stop</Button>
              : <Button variant="secondary" icon={<Play aria-hidden="true" className="size-4" />} onClick={sw.start}>Start</Button>}
          </div>
          <p className="font-semibold">How was it?</p>
          {logged ? <p role="status">Thanks — noted. “{logged.replace("_", " ")}” is a perfectly good answer.</p> : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => log("useful")}>Useful</Button>
              <Button variant="secondary" onClick={() => log("unsure")}>Not sure</Button>
              <Button variant="secondary" onClick={() => log("not_for_me")}>Not for me</Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
