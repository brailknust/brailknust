"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
};

export function PendingSubmitButton({ children, pendingLabel = "Saving...", className, disabled, ...props }: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type={props.type ?? "submit"} disabled={disabled || pending} className={className}>
      {pending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> {pendingLabel}</> : children}
    </button>
  );
}
