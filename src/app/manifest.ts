import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Let Me Finish",
    short_name: "Let Me Finish",
    description:
      "A patient, private speech companion for adults who stammer. Your voice. Your words. Your pace.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0b1828",
    theme_color: "#0b1828",
    lang: "en-GB",
    categories: ["health", "education", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start a conversation", short_name: "Talk", url: "/talk" },
      { name: "Today's practice", short_name: "Today", url: "/today" },
      { name: "Support", short_name: "Support", url: "/support" },
    ],
  };
}
