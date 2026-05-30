import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("super_admin")) {
    throw new Error("Forbidden: super-admin only");
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

// ---------- Observability ----------
export const listErrorEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("error_events")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setErrorResolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), resolved: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("error_events")
      .update({ resolved: data.resolved })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Audit ----------
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("audit_log")
      .select("id, ts, action, entity_type, entity_id, metadata, user_id")
      .order("ts", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- System ----------
export const getSystemSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const [hb, cmds, apps] = await Promise.all([
      supabaseAdmin.from("worker_heartbeat").select("last_seen, version, user_id").order("last_seen", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("worker_commands").select("id, kind, status, created_at, finished_at, last_error").order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("applications").select("phase"),
    ]);
    const counts: Record<string, number> = {};
    (apps.data ?? []).forEach((r: any) => { counts[r.phase] = (counts[r.phase] ?? 0) + 1; });
    return {
      heartbeat: hb.data ?? null,
      commands: cmds.data ?? [],
      counts: { queued: counts.queued ?? 0, applying: counts.applying ?? 0, needs_review: counts.needs_review ?? 0 },
    };
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
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabaseAdmin.from("worker_commands").insert({
      user_id: userId,
      kind: data.kind,
      payload: (data.payload ?? {}) as any,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      actor_role: "super_admin",
      action: "worker.command",
      entity_type: "worker_command",
      entity_id: data.kind,
    });
    return { ok: true };
  });

// ---------- Feature flags ----------
export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin.from("feature_flags").select("*").order("key");
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
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabaseAdmin.from("feature_flags").upsert({
      key: data.key,
      enabled: data.enabled,
      rollout_pct: data.rollout_pct,
      description: data.description ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      actor_role: "super_admin",
      action: "feature_flag.upsert",
      entity_type: "feature_flag",
      entity_id: data.key,
      after: { enabled: data.enabled, rollout_pct: data.rollout_pct },
    });
    return { ok: true };
  });

// ---------- Plans ----------
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin.from("plans").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Login verification ----------
export const verifySuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r: { role: string }) => r.role);
    return { isSuperAdmin: roles.includes("super_admin") };
  });
