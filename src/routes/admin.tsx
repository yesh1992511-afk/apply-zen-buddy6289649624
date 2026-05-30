import { createFileRoute, Outlet, Link, useRouterState, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Activity, Flag, ScrollText, CreditCard, Server, LogOut, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Admin console" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/admin-login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuper) throw redirect({ to: "/admin-login", search: { reason: "forbidden" } as any });
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin/observability", label: "Observability", icon: Activity },
  { to: "/admin/system", label: "System", icon: Server },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
  { to: "/admin/flags", label: "Feature flags", icon: Flag },
  { to: "/admin/plans", label: "Plans", icon: CreditCard },
] as const;

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const current = NAV.find((n) => path === n.to || path.startsWith(n.to + "/"));

  const exitAdmin = () => navigate({ to: "/dashboard" });
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin-login", replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-background text-foreground">
      {/* Side rail */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur md:flex">
        <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-emerald shadow-glow">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-sm font-semibold tracking-tight">Admin console</div>
            <div className="text-[10px] text-muted-foreground">Super-admin only</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/60 p-3 space-y-1.5">
          <div className="px-2 pb-1 text-[10px] text-muted-foreground truncate" title={email}>{email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={exitAdmin}>
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Exit admin
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-destructive hover:text-destructive" onClick={signOut}>
            <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border/60 bg-card/30 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Admin</span>
            {current && <><span>/</span><span className="text-foreground">{current.label}</span></>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* mobile nav */}
            <nav className="flex gap-1 md:hidden">
              {NAV.map((n) => {
                const active = path === n.to || path.startsWith(n.to + "/");
                return (
                  <Link key={n.to} to={n.to} className={cn("rounded px-2 py-1 text-[11px]", active ? "bg-primary/20" : "text-muted-foreground")}>
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <Button variant="outline" size="sm" className="h-8 text-xs md:hidden" onClick={exitAdmin}>
              <ArrowLeft className="mr-1.5 h-3 w-3" /> Exit
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
