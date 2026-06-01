/**
 * Application retry / discard / dead-letter handling.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const IdInput = z.object({ id: z.string().uuid() });

export const retryApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("applications")
      .update({
        phase: "queued",
        status: "queued",
        retry_count: 0,
        next_retry_at: null,
        last_error: null,
        dlq_reason: null,
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
    return { ok: true };
  });

export const discardApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("applications")
      .update({
        phase: "dead_letter",
        status: "failed",
        dlq_reason: "user_discarded",
        next_retry_at: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
    return { ok: true };
  });

export const rescoreAllJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Use the admin client: the underlying SECURITY DEFINER function is
    // restricted to service_role. The function itself authorises the call
    // by checking the supplied _user_id against auth.uid()/role internally.
    const { data, error } = await supabaseAdmin.rpc("rescore_all_jobs_for_user", { _user_id: userId });
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
    return { rescored: (data as number) ?? 0 };
  });

const BatchInput = z.object({ target: z.number().int().min(1).max(50).optional() });

/**
 * One-shot batch: scrape sources until N matched jobs are inserted, then stop.
 * The `auto_queue_matched_job` trigger queues applications; the pg_cron apply
 * worker submits them. This fn does NOT submit applications itself.
 *
 * Daily cap from `automation_settings.max_applies_per_day` minus today's
 * queued/applied count is the upper bound for the effective target.
 */
export const runOneShotBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BatchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const requested = data.target ?? 10;

    // Check automation enabled (trigger is no-op when disabled).
    const { data: settings, error: sErr } = await supabase
      .from("automation_settings")
      .select("enabled, max_applies_per_day")
      .eq("user_id", userId)
      .maybeSingle();
    if (sErr) { console.error("[server-fn] supabase error", sErr); throw new Error("Request failed"); }
    if (!settings?.enabled) {
      throw new Error("Enable Automation in Settings before running a batch.");
    }

    // Clamp to remaining daily apply quota.
    const cap = settings.max_applies_per_day ?? 50;
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const { count: usedToday } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("queued_at", todayStart.toISOString());
    const remaining = Math.max(0, cap - (usedToday ?? 0));
    const target = Math.min(requested, remaining);
    if (target <= 0) {
      throw new Error(`Daily apply cap reached (${usedToday ?? 0}/${cap}). Try again tomorrow.`);
    }

    const secret = process.env.WORKER_CRON_SECRET;
    if (!secret) {
      console.error("[server-fn] WORKER_CRON_SECRET not configured");
      throw new Error("Server is not configured for batch runs.");
    }

    // Resolve the public origin from the incoming request so this works on
    // both preview and published URLs without hardcoding.
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const origin = new URL(req.url).origin;

    const res = await fetch(`${origin}/api/public/sources/run-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ userId, target }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[server-fn] batch worker failed", res.status, txt);
      throw new Error(`Batch worker failed (${res.status})`);
    }
    const result = (await res.json()) as {
      matched: number; fetched: number; inserted: number;
      perSource: Array<{ key: string; matched: number }>;
    };
    return {
      requested,
      target,
      matched: result.matched,
      fetched: result.fetched,
      inserted: result.inserted,
      sourcesTried: result.perSource.length,
      capReached: usedToday ?? 0,
      capTotal: cap,
    };
  });

