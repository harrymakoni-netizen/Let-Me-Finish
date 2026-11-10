import type { Metadata } from "next";
import { ModuleList } from "@/components/screens/modules";
export const metadata: Metadata = { title: "Practice" };
export default function Page() { return <ModuleList mode="practice" />; }
