import type { Metadata } from "next";
import { Suspense } from "react";
import { SceneEditor } from "@/components/talk/scene-editor";

export const metadata: Metadata = { title: "Your own scene" };

export default function ScenePage() {
  return (
    <Suspense fallback={null}>
      <SceneEditor />
    </Suspense>
  );
}
