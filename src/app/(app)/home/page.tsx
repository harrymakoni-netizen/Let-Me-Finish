import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <h1 className="text-3xl">Home</h1>;
}
