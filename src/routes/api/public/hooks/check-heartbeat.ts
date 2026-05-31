/**
 * pg_cron hook: every 5 minutes, find users whose worker hasn't checked in
 * within 10 minutes and send an offline alert (debounced to once per hour).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasCronSecret } from "@/lib/api-auth.server";
import { appError, withErrorBoundary } from "@/lib/errors";

export const Route = createFileRoute("/api/public/hooks/check-heartbeat")({
  server: {
    handlers: {
      POST: withErrorBoundary(async ({ request }) => {
        const t0 = Date.now();
        if (!hasCronSecret(request)) throw appError("UNAUTHORIZED", "Invalid or missing internal secret");

        const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const debounceCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { data: stale, error: staleErr } = await supabaseAdmin
          .from("worker_heartbeat")
          .select("user_id,last_seen")
          .lt("last_seen", cutoff);
        if (staleErr) throw appError("INTERNAL", staleErr.message);

        if (!stale || stale.length === 0) {
          console.log(JSON.stringify({ evt: "check-heartbeat", checked: 0, ms: Date.now() - t0 }));
          return Response.json({ checked: 0 });
        }

        let alerted = 0;
        for (const row of stale) {
          const { data: settings } = await supabaseAdmin
            .from("notification_settings")
            .select("*")
            .eq("user_id", row.user_id)
            .maybeSingle();
          if (!settings?.notify_worker_offline) continue;
          if (settings.last_worker_offline_alert && settings.last_worker_offline_alert > debounceCutoff) continue;

          await supabaseAdmin.from("worker_commands").insert({
            user_id: row.user_id,
            kind: "notify_offline",
            payload: { last_seen: row.last_seen },
          });
          await supabaseAdmin
            .from("notification_settings")
            .update({ last_worker_offline_alert: new Date().toISOString() })
            .eq("user_id", row.user_id);
          await supabaseAdmin.from("notification_log").insert({
            user_id: row.user_id,
            kind: "worker_offline_queued",
            subject: "Worker offline",
            body: `Worker last seen ${row.last_seen}. Notification queued.`,
            recipient_email: settings.recipient_email ?? "n/a",
            status: "queued",
          });
          alerted++;
        }

        console.log(JSON.stringify({ evt: "check-heartbeat", checked: stale.length, alerted, ms: Date.now() - t0 }));
        return Response.json({ checked: stale.length, alerted });
      }),
    },
  },
});
