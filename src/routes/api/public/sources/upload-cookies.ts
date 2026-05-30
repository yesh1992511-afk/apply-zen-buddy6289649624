import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const cors: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const ALLOWED_HOSTS = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "wellfound.com",
  "dice.com",
] as const;

const BodySchema = z.object({
  host: z.enum(ALLOWED_HOSTS),
  ciphertext: z.string().min(16).max(200_000),
  iv: z.string().min(12).max(64),
  expires_at: z.string().datetime().optional().nullable(),
});

/**
 * POST /api/public/sources/upload-cookies
 *
 * The extension encrypts the user's session cookies for a host with a
 * passphrase that NEVER leaves the browser, and posts ciphertext here.
 * The VPS worker holds the same passphrase in its env and decrypts on
 * demand to reuse the user's logged-in session, skipping the login wall.
 */
export const Route = createFileRoute("/api/public/sources/upload-cookies")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!token || token.length < 16) {
          return new Response(JSON.stringify({ error: "missing_token" }), { status: 401, headers: cors });
        }
        const { data: tok } = await supabaseAdmin
          .from("extension_tokens")
          .select("user_id")
          .eq("token", token)
          .maybeSingle();
        if (!tok) {
          return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: cors });
        }
        const userId = tok.user_id as string;

        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: cors });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid_body", details: parsed.error.flatten() }), { status: 400, headers: cors });
        }

        const { host, ciphertext, iv, expires_at } = parsed.data;
        const { error } = await supabaseAdmin
          .from("session_cookies")
          .upsert(
            {
              user_id: userId,
              host,
              ciphertext,
              iv,
              expires_at: expires_at ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,host" },
          );
        if (error) {
          return new Response(JSON.stringify({ error: "store_failed", details: error.message }), { status: 500, headers: cors });
        }

        await supabaseAdmin.from("extension_tokens").update({ last_seen_at: new Date().toISOString() }).eq("token", token);
        return new Response(JSON.stringify({ ok: true, host }), { status: 200, headers: cors });
      },
    },
  },
});
