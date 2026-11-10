"use client";

import { useRef, useState } from "react";
import { CONSENTS, CONSENT_ORDER, hasConsent } from "@/lib/consent";
import { buildExport, parseImport } from "@/lib/data";
import { useApp, useData } from "@/lib/hooks";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { ConsentText } from "../consent-card";
import { Segmented, Toggle } from "../ui/form";
import { Callout, Card, PageHeader } from "../ui/layout";

export function SettingsScreen() {
  const s = useApp();
  const data = useData((d) => d);
  const { settings } = data;
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(buildExport(data), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `let-me-finish-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    s.logAudit("data.exported");
    setMsg("Your data was downloaded as a file.");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <Card>
        <h2 className="text-xl">Accessibility</h2>
        <div className="mt-3 space-y-4">
          <Segmented legend="Theme" options={[{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }]} value={settings.theme} onChange={(theme) => s.updateSettings({ theme })} />
          <Segmented legend="Text size" options={[{ id: "1", label: "Normal" }, { id: "1.125", label: "Large" }, { id: "1.25", label: "Larger" }, { id: "1.5", label: "Largest" }]}
            value={String(settings.fontScale)} onChange={(v) => s.updateSettings({ fontScale: Number(v) as 1 })} />
          <Toggle label="Reduce motion" checked={settings.motion === "reduce"} onChange={(c) => s.updateSettings({ motion: c ? "reduce" : "system" })} />
          <Toggle label="Higher contrast" checked={settings.contrast === "more"} onChange={(c) => s.updateSettings({ contrast: c ? "more" : "system" })} />
        </div>
      </Card>
      <Card>
        <h2 className="text-xl">Conversation</h2>
        <Toggle label="Partner speaks replies aloud" checked={settings.voice.speakReplies} onChange={(speakReplies) => s.updateVoice({ speakReplies })} />
        <Toggle label="Start my turn automatically after the partner" checked={settings.voice.autoListen} onChange={(autoListen) => s.updateVoice({ autoListen })} />
        <Toggle label="Show my words as I speak" checked={settings.voice.liveTranscript} onChange={(liveTranscript) => s.updateVoice({ liveTranscript })} />
        <Toggle label="Check my words before sending" detail="Review and correct what was heard before the partner replies." checked={settings.voice.reviewBeforeSend} onChange={(reviewBeforeSend) => s.updateVoice({ reviewBeforeSend })} />
        <Toggle label="End my turn automatically after silence" detail="Off by default. Silence normally never ends your turn. If you switch this on it only applies after you have said something." checked={settings.voice.autoEnd.enabled}
          onChange={(enabled) => s.updateVoice({ autoEnd: { ...settings.voice.autoEnd, enabled } })} />
        {settings.voice.autoEnd.enabled ? (
          <label className="block py-2">Wait <strong>{settings.voice.autoEnd.seconds}</strong> seconds of silence
            <input type="range" min={4} max={20} value={settings.voice.autoEnd.seconds} onChange={(e) => s.updateVoice({ autoEnd: { enabled: true, seconds: Number(e.target.value) } })} /></label>
        ) : null}
        <Toggle label="Use the scripted partner only" detail="Nothing is ever sent to an AI service." checked={settings.partner.scriptedOnly} onChange={(scriptedOnly) => s.updatePartner({ scriptedOnly })} />
        <Toggle label="Phone ring sound" checked={settings.voice.sounds} onChange={(sounds) => s.updateVoice({ sounds })} />
      </Card>
      <Card>
        <h2 className="text-xl">Consent</h2>
        <p className="text-ink-soft">Each is separate and can be withdrawn at any time.</p>
        {CONSENT_ORDER.filter((p) => p !== "core").map((p) => (
          <div key={p} className="border-t border-line first:border-0">
            <Toggle label={CONSENTS[p].title} checked={hasConsent(data.consents, p)} onChange={(c) => s.setConsent(p, c)} />
            <ConsentText purpose={p} />
          </div>
        ))}
      </Card>
      <Card>
        <h2 className="text-xl">Keeping data</h2>
        <Segmented legend="Delete saved transcripts after" options={[{ id: "7", label: "7 days" }, { id: "30", label: "30 days" }, { id: "90", label: "90 days" }, { id: "0", label: "Never" }]}
          value={String(settings.retention.transcriptDays)} onChange={(v) => s.updateRetention({ transcriptDays: Number(v) as 7 })} />
        <div className="mt-4"><Segmented legend="Delete history after" options={[{ id: "90", label: "90 days" }, { id: "365", label: "1 year" }, { id: "0", label: "Never" }]}
          value={String(settings.retention.historyDays)} onChange={(v) => s.updateRetention({ historyDays: Number(v) as 0 })} /></div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => { s.deleteTranscripts(); setMsg("Saved transcripts deleted."); }}>Delete all transcripts</Button>
        </div>
      </Card>
      <Card>
        <h2 className="text-xl">Your data</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exportAll}>Export everything</Button>
          <Button variant="secondary" onClick={() => file.current?.click()}>Import an export</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>Delete everything</Button>
        </div>
        <input ref={file} type="file" accept="application/json" className="sr-only" aria-label="Choose an export file" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          try { s.importData(parseImport(await f.text())); setMsg("Imported."); } catch (err) { setMsg((err as Error).message); }
          e.target.value = ""; }} />
        {msg ? <p role="status" className="mt-3 font-semibold">{msg}</p> : null}
      </Card>
      <Callout tone="note"><p>Let Me Finish isn’t a medical service and hasn’t been clinically validated. <a className="underline" href="/privacy">Privacy details</a>.</p></Callout>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete everything?" footer={<>
        <Button variant="secondary" onClick={() => setConfirm(false)}>Keep my data</Button>
        <Button variant="danger" onClick={() => {
          s.deleteEverything();
          // A full reload on purpose: it clears every trace of state held in memory.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/";
        }}>Delete it all</Button></>}>
        <p>This removes your profile, goals, history, reflections and consents from this device. It can’t be undone. Export first if you want a copy.</p>
      </Dialog>
    </div>
  );
}
