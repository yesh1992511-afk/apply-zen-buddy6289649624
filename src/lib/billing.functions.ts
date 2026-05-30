import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBillingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: sub }, { data: plans }, { data: quota }, { data: roles }] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("usage_quotas").select("*").eq("user_id", userId).eq("day", today).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const isOwner = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    return { subscription: sub, plans: plans ?? [], quota: quota ?? null, isOwner };
  });
