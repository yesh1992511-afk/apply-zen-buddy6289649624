import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EXPORT_TABLES = [
  "profile", "experiences", "educations", "projects", "certifications",
  "languages", "references_list", "skills", "filters", "sources",
  "jobs", "applications", "application_events", "notification_log",
  "automation_settings", "notification_settings", "logs",
] as const;

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const dump: Record<string, any> = { exported_at: new Date().toISOString(), user_id: userId };
    for (const table of EXPORT_TABLES) {
      const { data } = await supabase.from(table as any).select("*").limit(10000);
      dump[table] = data ?? [];
    }
    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "gdpr.export",
      entity_type: "account",
      entity_id: userId,
    });
    return dump;
  });

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ reason: z.string().max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("account_deletion_requests").upsert({
      user_id: userId,
      requested_at: new Date().toISOString(),
      purge_after: new Date(Date.now() + 30 * 86400_000).toISOString(),
      cancelled_at: null,
      reason: data.reason ?? null,
    });
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "gdpr.delete_requested",
      entity_type: "account",
      entity_id: userId,
    });
    return { ok: true };
  });

export const cancelAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("account_deletion_requests")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
    return { ok: true };
  });

export const getDeletionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("account_deletion_requests")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  });
