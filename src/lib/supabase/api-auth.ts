import "server-only";

import { createClient } from "@supabase/supabase-js";

import { clientEnv } from "@/lib/env";
import { getSupabaseUser, type SupabaseAuthUser } from "@/features/auth/queries";

/**
 * Resolves the authenticated Supabase user for an API route, accepting
 * either:
 *  - `Authorization: Bearer <access_token>` — used by the mobile app, which
 *    has no browser cookie jar (see mobile/src/lib/api.ts).
 *  - the existing cookie-based session — used by the web app.
 *
 * Route handlers that should be reachable from the mobile app must use this
 * instead of `getSupabaseUser()` from features/auth/queries.ts, which only
 * reads cookies.
 */
export async function getSupabaseUserFromRequest(
  request: Request,
): Promise<SupabaseAuthUser | null> {
  const bearerToken = extractBearerToken(request);
  if (!bearerToken) {
    return getSupabaseUser();
  }

  if (!clientEnv.NEXT_PUBLIC_SUPABASE_URL || !clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = createClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data, error } = await supabase.auth.getUser(bearerToken);
  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email,
    user_metadata: {
      full_name:
        typeof data.user.user_metadata?.full_name === "string"
          ? data.user.user_metadata.full_name
          : undefined,
      avatar_url:
        typeof data.user.user_metadata?.avatar_url === "string"
          ? data.user.user_metadata.avatar_url
          : undefined,
    },
  };
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}
