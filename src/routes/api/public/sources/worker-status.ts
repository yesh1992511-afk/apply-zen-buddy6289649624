import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

/**
 * GET /api/public/sources/worker-status
 * Auth: Bearer <extension_token>
 * Returns: { online: boolean, last_seen, version, queued_apps }
 * Used by the extension popup so the user can see worker health without
 * opening the dashboard.
 */
export const Route = createFileRoute("/api/public/sources/worker-status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
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

        const [{ data: hb }, { count: queued }] = await Promise.all([
          supabaseAdmin
            .from("worker_heartbeat")
            .select("last_seen, version")
            .eq("user_id", userId)
            .maybeSingle(),
          supabaseAdmin
            .from("applications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "queued"),
        ]);

        const lastSeen = hb?.last_seen ?? null;
        const ageMs = lastSeen ? Date.now() - new Date(lastSeen as string).getTime() : Infinity;
        return new Response(
          JSON.stringify({
            online: ageMs < 90_000,
            last_seen: lastSeen,
            version: hb?.version ?? null,
            queued_apps: queued ?? 0,
          }),
          { status: 200, headers: cors },
        );
      },
    },
  },
});
