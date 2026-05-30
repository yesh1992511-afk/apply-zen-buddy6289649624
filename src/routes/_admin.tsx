import { createFileRoute, Outlet, Link, useRouterState, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Activity, Flag, ScrollText, CreditCard, Server } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const has = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    if (!has) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const TABS = [
  { to: "/admin/observability", label: "Observability", icon: Activity },
  { to: "/admin/system", label: "System", icon: Server },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
  { to: "/admin/flags", label: "Feature flags", icon: Flag },
  { to: "/admin/billing", label: "Billing ops", icon: CreditCard },
] as const;

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-emerald shadow-glow">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold tracking-tight">Admin console</h1>
          <p className="text-xs text-muted-foreground">Internal operations. Owner / admin only.</p>
        </div>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border/40">
        {TABS.map((t) => {
          const active = path === t.to || path.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
