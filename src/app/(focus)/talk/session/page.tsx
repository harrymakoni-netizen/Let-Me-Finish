import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionScreen } from "@/components/talk/session-screen";

export const metadata: Metadata = { title: "Conversation" };

export default function SessionPage() {
  return (
    <Suspense fallback={<p className="py-10 text-ink-soft">Getting the scene ready…</p>}>
      <SessionScreen />
    </Suspense>
  );
}
