/**
 * pg_cron hook: every 15 minutes, enqueue daily-summary commands for users
 * whose preferred send-time has passed and who haven't received today's summary.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasCronSecret } from "@/lib/api-auth.server";
import { appError, withErrorBoundary } from "@/lib/errors";

export const Route = createFileRoute("/api/public/hooks/daily-summary")({
  server: {
    handlers: {
      POST: withErrorBoundary(async ({ request }) => {
        const t0 = Date.now();
        if (!hasCronSecret(request)) throw appError("UNAUTHORIZED", "Invalid or missing internal secret");

        const { data: settingsList, error: sErr } = await supabaseAdmin
          .from("notification_settings")
          .select("user_id,daily_summary_enabled,daily_summary_time,last_daily_summary_date");
        if (sErr) throw appError("INTERNAL", sErr.message);

        if (!settingsList || settingsList.length === 0) {
          console.log(JSON.stringify({ evt: "daily-summary", enqueued: 0, ms: Date.now() - t0 }));
          return Response.json({ enqueued: 0 });
        }

        const now = new Date();
        const todayISO = now.toISOString().slice(0, 10);
        const nowHM = now.toISOString().slice(11, 16);

        let enqueued = 0;
        for (const s of settingsList) {
          if (!s.daily_summary_enabled) continue;
          if (s.last_daily_summary_date === todayISO) continue;
          const cfgHM = (s.daily_summary_time || "20:00:00").slice(0, 5);
          if (nowHM < cfgHM) continue;

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

        console.log(JSON.stringify({ evt: "daily-summary", enqueued, ms: Date.now() - t0 }));
        return Response.json({ enqueued });
      }),
    },
  },
});
