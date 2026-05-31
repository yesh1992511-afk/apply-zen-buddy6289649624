/**
 * Worker bootstrap endpoint.
 *
 * Returns a flat env-var map that the VPS worker writes into its own `.env`
 * on startup. This keeps secrets in ONE place (Lovable Cloud) instead of
 * having to ssh into the VPS every time a key rotates.
 *
 * Auth: caller MUST send `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
 * The handler compares against process.env.SUPABASE_SERVICE_ROLE_KEY using a
 * constant-time check.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

const WORKER_ENV_NAMES = [
  "APIFY_TOKEN",
  "DECODO_USERNAME", "DECODO_PASSWORD", "DECODO_HOST", "DECODO_PORT", "DECODO_COUNTRY",
  "CAPSOLVER_API_KEY",
  "OPENAI_API_KEY", "OPENAI_MODEL",
  "DEEPSEEK_API_KEY", "DEEPSEEK_REASONER_MODEL", "DEEPSEEK_CHAT_MODEL",
  "GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "GMAIL_OAUTH_REFRESH_TOKEN", "GMAIL_EMAIL",
  "APPLY_EMAIL", "APPLY_PASSWORD", "APPLY_DEFAULT_PHONE",
  "USAJOBS_API_KEY", "USAJOBS_USER_AGENT_EMAIL",
] as const;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/worker/env")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!expected) {
          return new Response("Server not configured", { status: 500 });
        }
        const auth = request.headers.get("authorization") || "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token || !safeEqual(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const out: Record<string, string> = {};
        for (const name of WORKER_ENV_NAMES) {
          const v = process.env[name];
          if (v && v.length > 0) out[name] = v;
        }
        // Also pass the Supabase URL / publishable key so the worker can
        // construct its own client without us copying it manually.
        if (process.env.SUPABASE_URL) out.SUPABASE_URL = process.env.SUPABASE_URL;
        if (process.env.SUPABASE_PUBLISHABLE_KEY) out.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

        return new Response(JSON.stringify(out), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
