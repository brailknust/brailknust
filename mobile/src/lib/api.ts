import { env } from "./env";
import { supabase } from "./supabase";

// Thin client for the existing BRAIL Next.js API (app/api/* in the repo
// root). Attaches the Supabase access token as a Bearer header.
//
// NOTE: as of this writing the web API only authenticates via Supabase
// session cookies (see src/proxy.ts and src/lib/supabase/server.ts) — there
// is no Bearer-token verification yet. This client is written for the
// target state; see docs/mobile-roadmap.md Phase 1 for the required
// server-side change (routes the mobile app calls must also accept
// `Authorization: Bearer <access_token>` and verify it via
// `supabase.auth.getUser(token)`).
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<T>;
}
