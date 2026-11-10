"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceCards, TextArea, TextInput } from "@/components/ui/form";
import { Callout, PageHeader } from "@/components/ui/layout";
import { useApp, useData } from "@/lib/hooks";
import type { CustomScenario } from "@/lib/types";

const EMPTY: CustomScenario = {
  title: "",
  partner: "",
  setting: "",
  aim: "",
  channel: "in_person",
  whoStarts: "partner",
};

/** Write (or edit) a scene for a real conversation of your own. */
export function SceneEditor() {
  const params = useSearchParams();
  const id = params.get("id");
  const existing = useData((d) => (id ? d.scenes.find((s) => s.id === id) : undefined));
  return <SceneForm key={id ?? "new"} id={id ?? undefined} initial={existing ?? EMPTY} />;
}

function SceneForm({ id, initial }: { id?: string; initial: CustomScenario }) {
  const router = useRouter();
  const saveScene = useApp((s) => s.saveScene);
  const [scene, setScene] = useState<CustomScenario>({
    title: initial.title,
    partner: initial.partner,
    setting: initial.setting,
    aim: initial.aim,
    channel: initial.channel,
    whoStarts: initial.whoStarts,
  });
  const [tried, setTried] = useState(false);
  const set = <K extends keyof CustomScenario>(key: K, value: CustomScenario[K]) =>
    setScene((s) => ({ ...s, [key]: value }));
  const missing = !scene.partner.trim();

  const save = (thenStart: boolean) => {
    setTried(true);
    if (missing) return;
    const title = scene.title.trim() || `Talking with ${scene.partner.trim()}`;
    const sceneId = saveScene({ ...scene, title }, id);
    router.push(thenStart ? `/talk/session?scene=${sceneId}` : "/talk");
  };

  return (
    <div>
      <PageHeader
        title={id ? "Edit your scene" : "Write your own scene"}
        lead="Describe a conversation you actually have coming up. The more it sounds like the real thing, the more useful the rehearsal."
        back={{ href: "/talk", label: "Talk" }}
      />
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save(true);
        }}
      >
        <TextInput
          label="Who will you be talking to?"
          hint="For example: my landlord, the receptionist at my GP surgery, my course tutor."
          value={scene.partner}
          onChange={(e) => set("partner", e.target.value)}
          maxLength={200}
          aria-invalid={tried && missing ? true : undefined}
        />
        {tried && missing ? (
          <p role="alert" className="-mt-4 text-[0.9375rem] font-semibold text-danger">
            Say who the other person is, so the partner knows who to be.
          </p>
        ) : null}
        <TextArea
          label="Where and when is it?"
          optional
          hint="A sentence is enough: on the phone on Monday morning; at the front desk; in a seminar of twelve people."
          value={scene.setting}
          onChange={(e) => set("setting", e.target.value)}
          maxLength={400}
        />
        <TextArea
          label="What do you want to say or get done?"
          optional
          hint="For example: ask for the boiler to be fixed this week; explain why I missed the deadline."
          value={scene.aim}
          onChange={(e) => set("aim", e.target.value)}
          maxLength={400}
        />
        <ChoiceCards
          legend="How does it happen?"
          legendClassName="font-semibold"
          layout="row"
          options={[
            { id: "in_person", label: "Face to face" },
            { id: "phone", label: "On the phone" },
          ]}
          value={scene.channel}
          onChange={(v) => set("channel", v)}
        />
        <ChoiceCards
          legend="Who speaks first?"
          legendClassName="font-semibold"
          layout="row"
          options={[
            { id: "partner", label: "They do" },
            { id: "user", label: "I do" },
          ]}
          value={scene.whoStarts}
          onChange={(v) => set("whoStarts", v)}
        />
        <TextInput
          label="A name for this scene"
          optional
          value={scene.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={140}
        />
        <Callout tone="note">
          <p>
            Your scene is saved on this device. If you use the AI partner, this description is sent with the
            conversation so it can play the part — so leave out anything private, like full names or account numbers.
          </p>
        </Callout>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg">
            Save and rehearse
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => save(false)}>
            Save for later
          </Button>
        </div>
      </form>
    </div>
  );
}
