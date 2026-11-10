import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyView } from "@/components/screens/journeys";
export const metadata: Metadata = { title: "Journey" };
export default function Page() { return <Suspense fallback={null}><JourneyView /></Suspense>; }
