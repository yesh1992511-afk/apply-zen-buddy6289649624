import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Briefcase, Send, CheckCircle2, AlertTriangle, Activity, Clock, Pause } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — JobPilot" }] }),
  component: Dashboard,
});

type Stats = {
  jobsToday: number;
  matchedToday: number;
  appliedToday: number;
  failedToday: number;
  queued: number;
  total: number;
};

type LogRow = {
  id: number;
  ts: string;
  level: string;
  scope: string | null;
  message: string;
};

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [heartbeat, setHeartbeat] = useState<string | null>(null);
  const [automation, setAutomation] = useState<{ enabled: boolean; max_applies_per_day: number } | null>(null);
  const [recent, setRecent] = useState<LogRow[]>([]);

  const load = () => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    Promise.all([
      supabase.from("jobs").select("id", { count: "exact", head: true }).gte("scraped_at", sinceIso),
      supabase.from("jobs").select("id", { count: "exact", head: true }).gte("scraped_at", sinceIso).eq("matched", true),
      supabase.from("applications").select("id", { count: "exact", head: true }).gte("applied_at", sinceIso).eq("status", "applied"),
      supabase.from("applications").select("id", { count: "exact", head: true }).gte("updated_at", sinceIso).eq("status", "failed"),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "queued"),
      supabase.from("jobs").select("id", { count: "exact", head: true }),
      supabase.from("worker_heartbeat").select("last_seen").maybeSingle(),
      supabase.from("automation_settings").select("enabled,max_applies_per_day").maybeSingle(),
      supabase.from("logs").select("id,ts,level,scope,message").order("ts", { ascending: false }).limit(10),
    ]).then(([j, m, a, f, q, t, hb, auto, lg]) => {
      setStats({
        jobsToday: j.count ?? 0,
        matchedToday: m.count ?? 0,
        appliedToday: a.count ?? 0,
        failedToday: f.count ?? 0,
        queued: q.count ?? 0,
        total: t.count ?? 0,
      });
      setHeartbeat(hb.data?.last_seen ?? null);
      setAutomation(auto.data ?? null);
      setRecent((lg.data ?? []) as LogRow[]);
    });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  const workerOk = heartbeat && Date.now() - new Date(heartbeat).getTime() < 5 * 60_000;

  const toggleAutomation = async (v: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setAutomation((a) => (a ? { ...a, enabled: v } : a));
    const { error } = await supabase.from("automation_settings").update({ enabled: v }).eq("user_id", u.user.id);
    if (error) toast.error(error.message);
    else toast.success(v ? "Automation resumed" : "Automation paused");
  };

  const budget = automation?.max_applies_per_day ?? 0;
  const used = stats?.appliedToday ?? 0;
  const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;

  const cards = [
    { label: "Jobs scraped today", value: stats?.jobsToday, icon: Briefcase },
    { label: "Matched today", value: stats?.matchedToday, icon: Activity },
    { label: "Applied today", value: stats?.appliedToday, icon: CheckCircle2 },
    { label: "Failed today", value: stats?.failedToday, icon: AlertTriangle },
    { label: "Queued", value: stats?.queued, icon: Clock },
    { label: "Total jobs in DB", value: stats?.total, icon: Send },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live snapshot of your job hunt automation.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={workerOk ? "default" : "secondary"} className={workerOk ? "bg-green-500/15 text-green-500 hover:bg-green-500/15" : ""}>
            Worker {workerOk ? "online" : heartbeat ? "stale" : "offline"}
          </Badge>
          {automation && (
            <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              <Pause className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Automation</span>
              <Switch checked={automation.enabled} onCheckedChange={toggleAutomation} />
              <span className="text-xs text-muted-foreground">{automation.enabled ? "ON" : "PAUSED"}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value ?? "—"}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {automation && budget > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily apply budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{used} / {budget} today</span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${pct >= 90 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet. Once the worker runs, activity will appear here.</p>
          ) : (
            <div className="divide-y">
              {recent.map((r) => (
                <div key={r.id} className="flex items-start gap-3 py-2 text-sm">
                  <Badge
                    variant={r.level === "error" ? "destructive" : r.level === "warn" ? "secondary" : "outline"}
                    className="mt-0.5 text-[10px] uppercase"
                  >
                    {r.level}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.ts).toLocaleTimeString()}
                  </span>
                  {r.scope && <span className="text-xs text-muted-foreground">{r.scope}</span>}
                  <span className="min-w-0 flex-1 truncate">{r.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
