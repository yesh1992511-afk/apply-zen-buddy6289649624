/**
 * Auth helpers for /api/public/* server routes.
 *
 * We use the project's Supabase publishable (anon) key as a shared secret in
 * the `apikey` header. pg_cron already passes this when calling our endpoints
 * via pg_net, and the browser-side fetch can attach it from
 * VITE_SUPABASE_PUBLISHABLE_KEY. No additional secret needed.
 */

export function expectedApiKey(): string {
  return process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
}

/** Constant-time string compare to resist timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns true if the request carries the right anon-key in `apikey` or `Authorization: Bearer`. */
export function hasValidApiKey(request: Request): boolean {
  const expected = expectedApiKey();
  if (!expected) return false;
  const headerKey = request.headers.get("apikey") ?? "";
  if (safeEqual(headerKey, expected)) return true;
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return safeEqual(auth.slice(7).trim(), expected);
  return false;
}

/**
 * Insert an idempotency record. Returns true on first-time, false if the key
 * was already seen within the dedupe window. Errors return true (fail-open).
 */
export async function claimIdempotency(opts: {
  supabaseAdmin: { from: (t: string) => { insert: (row: unknown) => Promise<{ error: { code?: string } | null }> } };
  key: string;
  kind: string;
  userId?: string;
}): Promise<boolean> {
  try {
    const { error } = await opts.supabaseAdmin.from("worker_invocations").insert({
      idempotency_key: opts.key,
      kind: opts.kind,
      user_id: opts.userId ?? null,
    });
    if (!error) return true;
    // 23505 = unique_violation -> already claimed
    if (error.code === "23505") return false;
    return true;
  } catch {
    return true;
  }
}
