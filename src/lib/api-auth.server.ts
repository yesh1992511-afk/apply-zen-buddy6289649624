/**
 * Auth helpers for /api/public/* server routes.
 *
 * Two patterns:
 *   1. Internal/cron callers send `x-internal-secret: <WORKER_CRON_SECRET>`.
 *   2. Browser callers send `Authorization: Bearer <supabase user JWT>`.
 *
 * Endpoints choose which they accept via `hasCronSecret` or `requireUserOrCron`.
 * The legacy anon-key shared secret is removed — the anon key ships in the JS
 * bundle, so it provides no real authentication.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { appError } from "@/lib/errors";

function expectedCronSecret(): string {
  return process.env.WORKER_CRON_SECRET ?? "";
}

/** Constant-time string compare to resist timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True if the request carries the configured cron/internal shared secret. */
export function hasCronSecret(request: Request): boolean {
  const expected = expectedCronSecret();
  if (!expected) return false;
  const provided = request.headers.get("x-internal-secret") ?? "";
  return safeEqual(provided, expected);
}

export type RequireUserOrCronResult =
  | { userId: string; isCron: false }
  | { userId: null; isCron: true };

/**
 * Accept either:
 *   - the cron/internal secret (no per-user scoping; handler runs as service), or
 *   - a valid Supabase user JWT in `Authorization: Bearer ...` (scoped to that user).
 *
 * Throws UNAUTHORIZED otherwise.
 */
export async function requireUserOrCron(request: Request): Promise<RequireUserOrCronResult> {
  if (hasCronSecret(request)) return { userId: null, isCron: true };

  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) {
        return { userId: data.user.id, isCron: false };
      }
    }
  }
  throw appError("UNAUTHORIZED", "Authentication required");
}

/**
 * Insert an idempotency record. Returns true on first-time, false if the key
 * was already seen within the dedupe window. Errors return true (fail-open).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function claimIdempotency(opts: { supabaseAdmin: any; key: string; kind: string; userId?: string }): Promise<boolean> {
  try {
    const { error } = await opts.supabaseAdmin.from("worker_invocations").insert({
      idempotency_key: opts.key,
      kind: opts.kind,
      user_id: opts.userId ?? null,
    });
    if (!error) return true;
    if (error.code === "23505") return false;
    return true;
  } catch {
    return true;
  }
}
