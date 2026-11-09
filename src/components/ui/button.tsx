import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/util";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold text-center select-none " +
  "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-55";

const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3.5 text-[0.9375rem]",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-6 text-lg",
  xl: "min-h-[4.75rem] px-8 text-xl",
};

const variants: Record<Variant, string> = {
  primary: "bg-teal text-on-teal hover:bg-teal-deep",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunk",
  quiet: "text-teal hover:bg-teal-wash underline-offset-4 hover:underline",
  danger: "bg-danger text-on-danger hover:bg-danger-deep",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(base, sizes[size], variants[variant], extra);
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  block?: boolean;
}

export function Button({
  variant,
  size,
  icon,
  iconAfter,
  block,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClass(variant, size, cx(block && "w-full", className))} {...rest}>
      {icon}
      <span>{children}</span>
      {iconAfter}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  iconAfter,
  block,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, cx(block && "w-full", className))} {...rest}>
      {icon}
      <span>{children}</span>
      {iconAfter}
    </Link>
  );
}

/** A square button that shows only an icon. `label` is required for screen readers. */
export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...rest
}: { label: string } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-12 items-center justify-center rounded-control text-ink-soft",
        "hover:bg-sunk hover:text-ink transition-colors disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
