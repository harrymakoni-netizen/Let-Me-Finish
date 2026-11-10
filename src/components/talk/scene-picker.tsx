"use client";

import {
  Briefcase,
  Coffee,
  GraduationCap,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Presentation,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, LinkCard, PageHeader, SectionTitle } from "@/components/ui/layout";
import { ROLE_LABELS, getScenario, scenariosFor, type Scenario } from "@/lib/content/scenarios";
import { sessionRecord } from "@/lib/conversation/launch";
import { fetchStatus } from "@/lib/conversation/partner-client";
import { useApp, useConsent, useData, useOnline, useTx } from "@/lib/hooks";
import Link from "next/link";

function SceneIcon({ scenario }: { scenario: Scenario }) {
  const props = { "aria-hidden": true, className: "size-5" } as const;
  if (scenario.channel === "phone") return <Phone {...props} />;
  if (scenario.id === "presentation-qa") return <Presentation {...props} />;
  switch (scenario.role) {
    case "lecturer":
      return <GraduationCap {...props} />;
    case "recruiter":
      return <Briefcase {...props} />;
    case "cashier":
      return <Coffee {...props} />;
    case "colleague":
    case "stranger":
      return <Users {...props} />;
    default:
      return <MessageCircle {...props} />;
  }
}

export function ScenePicker() {
  const tx = useTx();
  const situations = useData((d) => d.profile.situationIds);
  const active = useData((d) => d.activeConversation);
  const scenes = useData((d) => d.scenes);
  const scriptedOnly = useData((d) => d.settings.partner.scriptedOnly);
  const removeScene = useApp((s) => s.removeScene);
  const aiConsent = useConsent("ai");
  const online = useOnline();
  const [ai, setAi] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().then((s) => {
      if (!cancelled) setAi(s.ai);
    });
    return () => {
      cancelled = true;
    };
  }, [online]);

  const ordered = useMemo(() => scenariosFor(situations), [situations]);
  const suggested = situations.length > 0 ? ordered.filter((s) => s.situations.some((id) => situations.includes(id))).slice(0, 3) : [];
  const rest = ordered.filter((s) => !suggested.includes(s));

  const activeTitle = active ? (active.custom?.title ?? getScenario(active.scenarioId)?.title ?? "Conversation") : "";

  const endActive = () => {
    const state = useApp.getState();
    const snap = state.data.activeConversation;
    if (!snap) return;
    const record = sessionRecord(snap, tx(activeTitle), state.data);
    if (record) state.finishRoleplay(record);
    else state.saveConversation(null);
  };

  const partnerLine = !online
    ? "You’re offline: scenes will use the scripted partner, which works without a connection."
    : ai === null
      ? null
      : !ai
        ? "The AI partner isn’t set up on this copy of the app, so scenes use the scripted partner."
        : scriptedOnly
          ? "You’ve chosen the scripted partner only. You can change that in Settings."
          : aiConsent
            ? "The AI partner is on: it responds to what you actually say."
            : "Scenes use the scripted partner until you switch on the AI partner — you’ll be asked before a conversation starts.";

  return (
    <div>
      <PageHeader
        title="Talk"
        lead="Rehearse a real conversation with a partner who waits. Your turn ends when you say it does, never before."
      />

      {active ? (
        <Callout tone="info" title="You have a conversation in progress" className="mb-6">
          <p>{tx(activeTitle)}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink href="/talk/session?resume=1" size="sm">
              Carry on
            </ButtonLink>
            <Button size="sm" variant="secondary" onClick={endActive}>
              End it
            </Button>
          </div>
        </Callout>
      ) : null}

      {partnerLine ? (
        <p className="mb-6 text-[0.9375rem] text-ink-soft" role="status">
          {partnerLine}
        </p>
      ) : null}

      {suggested.length > 0 ? (
        <section aria-labelledby="suggested-title" className="mb-8">
          <SectionTitle id="suggested-title">For the situations you chose</SectionTitle>
          <ul className="mt-3 grid gap-3">
            {suggested.map((s) => (
              <li key={s.id}>
                <SceneCard scenario={s} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="yours-title" className="mb-8">
        <SectionTitle id="yours-title">Your own scenes</SectionTitle>
        <p className="mt-1 text-ink-soft">
          Describe a real conversation you have coming up and rehearse exactly that.
        </p>
        {scenes.length > 0 ? (
          <ul className="mt-3 grid gap-3">
            {scenes.map((scene) => (
              <li key={scene.id} className="flex items-stretch gap-2">
                <LinkCard
                  href={`/talk/session?scene=${scene.id}`}
                  title={scene.title || "My own scene"}
                  detail={`With ${scene.partner}`}
                  meta={scene.channel === "phone" ? "Phone call" : "Face to face"}
                  icon={scene.channel === "phone" ? <Phone aria-hidden="true" className="size-5" /> : <Users aria-hidden="true" className="size-5" />}
                  className="flex-1"
                />
                <div className="flex flex-col justify-center gap-1">
                  <Link
                    href={`/talk/scene?id=${scene.id}`}
                    aria-label={`Edit ${scene.title || "scene"}`}
                    title="Edit"
                    className="inline-flex size-12 items-center justify-center rounded-control text-ink-soft hover:bg-sunk hover:text-ink"
                  >
                    <Pencil aria-hidden="true" className="size-5" />
                  </Link>
                  <IconButton label={`Delete ${scene.title || "scene"}`} onClick={() => removeScene(scene.id)}>
                    <Trash2 aria-hidden="true" className="size-5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3">
          <ButtonLink href="/talk/scene" variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />}>
            Write a scene
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="all-title">
        <SectionTitle id="all-title">{suggested.length > 0 ? "More scenes" : "Scenes"}</SectionTitle>
        <ul className="mt-3 grid gap-3">
          {rest.map((s) => (
            <li key={s.id}>
              <SceneCard scenario={s} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SceneCard({ scenario }: { scenario: Scenario }) {
  const tx = useTx();
  return (
    <LinkCard
      href={`/talk/session?scenario=${scenario.id}`}
      title={tx(scenario.title)}
      detail={tx(scenario.summary)}
      meta={`${scenario.channel === "phone" ? "Phone call" : "Face to face"} · ${ROLE_LABELS[scenario.role]} · about ${scenario.minutes} min`}
      icon={<SceneIcon scenario={scenario} />}
    />
  );
}
