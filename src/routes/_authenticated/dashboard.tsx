import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Send, CheckCircle2, AlertTriangle, Activity, Clock } from "lucide-react";

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

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [heartbeat, setHeartbeat] = useState<string | null>(null);

  useEffect(() => {
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
    ]).then(([j, m, a, f, q, t, hb]) => {
      setStats({
        jobsToday: j.count ?? 0,
        matchedToday: m.count ?? 0,
        appliedToday: a.count ?? 0,
        failedToday: f.count ?? 0,
        queued: q.count ?? 0,
        total: t.count ?? 0,
      });
      setHeartbeat(hb.data?.last_seen ?? null);
    });
  }, []);

  const workerOk = heartbeat && Date.now() - new Date(heartbeat).getTime() < 5 * 60_000;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live snapshot of your job hunt automation.</p>
        </div>
        <Badge variant={workerOk ? "default" : "secondary"} className={workerOk ? "bg-green-500/15 text-green-500 hover:bg-green-500/15" : ""}>
          Worker {workerOk ? "online" : heartbeat ? "stale" : "offline"}
        </Badge>
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

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Fill in your <strong>Profile</strong>, experiences, skills, and upload your LaTeX resume template.</p>
          <p>2. Configure scraping <strong>Sources</strong> (Apify actors, free APIs, ATS boards) and their cadence.</p>
          <p>3. Define <strong>Filters</strong> for what jobs actually show up in your feed.</p>
          <p>4. Configure <strong>Automation</strong> rules (daily window, max applies/day, aggressiveness).</p>
          <p>5. Deploy the Python worker on your VPS — it will pick up everything from this database.</p>
        </CardContent>
      </Card>
    </div>
  );
}
