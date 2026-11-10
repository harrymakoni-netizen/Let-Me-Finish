import type { Metadata } from "next";
import { ScenePicker } from "@/components/talk/scene-picker";

export const metadata: Metadata = { title: "Talk" };

export default function TalkPage() {
  return <ScenePicker />;
}
