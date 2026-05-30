import { createFileRoute, Outlet, redirect, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { StatusDot } from "@/components/StatusDot";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthLayout,
});

const ROUTE_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  sources: "Sources",
  filters: "Filters",
  jobs: "Jobs",
  applications: "Applications",
  profile: "Profile",
  automation: "Automation",
  notifications: "Notifications",
  logs: "Logs",
  setup: "Worker setup",
};

function AuthLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);
  const [heartbeat, setHeartbeat] = useState<string | null>(null);
  const [automation, setAutomation] = useState<{ enabled: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) navigate({ to: "/login", replace: true });
      else setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!ready) return;
    const load = () => {
      Promise.all([
        supabase.from("worker_heartbeat").select("last_seen").maybeSingle(),
        supabase.from("automation_settings").select("enabled").maybeSingle(),
      ]).then(([hb, a]) => {
        setHeartbeat(hb.data?.last_seen ?? null);
        setAutomation(a.data ?? null);
      });
    };
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [ready]);

  const workerStatus: "online" | "warning" | "offline" = !heartbeat
    ? "offline"
    : Date.now() - new Date(heartbeat).getTime() < 5 * 60_000
      ? "online"
      : "warning";

  const toggleAutomation = async (v: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setAutomation((a) => (a ? { ...a, enabled: v } : a));
    const { error } = await supabase.from("automation_settings").update({ enabled: v }).eq("user_id", u.user.id);
    if (error) toast.error(error.message);
    else toast.success(v ? "Autopilot resumed" : "Autopilot paused");
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-sm">Loading cockpit…</span>
        </div>
      </div>
    );
  }

  const segments = path.split("/").filter(Boolean);
  const current = segments[0] ?? "dashboard";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1" />
          <nav className="flex items-center gap-1.5 text-sm">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">JobPilot</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="font-medium text-foreground">{ROUTE_LABEL[current] ?? current}</span>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-surface-2 px-3 py-1.5 sm:flex">
              <StatusDot status={workerStatus} />
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                Worker {workerStatus === "online" ? "online" : workerStatus === "warning" ? "stale" : "offline"}
              </span>
            </div>
            {automation && (
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface-2 px-3 py-1.5">
                <span className={`text-xs font-semibold uppercase tracking-wider ${automation.enabled ? "text-success" : "text-muted-foreground"}`}>
                  {automation.enabled ? "Autopilot" : "Paused"}
                </span>
                <Switch checked={automation.enabled} onCheckedChange={toggleAutomation} />
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
