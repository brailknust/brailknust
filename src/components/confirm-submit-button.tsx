"use client";

import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  message: string;
  titleText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function ConfirmSubmitButton({
  children,
  message,
  titleText = "Confirm deletion",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onClick,
  type = "submit",
  ...props
}: ConfirmSubmitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type={type}
        onClick={(event) => {
          onClick?.(event);

          if (event.defaultPrevented) {
            return;
          }

          event.preventDefault();
          setIsOpen(true);
        }}
      >
        {children}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/55 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          aria-describedby="confirm-delete-message"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-background p-5 text-foreground shadow-xl">
            <h2 id="confirm-delete-title" className="text-lg font-semibold">
              {titleText}
            </h2>
            <p id="confirm-delete-message" className="mt-3 text-sm leading-6 text-muted">
              {message}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.closest("form")?.requestSubmit();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
