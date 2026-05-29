/**
 * pg_cron hook: every 5 minutes, find users whose worker hasn't checked in
 * within 10 minutes and send an offline alert (debounced to once per hour).
 *
 * Implementation: enqueue a `notify_offline` worker_command. The worker
 * polls this every 5s and sends via Gmail. If the worker is genuinely
 * offline, the command stays pending — but when it comes back online it'll
 * pick it up and notify. For a true "worker dead" alert, we rely on the
 * fact that the worker writes heartbeats; if last_seen is very stale,
 * we mark `last_worker_offline_alert` so we don't spam.
 *
 * Since the worker may be dead, we DON'T rely solely on it. We also push
 * a notification_log row marked 'queued_offline' that the UI can surface.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/check-heartbeat")({
  server: {
    handlers: {
      POST: async () => {
        const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const debounceCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // Find users with stale heartbeat
        const { data: stale } = await supabaseAdmin
          .from("worker_heartbeat")
          .select("user_id,last_seen")
          .lt("last_seen", cutoff);

        if (!stale || stale.length === 0) {
          return new Response(JSON.stringify({ checked: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
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

          // Enqueue a notify command (worker, when alive, will send it)
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

        return new Response(JSON.stringify({ checked: stale.length, alerted }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
