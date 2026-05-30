/**
 * pg_cron hook: every 15 minutes, check which users haven't received today's
 * daily summary yet AND their preferred send-time has passed. For each,
 * enqueue a `notify_daily_summary` worker_command. Worker computes the
 * actual numbers and sends.
 *
 * Skips if user has no Gmail credentials configured (no point queuing).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasValidApiKey } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/hooks/daily-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasValidApiKey(request)) {
          return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid apikey" } }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const { data: settingsList } = await supabaseAdmin
          .from("notification_settings")
          .select("user_id,daily_summary_enabled,daily_summary_time,last_daily_summary_date");

        if (!settingsList || settingsList.length === 0) {
          return new Response(JSON.stringify({ enqueued: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Treat times as UTC for simplicity (worker has user's tz; we just gate at the hour level here).
        const now = new Date();
        const todayISO = now.toISOString().slice(0, 10);
        const nowHM = now.toISOString().slice(11, 16); // HH:MM

        let enqueued = 0;
        for (const s of settingsList) {
          if (!s.daily_summary_enabled) continue;
          if (s.last_daily_summary_date === todayISO) continue;
          const cfgHM = (s.daily_summary_time || "20:00:00").slice(0, 5);
          if (nowHM < cfgHM) continue;

          // Has Gmail creds?
          const { data: creds } = await supabaseAdmin
            .from("gmail_credentials")
            .select("id")
            .eq("user_id", s.user_id)
            .maybeSingle();
          if (!creds) continue;

          await supabaseAdmin.from("worker_commands").insert({
            user_id: s.user_id,
            kind: "notify_daily_summary",
            payload: { date: todayISO },
          });
          await supabaseAdmin
            .from("notification_settings")
            .update({ last_daily_summary_date: todayISO })
            .eq("user_id", s.user_id);
          enqueued++;
        }

        return new Response(JSON.stringify({ enqueued }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
