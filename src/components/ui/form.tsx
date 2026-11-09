"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import type { Rating } from "@/lib/types";
import { cx } from "@/lib/util";

const inputClass =
  "w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-ink " +
  "placeholder:text-ink-faint min-h-12";

export function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold">
        {label}
        {optional ? <span className="ml-2 font-normal text-ink-faint">Optional</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy: hint ? hintId : undefined })}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  optional,
  className,
  ...rest
}: { label: string; hint?: ReactNode; optional?: boolean } & ComponentProps<"input">) {
  return (
    <Field label={label} hint={hint} optional={optional}>
      {({ id, describedBy }) => (
        <input id={id} aria-describedby={describedBy} className={cx(inputClass, className)} {...rest} />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  optional,
  className,
  rows = 3,
  ...rest
}: { label: string; hint?: ReactNode; optional?: boolean } & ComponentProps<"textarea">) {
  return (
    <Field label={label} hint={hint} optional={optional}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          className={cx(inputClass, "resize-y leading-relaxed", className)}
          {...rest}
        />
      )}
    </Field>
  );
}

export function Select({
  label,
  hint,
  className,
  children,
  ...rest
}: { label: string; hint?: ReactNode } & ComponentProps<"select">) {
  return (
    <Field label={label} hint={hint}>
      {({ id, describedBy }) => (
        <select id={id} aria-describedby={describedBy} className={cx(inputClass, "pr-10", className)} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

/** A group of options where any number can be chosen. */
export function ChoiceChips({
  legend,
  hint,
  options,
  value,
  onChange,
  columns = false,
}: {
  legend: string;
  hint?: ReactNode;
  options: { id: string; label: string; detail?: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  columns?: boolean;
}) {
  const hintId = useId();
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <fieldset aria-describedby={hint ? hintId : undefined}>
      <legend className="font-display text-xl font-semibold">{legend}</legend>
      {hint ? (
        <p id={hintId} className="mt-1 text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      ) : null}
      <div className={cx("mt-4 gap-2.5", columns ? "grid sm:grid-cols-2" : "flex flex-wrap")}>
        {options.map((o) => {
          const checked = value.includes(o.id);
          return (
            <label
              key={o.id}
              className={cx(
                "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-control border px-4 py-2.5",
                "transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-focus",
                checked
                  ? "border-teal bg-teal-wash text-ink"
                  : "border-line-strong bg-surface text-ink hover:bg-sunk",
              )}
            >
              <input
                type="checkbox"
                className="size-5 shrink-0"
                checked={checked}
                onChange={() => toggle(o.id)}
              />
              <span>
                <span className="block leading-snug">{o.label}</span>
                {o.detail ? (
                  <span className="mt-0.5 block text-[0.9375rem] leading-snug text-ink-soft">{o.detail}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A group of options where exactly one is chosen. */
export function ChoiceCards<T extends string>({
  legend,
  hint,
  name,
  options,
  value,
  onChange,
  layout = "stack",
  legendClassName,
}: {
  legend: string;
  hint?: ReactNode;
  name?: string;
  options: { id: T; label: string; detail?: ReactNode; icon?: ReactNode }[];
  value: T | undefined;
  onChange: (next: T) => void;
  layout?: "stack" | "row";
  legendClassName?: string;
}) {
  const autoName = useId();
  const hintId = useId();
  return (
    <fieldset aria-describedby={hint ? hintId : undefined}>
      <legend className={legendClassName ?? "font-display text-xl font-semibold"}>{legend}</legend>
      {hint ? (
        <p id={hintId} className="mt-1 text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      ) : null}
      <div className={cx("mt-3 gap-2.5", layout === "row" ? "grid grid-cols-2 sm:flex sm:flex-wrap" : "grid")}>
        {options.map((o) => {
          const checked = value === o.id;
          return (
            <label
              key={o.id}
              className={cx(
                "relative flex min-h-12 cursor-pointer items-start gap-3 rounded-control border px-4 py-3",
                "transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-focus",
                checked ? "border-teal bg-teal-wash" : "border-line-strong bg-surface hover:bg-sunk",
              )}
            >
              <input
                type="radio"
                name={name ?? autoName}
                className="mt-1 size-5 shrink-0"
                checked={checked}
                onChange={() => onChange(o.id)}
              />
              {o.icon ? <span className="mt-0.5 text-teal">{o.icon}</span> : null}
              <span>
                <span className="block font-semibold leading-snug">{o.label}</span>
                {o.detail ? (
                  <span className="mt-0.5 block text-[0.9375rem] leading-snug text-ink-soft">{o.detail}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * A 1–5 self-rating. Always optional: choosing nothing is a valid answer and
 * "Clear" takes a choice back.
 */
export function RatingScale({
  legend,
  low,
  high,
  value,
  onChange,
}: {
  legend: string;
  low: string;
  high: string;
  value: Rating | undefined;
  onChange: (next: Rating | undefined) => void;
}) {
  const name = useId();
  const scale: Rating[] = [1, 2, 3, 4, 5];
  return (
    <fieldset>
      <legend className="font-semibold">{legend}</legend>
      <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
        {scale.map((n) => {
          const checked = value === n;
          const end = n === 1 ? `, ${low}` : n === 5 ? `, ${high}` : "";
          return (
            <label
              key={n}
              className={cx(
                "flex size-12 cursor-pointer items-center justify-center rounded-full border text-lg font-semibold",
                "transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-focus",
                checked
                  ? "border-teal bg-teal text-on-teal"
                  : "border-line-strong bg-surface text-ink hover:bg-sunk",
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(n)}
                aria-label={`${n} out of 5${end}`}
              />
              <span aria-hidden="true">{n}</span>
            </label>
          );
        })}
        {value !== undefined ? (
          <button
            type="button"
            className="ml-1 min-h-11 rounded-control px-2 text-[0.9375rem] text-ink-soft underline underline-offset-4 hover:text-ink"
            onClick={() => onChange(undefined)}
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="mt-1.5 flex max-w-[17.5rem] justify-between text-sm text-ink-soft" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

/** An on/off setting with a visible label and optional explanation. */
export function Toggle({
  label,
  detail,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  detail?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const detailId = `${id}-d`;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block font-semibold">
          {label}
        </label>
        {detail ? (
          <p id={detailId} className="mt-0.5 text-[0.9375rem] text-ink-soft">
            {detail}
          </p>
        ) : null}
      </div>
      <span className="relative mt-0.5 inline-flex h-8 w-14 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={detail ? detailId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-0 rounded-full border transition-colors",
            "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-focus",
            "peer-disabled:opacity-50",
            checked ? "border-teal bg-teal" : "border-line-strong bg-sunk",
          )}
        />
        <span
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute top-1 size-6 rounded-full transition-transform",
            checked ? "translate-x-7 bg-on-teal" : "translate-x-1 bg-line-strong",
          )}
        />
      </span>
    </div>
  );
}

/** One-of-a-few choice shown as a compact row of buttons. */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
  hideLegend,
}: {
  legend: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  hideLegend?: boolean;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "font-semibold"}>{legend}</legend>
      <div
        className={cx(
          "inline-flex flex-wrap gap-1 rounded-control border border-line-strong bg-sunk p-1",
          !hideLegend && "mt-2",
        )}
      >
        {options.map((o) => {
          const checked = value === o.id;
          return (
            <label
              key={o.id}
              className={cx(
                "flex min-h-11 cursor-pointer items-center rounded-[0.55rem] px-4 text-[0.9375rem] font-semibold",
                "transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                checked ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink",
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(o.id)}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
