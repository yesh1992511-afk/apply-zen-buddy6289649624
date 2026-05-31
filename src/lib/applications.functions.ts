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
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
    return { rescored: (data as number) ?? 0 };
  });
