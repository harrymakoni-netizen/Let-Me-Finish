"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./button";

/**
 * A modal built on the native <dialog>, which gives us focus trapping, Escape
 * to close and focus return for free.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    return () => {
      // A page hidden by navigation must not leave a modal open behind it.
      if (el.open) el.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="lmf-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1.5">
              <X aria-hidden="true" className="size-5" />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
