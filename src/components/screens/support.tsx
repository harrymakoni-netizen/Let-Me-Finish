"use client";

import { REGION_OPTIONS } from "@/lib/content/options";
import { SUPPORT_LAST_CHECKED, WORLDWIDE, supportFor } from "@/lib/content/support";
import { useApp, useData } from "@/lib/hooks";
import { ContactList } from "../support-panel";
import { Select } from "../ui/form";
import { Callout, PageHeader, SectionTitle } from "../ui/layout";

export function SupportScreen() {
  const region = useData((d) => d.profile.region);
  const update = useApp((s) => s.updateProfile);
  const s = supportFor(region);
  return (
    <div className="space-y-8">
      <PageHeader title="Support" lead="Real people who can help. This app can’t monitor you or contact anyone on your behalf." />
      <Select label="Where are you?" value={region} onChange={(e) => update({ region: e.target.value as typeof region })}>
        {REGION_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </Select>
      <Callout tone="danger" role="note" title="In danger or at immediate risk?"><p>Call <strong>{s.emergency.number}</strong>. {s.emergency.note}</p></Callout>
      <section><SectionTitle>Feeling low or in crisis</SectionTitle><div className="mt-3"><ContactList contacts={s.crisis} /></div></section>
      <section><SectionTitle>Stammering support</SectionTitle><div className="mt-3"><ContactList contacts={s.stammering} /></div>
        <p className="mt-3 text-ink-soft">A qualified speech and language therapist can assess and support your speech. This app can’t.</p></section>
      <section><SectionTitle>Anywhere</SectionTitle><div className="mt-3"><ContactList contacts={WORLDWIDE} /></div></section>
      <p className="text-sm text-ink-faint">Details last checked {SUPPORT_LAST_CHECKED}. Services change — confirm before relying on them.</p>
    </div>
  );
}
