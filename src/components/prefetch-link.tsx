"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes } from "react";

type PrefetchLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

export function PrefetchLink({ href, onMouseEnter, onFocus, ...props }: PrefetchLinkProps) {
  const router = useRouter();
  const warmRoute = () => router.prefetch(href.toString());

  return (
    <Link
      {...props}
      href={href}
      onMouseEnter={(event) => {
        warmRoute();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        warmRoute();
        onFocus?.(event);
      }}
    />
  );
}
