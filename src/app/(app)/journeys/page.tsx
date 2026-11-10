import type { Metadata } from "next";
import { JourneyList } from "@/components/screens/journeys";
export const metadata: Metadata = { title: "Journeys" };
export default function Page() { return <JourneyList />; }
