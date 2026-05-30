import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Append an audit event. RLS scopes to caller. */
export const recordAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      action: z.string().min(1).max(120),
      entity_type: z.string().min(1).max(60),
      entity_id: z.string().max(120).optional(),
      before: z.record(z.string(), z.unknown()).optional(),
      after: z.record(z.string(), z.unknown()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("audit_log").insert({
      user_id: userId,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id ?? null,
      before: (data.before ?? null) as any,
      after: (data.after ?? null) as any,
      metadata: (data.metadata ?? {}) as any,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, ts, action, entity_type, entity_id, metadata")
      .order("ts", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data;
  });
