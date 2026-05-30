import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertOwnerOrAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("owner") && !roles.includes("admin")) {
    throw new Error("Forbidden");
  }
  return roles;
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { role: string }) => r.role);
  });

export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("feature_flags").select("*");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      key: z.string().min(1).max(80).regex(/^[a-z0-9_.-]+$/),
      enabled: z.boolean(),
      rollout_pct: z.number().int().min(0).max(100),
      description: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnerOrAdmin(supabase, userId);
    const { error } = await supabaseAdmin.from("feature_flags").upsert({
      key: data.key,
      enabled: data.enabled,
      rollout_pct: data.rollout_pct,
      description: data.description ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "feature_flag.upsert",
      entity_type: "feature_flag",
      entity_id: data.key,
      after: { enabled: data.enabled, rollout_pct: data.rollout_pct },
    });
    return { ok: true };
  });

export const dispatchWorkerCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      kind: z.enum(["pause", "resume", "drain_apply_queue", "refresh_sources", "test_apply"]),
      payload: z.record(z.string(), z.unknown()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnerOrAdmin(supabase, userId);
    const { error } = await supabase.from("worker_commands").insert({
      user_id: userId,
      kind: data.kind,
      payload: data.payload ?? {},
    });
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "worker.command",
      entity_type: "worker_command",
      entity_id: data.kind,
    });
    return { ok: true };
  });
