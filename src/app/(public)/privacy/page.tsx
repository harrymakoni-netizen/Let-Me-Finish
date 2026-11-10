import type { Metadata } from "next";
import { CONSENTS, CONSENT_ORDER } from "@/lib/consent";
export const metadata: Metadata = { title: "Privacy" };
export default function Page() {
  return (
    <div className="prose-lmf">
      <h1 className="text-4xl">Privacy</h1>
      <p>Plain version. This is a working concept, and this text is not legal advice or a finished privacy policy.</p>
      <ul>
        <li>Your data lives in this browser by default. You can export or delete all of it in Settings.</li>
        <li>No raw audio is recorded or stored by Let Me Finish. Transcripts are kept only if you opt in, and expire.</li>
        <li>No adverts, no tracking, no selling data, and nothing is inferred about your speech or feelings.</li>
        <li>With the AI partner on, only conversation text and the scene go to the AI provider to produce replies.</li>
      </ul>
      {CONSENT_ORDER.map((p) => (
        <section key={p}>
          <h2>{CONSENTS[p].title}</h2>
          <p>{CONSENTS[p].summary}</p>
          <ul>{CONSENTS[p].details.map((d) => <li key={d}>{d.replaceAll("{therapist}", "speech and language therapist")}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}
