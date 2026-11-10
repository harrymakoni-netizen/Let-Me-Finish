"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChartLine,
  House,
  LifeBuoy,
  MessagesSquare,
  Route,
  Settings,
  Sprout,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useData, useHydrated, useOnline } from "@/lib/hooks";
import { useStorageFailed } from "@/lib/store";
import { cx } from "@/lib/util";
import { Wordmark } from "./brand";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const PRIMARY: NavItem[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/talk", label: "Talk", icon: MessagesSquare },
  { href: "/practice", label: "Practice", icon: Sprout },
  { href: "/journeys", label: "Journeys", icon: Route },
  { href: "/progress", label: "Progress", icon: ChartLine },
];

const SECONDARY: NavItem[] = [
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-3 focus:font-semibold focus:text-paper"
    >
      Skip to main content
    </a>
  );
}

function OfflineNotice() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-[0.9375rem] text-paper"
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      <span>You’re offline. Lessons, tools and the scripted partner still work.</span>
    </div>
  );
}

function StorageNotice() {
  const failed = useStorageFailed();
  if (!failed) return null;
  return (
    <div role="alert" className="bg-warn-wash px-4 py-2 text-center text-[0.9375rem] text-warn">
      Your browser isn’t letting this app save. Changes will be lost when you close this tab — check that you’re
      not in private browsing.
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6" aria-busy="true">
      <p className="sr-only" role="status">
        Loading your space…
      </p>
      <div className="h-9 w-56 rounded-control bg-sunk" />
      <div className="mt-4 h-5 w-80 max-w-full rounded-control bg-sunk" />
      <div className="mt-8 h-40 rounded-card bg-sunk" />
      <div className="mt-4 h-28 rounded-card bg-sunk" />
    </div>
  );
}

/**
 * Holds back the signed-in area until saved data has loaded, and sends anyone
 * who has not finished setting up back to the welcome page.
 */
export function Gate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const onboarded = useData((d) => Boolean(d.onboardedAt));
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/");
  }, [hydrated, onboarded, router]);

  if (!hydrated || !onboarded) return <ShellSkeleton />;
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[18rem_1fr]">
      <SkipLink />

      {/* Wide screens: a calm side rail. */}
      <aside className="no-print hidden border-r border-line bg-paper lg:flex lg:flex-col lg:px-8 lg:py-8">
        <Wordmark className="px-2" />
        <nav aria-label="Main" className="mt-8 flex-1">
          <ul className="space-y-1">
            {PRIMARY.map((item) => (
              <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </ul>
          <div className="my-4 border-t border-line" />
          <ul className="space-y-1">
            {SECONDARY.map((item) => (
              <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </ul>
        </nav>
        <p className="px-2 text-sm leading-snug text-ink-faint">Your voice. Your words. Your pace.</p>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Small screens: a slim top bar. */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-3 py-1.5 backdrop-blur lg:hidden">
          <Wordmark />
          <nav aria-label="More" className="flex items-center">
            {SECONDARY.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={cx(
                    "inline-flex size-12 items-center justify-center rounded-control",
                    active ? "bg-teal-wash text-teal" : "text-ink-soft hover:bg-sunk hover:text-ink",
                  )}
                >
                  <Icon aria-hidden="true" className="size-[1.375rem]" />
                </Link>
              );
            })}
          </nav>
        </header>

        <OfflineNotice />
        <StorageNotice />

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-5 pb-28 pt-8 outline-none sm:px-8 lg:pb-16 lg:pt-14">
          <Gate>{children}</Gate>
        </main>

        {/* Small screens: thumb-reach tabs. */}
        <nav
          aria-label="Main"
          className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/97 backdrop-blur lg:hidden"
        >
          <ul className="mx-auto flex max-w-xl items-stretch justify-between px-1 pt-1">
            {PRIMARY.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-[0.8125rem] font-semibold",
                      active ? "text-teal" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    <span
                      className={cx(
                        "relative flex h-7 w-12 items-center justify-center",
                        "after:absolute after:-top-2 after:h-[3px] after:w-8 after:rounded-full after:transition-colors",
                        active ? "after:bg-teal" : "after:bg-transparent",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-[1.375rem]" />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "relative flex min-h-12 items-center gap-3 rounded-control px-3 font-medium transition-colors",
          "before:absolute before:-left-4 before:top-2.5 before:h-7 before:w-[3px] before:rounded-full before:transition-colors",
          active ? "text-ink before:bg-teal" : "text-ink-soft before:bg-transparent hover:text-ink",
        )}
      >
        <Icon aria-hidden="true" className={cx("size-5", active && "text-teal")} />
        {item.label}
      </Link>
    </li>
  );
}

/** A quieter frame for focused tasks (a live conversation, setting up). */
export function FocusShell({ children, gated = true }: { children: ReactNode; gated?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <OfflineNotice />
      <StorageNotice />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-8 pt-4 outline-none sm:px-6">
        {gated ? <Gate>{children}</Gate> : children}
      </main>
    </div>
  );
}

/** Plain public pages: welcome, privacy, the listener guide. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="no-print border-b border-line px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Wordmark href="/" />
          <Link
            href="/support"
            className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-[0.9375rem] font-semibold text-ink-soft hover:bg-sunk hover:text-ink"
          >
            <LifeBuoy aria-hidden="true" className="size-4" />
            Support
          </Link>
        </div>
      </header>
      <OfflineNotice />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8 outline-none sm:px-6">
        {children}
      </main>
    </div>
  );
}
