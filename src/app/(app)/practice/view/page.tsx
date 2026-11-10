import type { Metadata } from "next";
import { Suspense } from "react";
import { ModuleView } from "@/components/screens/modules";
export const metadata: Metadata = { title: "Lesson" };
export default function Page() { return <Suspense fallback={null}><ModuleView /></Suspense>; }
