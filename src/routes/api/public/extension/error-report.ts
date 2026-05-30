import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "crypto";

const Schema = z.object({
  token: z.string().min(10).max(200),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  route: z.string().max(500).optional(),
  source: z.string().min(1).max(60).default("extension"),
});

export const Route = createFileRoute("/api/public/extension/error-report")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }),
      POST: async ({ request }) => {
        const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
        let body: any;
        try { body = await request.json(); } catch { return new Response("bad json", { status: 400, headers: cors }); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: "invalid" }), { status: 400, headers: cors });

        const { data: tok } = await supabaseAdmin
          .from("extension_tokens")
          .select("user_id, revoked_at")
          .eq("token", parsed.data.token)
          .maybeSingle();
        if (!tok || tok.revoked_at) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

        const fp = createHash("sha1").update(parsed.data.source + ":" + parsed.data.message.slice(0, 200)).digest("hex");
        const { data: existing } = await supabaseAdmin
          .from("error_events")
          .select("id, count")
          .eq("user_id", tok.user_id)
          .eq("fingerprint", fp)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin.from("error_events").update({
            count: existing.count + 1,
            last_seen: new Date().toISOString(),
            resolved: false,
          }).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("error_events").insert({
            user_id: tok.user_id,
            fingerprint: fp,
            message: parsed.data.message,
            stack: parsed.data.stack ?? null,
            source: parsed.data.source,
            route: parsed.data.route ?? null,
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      },
    },
  },
});
