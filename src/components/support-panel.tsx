"use client";

import Link from "next/link";
import { LifeBuoy, Phone } from "lucide-react";
import { REGION_OPTIONS } from "@/lib/content/options";
import { supportFor, type Contact } from "@/lib/content/support";
import { useData } from "@/lib/hooks";
import { cx } from "@/lib/util";

function ContactRow({ contact }: { contact: Contact }) {
  const external = contact.href?.startsWith("http");
  const body = (
    <>
      <span className="block font-semibold">{contact.name}</span>
      <span className="block text-lg font-semibold text-teal">{contact.action}</span>
      {contact.detail ? <span className="mt-0.5 block text-[0.9375rem] text-ink-soft">{contact.detail}</span> : null}
    </>
  );
  if (!contact.href) return <div className="rounded-control border border-line bg-surface p-3.5">{body}</div>;
  return (
    <a
      href={contact.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="block rounded-control border border-line bg-surface p-3.5 transition-colors hover:border-teal hover:bg-teal-wash"
    >
      {body}
      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </a>
  );
}

export function ContactList({ contacts }: { contacts: Contact[] }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {contacts.map((c) => (
        <li key={c.name}>
          <ContactRow contact={c} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Shown inside a conversation when something a person said suggests they may
 * need more than practice. Calm, plain and honest about what this app is.
 */
export function SupportPanel({ className }: { className?: string }) {
  const region = useData((d) => d.profile.region);
  const support = supportFor(region);
  const regionLabel = REGION_OPTIONS.find((r) => r.id === region)?.label;

  return (
    <section
      aria-labelledby="support-panel-title"
      className={cx("rounded-card border border-teal/50 bg-teal-wash p-4 sm:p-5", className)}
    >
      <h2 id="support-panel-title" className="flex items-center gap-2 text-xl">
        <LifeBuoy aria-hidden="true" className="size-5 text-teal" />
        You don’t have to carry this alone
      </h2>
      <p className="mt-2 text-[0.9375rem]">
        This app isn’t monitored and can’t contact anyone for you. These people can listen, today.
        {region !== "other" && regionLabel ? ` Showing support for ${regionLabel}.` : ""}
      </p>
      <p className="mt-3 flex items-start gap-2 rounded-control bg-surface p-3 text-[0.9375rem]">
        <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
        <span>
          If you might act on thoughts of harming yourself, or you’re in danger, call{" "}
          <strong>{support.emergency.number}</strong> now.
          {support.emergency.note ? ` ${support.emergency.note}` : ""}
        </span>
      </p>
      <div className="mt-3">
        <ContactList contacts={support.crisis} />
      </div>
      <p className="mt-3 text-[0.9375rem]">
        <Link href="/support" className="font-semibold text-teal underline underline-offset-4">
          More support, and other countries
        </Link>
      </p>
    </section>
  );
}
