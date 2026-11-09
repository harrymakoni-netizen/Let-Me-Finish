import Image from "next/image";
import Link from "next/link";
import { cx } from "@/lib/util";

export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/icons/icon-192.png"
      width={size}
      height={size}
      alt=""
      unoptimized
      priority
      className={cx("shrink-0", className)}
    />
  );
}

export function Wordmark({ href = "/home", className }: { href?: string | null; className?: string }) {
  const inner = (
    <>
      <Logo size={36} />
      <span className="font-display text-xl font-semibold tracking-tight">Let Me Finish</span>
    </>
  );
  if (href === null) return <span className={cx("inline-flex items-center gap-2.5", className)}>{inner}</span>;
  return (
    <Link
      href={href}
      className={cx("inline-flex min-h-12 items-center gap-2.5 rounded-control pr-2", className)}
      aria-label="Let Me Finish, home"
    >
      {inner}
    </Link>
  );
}
