import type { Metadata } from "next";
import { TodayScreen } from "@/components/screens/today";
export const metadata: Metadata = { title: "Today" };
export default function Page() { return <TodayScreen />; }
