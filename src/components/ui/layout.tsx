import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/util";

export function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: { as?: "div" | "section" | "article" | "li" } & ComponentProps<"div">) {
  return (
    <Tag
      className={cx("rounded-card border border-line bg-surface p-5 sm:p-7", className)}
      {...(rest as object)}
    >
      {children}
    </Tag>
  );
}

/** A whole row that is one link: hairline-separated, no box, a quiet arrow. */
export function LinkCard({
  href,
  title,
  detail,
  icon,
  meta,
  className,
}: {
  href: string;
  title: string;
  detail?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group flex min-h-16 items-start gap-4 rounded-card border border-line bg-surface px-5 py-4",
        "transition-[border-color,background-color,transform] duration-200 hover:border-ink hover:bg-surface sm:px-6 sm:py-5",
        className,
      )}
    >
      {icon ? <span className="mt-1 shrink-0 text-teal">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-medium leading-snug tracking-[-0.012em]">{title}</span>
        {detail ? <span className="mt-1 block text-[0.9375rem] leading-snug text-ink-soft">{detail}</span> : null}
        {meta ? <span className="mt-2 block text-sm text-ink-faint">{meta}</span> : null}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="mt-1.5 size-5 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink"
      />
    </Link>
  );
}

export function PageHeader({
  title,
  lead,
  back,
  eyebrow,
  actions,
}: {
  title: string;
  lead?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 sm:mb-10">
      {back ? (
        <Link
          href={back.href}
          className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-[0.9375rem] font-semibold text-teal hover:bg-teal-wash"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      {eyebrow ? (
        <p className="mb-2 text-sm font-semibold text-teal">{eyebrow}</p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[2.25rem] leading-[1.05] sm:text-5xl">{title}</h1>
        {actions}
      </div>
      {lead ? <p className="mt-4 max-w-[34rem] text-lg leading-relaxed text-ink-soft sm:text-xl">{lead}</p> : null}
    </header>
  );
}

export function SectionTitle({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={cx("text-[1.625rem]", className)}>
      {children}
    </h2>
  );
}

type Tone = "info" | "note" | "warn" | "danger";

const toneClass: Record<Tone, string> = {
  info: "border-teal/40 bg-teal-wash",
  note: "border-line bg-sunk",
  warn: "border-warn/40 bg-warn-wash",
  danger: "border-danger/40 bg-danger-wash",
};

export function Callout({
  tone = "note",
  title,
  children,
  icon,
  className,
  role,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  role?: "status" | "alert" | "note";
}) {
  const defaultIcon =
    tone === "warn" || tone === "danger" ? (
      <TriangleAlert aria-hidden="true" className="size-5" />
    ) : (
      <Info aria-hidden="true" className="size-5" />
    );
  return (
    <div role={role} className={cx("flex gap-3 rounded-card border p-4", toneClass[tone], className)}>
      <span className="mt-0.5 shrink-0 text-ink-soft">{icon ?? defaultIcon}</span>
      <div className="min-w-0 space-y-1.5 text-[0.9375rem] leading-relaxed">
        {title ? <p className="font-semibold text-base">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

/** "Step 2 of 6" with a bar. The text carries the meaning; the bar is decoration. */
export function StepProgress({ current, total, label }: { current: number; total: number; label?: string }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div>
      <p className="text-sm font-semibold text-ink-soft">
        Step {current} of {total}
        {label ? <span className="font-normal"> · {label}</span> : null}
      </p>
      <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunk">
        <div className="h-full rounded-full bg-teal transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "teal" | "violet" | "warn" }) {
  const tones = {
    plain: "bg-sunk text-ink-soft",
    teal: "bg-teal-wash text-ink",
    violet: "bg-violet-wash text-ink",
    warn: "bg-warn-wash text-warn",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface/60 p-6 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-prose text-ink-soft">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
