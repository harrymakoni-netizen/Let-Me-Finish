"use client";

import { useState } from "react";
import { useApp } from "@/lib/hooks";
import type { FeedbackReport } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { ChoiceCards, TextArea } from "./ui/form";
import { Callout } from "./ui/layout";

const KINDS: { id: FeedbackReport["kind"]; label: string; detail: string }[] = [
  { id: "partner_reply", label: "Something the partner said", detail: "Unkind, wrong, hurried you, or commented on your speech." },
  { id: "content", label: "A lesson or piece of information", detail: "Inaccurate, unclear, or not right for you." },
  { id: "safety", label: "A safety concern", detail: "Something that could harm you or someone else." },
  { id: "bug", label: "Something isn’t working", detail: "A fault in the app itself." },
  { id: "other", label: "Something else", detail: "" },
];

/**
 * The reporting mechanism. A report is kept on this device as the person's
 * own record and sent to the team when the app is online and an inbox is set up.
 */
export function ReportDialog({
  open,
  onClose,
  defaultKind = "other",
  context,
}: {
  open: boolean;
  onClose: () => void;
  defaultKind?: FeedbackReport["kind"];
  /** e.g. the reply being flagged. Shown to the person before anything is sent. */
  context?: string;
}) {
  const addFeedback = useApp((s) => s.addFeedback);
  const markDelivered = useApp((s) => s.markFeedbackDelivered);
  const [kind, setKind] = useState<FeedbackReport["kind"]>(defaultKind);
  const [detail, setDetail] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [status, setStatus] = useState<"editing" | "sending" | "sent" | "saved">("editing");

  const close = () => {
    onClose();
    // Reset after the dialog has gone, ready for next time.
    setTimeout(() => {
      setDetail("");
      setStatus("editing");
      setKind(defaultKind);
      setIncludeContext(true);
    }, 150);
  };

  const submit = async () => {
    const attached = context && includeContext ? context : undefined;
    const id = addFeedback({ kind, detail, context: attached });
    setStatus("sending");
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, detail, context: attached }),
      });
      const body = (await res.json().catch(() => ({}))) as { delivered?: boolean };
      if (res.ok && body.delivered) {
        markDelivered(id);
        setStatus("sent");
      } else {
        setStatus("saved");
      }
    } catch {
      setStatus("saved");
    }
  };

  const done = status === "sent" || status === "saved";

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Report a problem"
      footer={
        done ? (
          <Button onClick={close}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!detail.trim() || status === "sending"}>
              {status === "sending" ? "Sending…" : "Send report"}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div role="status" className="space-y-3">
          <p className="font-display text-xl font-semibold">Thank you — that helps make this safer.</p>
          <p className="text-ink-soft">
            {status === "sent"
              ? "Your report has been sent to the team."
              : "Your report is saved on this device. It couldn’t be delivered just now — this copy of the app may not have a reporting inbox set up yet, or you may be offline."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <ChoiceCards
            legend="What is it about?"
            legendClassName="font-semibold"
            options={KINDS.map((k) => ({ id: k.id, label: k.label, detail: k.detail || undefined }))}
            value={kind}
            onChange={setKind}
          />
          <TextArea
            label="What happened?"
            hint="A sentence or two is plenty."
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={2000}
            rows={4}
          />
          {context ? (
            <div className="rounded-control border border-line bg-sunk p-3">
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                />
                Include the text I’m reporting
              </label>
              <p className="mt-1 text-[0.9375rem] text-ink-soft">“{context}”</p>
            </div>
          ) : null}
          <Callout tone="note">
            <p>
              Only what you write here is sent. This isn’t a monitored emergency service — if you need help now, the
              Support page lists people you can call.
            </p>
          </Callout>
        </div>
      )}
    </Dialog>
  );
}
