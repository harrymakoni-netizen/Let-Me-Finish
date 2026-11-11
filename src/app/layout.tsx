import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { StoreBoot } from "@/components/store-boot";
import { UI_PREFS_KEY } from "@/lib/data";
import "./globals.css";

const body = localFont({
  src: "./fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2",
  variable: "--font-body",
  weight: "200 800",
  display: "swap",
});

const display = localFont({
  src: "./fonts/fraunces-latin-opsz-normal.woff2",
  variable: "--font-display-face",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Let Me Finish",
    template: "%s · Let Me Finish",
  },
  description:
    "A patient, private speech companion for adults who stammer. Practise real conversations with a partner that waits until you have finished.",
  applicationName: "Let Me Finish",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    siteName: "Let Me Finish",
    title: "Let Me Finish — your voice, your words, your pace",
    description:
      "Practise real conversations with a partner that waits until you say you’ve finished. Private, free to try, no account needed.",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Let Me Finish", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1828" },
  ],
};

// Runs before first paint so a saved theme, text size, motion or contrast
// choice never flashes the wrong way on load.
const prePaint = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  UI_PREFS_KEY,
)})||"{}"),e=document.documentElement;if(p.theme==="light"||p.theme==="dark")e.setAttribute("data-theme",p.theme);if(p.fontScale)e.style.setProperty("--font-scale",String(p.fontScale));if(p.motion==="reduce")e.setAttribute("data-motion","reduce");if(p.contrast==="more")e.setAttribute("data-contrast","more")}catch(_){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prePaint }} />
      </head>
      <body>
        <StoreBoot />
        {children}
      </body>
    </html>
  );
}
